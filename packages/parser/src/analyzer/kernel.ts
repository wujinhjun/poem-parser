/**
 * 分析器内核 —— 纯函数，零副作用
 *
 * 所有依赖通过参数注入，无 fs / process.cwd() / 全局可变状态。
 * 可被任意工具（CLI、Web API、VS Code 插件、测试框架）直接调用。
 *
 * @module analyzer/kernel
 */

import type {
  Diagnostic,
  LineNode,
  LineValidationResult,
  PoemAST,
  ToneAmbiguity,
} from "../core/types.js";
import type { RhymeDict } from "../rhyme-dict/index.js";
import type { AnyTemplate, MeterTemplate } from "../templates/index.js";
import { analyzeRescue } from "../rescue/index.js";
import { annotateLineText } from "./ast.js";
import { validateChars, applyRescueMarks, validateRhyme, LineValidationSummary } from "./validation.js";
import { resolveLineTemplate } from "./templates.js";
import { runPipeline, PipelineInput, PipelineOutput } from "./pipeline.js";

// ============ 公共类型 ============

export interface AnalyzeOptionsInternal {
  preferredType?: "lüshi" | "jueju" | "ci";
  variantId?: string;
  strictMode?: boolean;
}

export interface AnalysisResult {
  ast: PoemAST;
  matchResults: import("../matcher/index.js").MatchResult[];
  bestMatch: import("../matcher/index.js").MatchResult | null;
  diagnostics: Diagnostic[];
  ambiguities: ToneAmbiguity[];
  isCompliant: boolean;
  fullyCompliant: boolean;
  complianceRate: number;
  lineValidations: LineValidationSummary[];
  summary: string;
}

export interface AnalyzeLineContext {
  variantId?: string;
  globalLineIndex: number;
  sectionIndex?: number;
  lineIndexInSection?: number;
  precedingRhymes?: Array<{ char: string; rhymeGroup: string }>;
  adjacentLines?: { previous?: string; next?: string };
}

export type { PipelineInput, PipelineOutput };
export type { LineValidationSummary };

// ============ 同步分析（依赖注入） ============

/**
 * 全诗分析 —— 核心纯函数
 *
 * 依赖通过参数注入，不访问文件系统：
 * - template: AnyTemplate 实例（由调用方加载）
 * - dict: RhymeDict 实例（由调用方加载，可使用固定小字典夹具）
 */
export function analyzeSync(
  input: string,
  template: AnyTemplate,
  dict: RhymeDict,
  options: AnalyzeOptionsInternal = {},
): AnalysisResult {
  const pipelineResult = runPipeline({
    input,
    template,
    dict,
    preferredType: options.preferredType,
    variantId: options.variantId,
  });

  const { bestMatch } = pipelineResult;
  const summary = bestMatch
    ? `模板：${template.id}，匹配度 ${(bestMatch.confidence * 100).toFixed(1)}%，合律率 ${(pipelineResult.complianceRate * 100).toFixed(1)}%`
    : `模板：${template.id}（未命中可用变体）`;

  return {
    ast: pipelineResult.ast,
    matchResults: pipelineResult.matchResults,
    bestMatch: pipelineResult.bestMatch,
    diagnostics: pipelineResult.ast.diagnostics,
    ambiguities: pipelineResult.uniqueAmbiguities,
    isCompliant: pipelineResult.isCompliant,
    fullyCompliant: pipelineResult.fullyCompliant,
    complianceRate: pipelineResult.complianceRate,
    lineValidations: pipelineResult.lineValidations,
    summary,
  };
}

/**
 * 单行分析 —— 核心纯函数
 *
 * 依赖通过参数注入：
 * - template: AnyTemplate 实例（由调用方加载）
 * - dict: RhymeDict 实例（由调用方加载）
 */
export function analyzeLineSync(
  input: string,
  template: AnyTemplate,
  dict: RhymeDict,
  context: AnalyzeLineContext,
): LineValidationResult {
  const resolved = resolveLineTemplate(template, context.globalLineIndex, context.variantId);
  const diagnostics: Diagnostic[] = [];

  const { chars: annotatedChars, ambiguities } = annotateLineText(input, dict);
  if (annotatedChars.length === 0) {
    throw new Error("Empty input");
  }

  if (annotatedChars.length !== resolved.charCount) {
    diagnostics.push({
      type: "violation",
      severity: "error",
      position: { line: context.globalLineIndex },
      message: `字数不符：期望 ${resolved.charCount} 字，实际 ${annotatedChars.length} 字`,
    });
  }

  const { validatedChars, score } = validateChars(annotatedChars, resolved.expectedPattern);
  const rhymeCheck = validateRhyme(validatedChars, resolved, context.precedingRhymes, dict);

  const line: LineNode = {
    raw: input,
    chars: validatedChars,
    charCount: validatedChars.length,
    globalLineIndex: context.globalLineIndex,
    sectionIndex: resolved.sectionInfo?.index ?? context.sectionIndex,
    sectionName: resolved.sectionInfo?.name,
    lineIndexInSection: resolved.lineIndexInSection ?? context.lineIndexInSection,
    isRhymeLine: resolved.isRhymeLine,
    rhymeChar: validatedChars.at(-1),
    expectedRhymeType: resolved.expectedRhymeType,
    rhymeSwitch: resolved.rhymeSwitch,
    coupletRole: context.globalLineIndex % 2 === 0 ? "upper" : "lower",
    coupletPairIndex: Math.floor(context.globalLineIndex / 2),
    expectedPattern: resolved.expectedPattern,
    templateId: resolved.templateId,
    diagnostics,
  };

  // 拗救分析（仅诗体）
  let rescues: import("../core/types.js").RescueDetail[] = [];
  if ("pattern" in template) {
    const asMeter = template as MeterTemplate;
    const isUpper = context.globalLineIndex % 2 === 0;

    const pairText = isUpper ? context.adjacentLines?.next : context.adjacentLines?.previous;
    if (pairText) {
      const pairLineNode = _buildAnnotatedLineNode(pairText, isUpper ? context.globalLineIndex + 1 : context.globalLineIndex - 1, dict);
      if (pairLineNode) {
        const pairIndex = Math.floor(context.globalLineIndex / 2);
        const tempCouplet = isUpper
          ? { upper: line, lower: pairLineNode, coupletIndex: pairIndex, requiresDuizhang: false, diagnostics: [] }
          : { upper: pairLineNode, lower: line, coupletIndex: pairIndex, requiresDuizhang: false, diagnostics: [] };
        rescues = analyzeRescue(tempCouplet, asMeter, dict);
      }
    }
  }

  const finalizedLine = applyRescueMarks(line, rescues);
  const contextHints: string[] = [];
  contextHints.push(finalizedLine.coupletRole === "lower" ? "本句为对句" : "本句为出句");
  if (context.adjacentLines?.previous || context.adjacentLines?.next) {
    contextHints.push("已注入相邻句，可进行对仗/拗救上下文分析");
  }

  return {
    line: finalizedLine,
    expectedPattern: resolved.expectedPattern,
    actualTones: finalizedLine.chars.map((item) => item.tone ?? null),
    matchScore: score,
    diagnostics,
    ambiguities,
    rhymeCheck,
    rescues,
    contextHints,
  };
}

/** 对单行文本做词法分析+音韵标注并构建 LineNode */
function _buildAnnotatedLineNode(text: string, globalLineIndex: number, dict: RhymeDict): LineNode | null {
  const { chars } = annotateLineText(text, dict);
  if (chars.length === 0) return null;
  return { raw: text, chars, charCount: chars.length, globalLineIndex, isRhymeLine: false, diagnostics: [] };
}
