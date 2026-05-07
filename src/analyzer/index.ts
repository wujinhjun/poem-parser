/**
 * 分析器模块
 *
 * 顶层分析编排模块，协调词法分析、音韵标注、模板匹配、拗救校验等步骤。
 * 核心逻辑拆分到 pipeline.ts，各步骤独立可测试。
 *
 * @module analyzer
 */

import type { RhymeDictType } from "../core/types.js";
import type {
  Diagnostic,
  LineNode,
  LineValidationResult,
  PoemAST,
  ToneAmbiguity,
} from "../core/types.js";
import { createRhymeDict, RhymeDict } from "../rhyme-dict/index.js";
import type { AnyTemplate, CiTemplate, MeterTemplate } from "../templates/index.js";
import { getTemplateById } from "../templates/index.js";
import { analyzeRescue } from "../rescue/index.js";
import { annotateLineText } from "./ast.js";
import { validateChars, validateLineAgainstPattern, applyRescueMarks, validateRhyme, LineValidationSummary } from "./validation.js";
import { resolveLineTemplate, getTemplateType } from "./templates.js";
import { analyzeStream, analyzeStreamSync } from "./stream.js";
import { runPipeline } from "./pipeline.js";

export { analyzeStream, analyzeStreamSync };
export type { StreamAnalyzeResult, StreamSegment } from "./stream.js";
export type { PipelineInput, PipelineOutput } from "./pipeline.js";

// ============ 公共导出类型 ============

export interface AnalyzeOptions {
  rhymeDictType: RhymeDictType;
  preferredType?: "lüshi" | "jueju" | "ci";
  templateId: string;
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

export interface AnalyzeOptionsInternal {
  preferredType?: "lüshi" | "jueju" | "ci";
  variantId?: string;
  strictMode?: boolean;
}

// ============ 同步 API（依赖注入） ============

/**
 * 同步分析函数 - 核心纯函数
 *
 * 依赖通过参数注入，便于测试：
 * - dict: RhymeDict 实例（可使用固定小字典夹具）
 * - template: AnyTemplate 实例（直接传入，不通过 ID 查找）
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

// ============ 异步便捷 API ============

export async function analyze(
  input: string,
  options: AnalyzeOptions,
): Promise<AnalysisResult> {
  const dict = await createRhymeDict(options.rhymeDictType);
  const template = getTemplateById(options.templateId);
  if (!template) {
    throw new Error(`指定模板不存在: ${options.templateId}`);
  }
  return analyzeSync(input, template, dict, {
    preferredType: options.preferredType,
    variantId: options.variantId,
    strictMode: options.strictMode,
  });
}

export async function analyzeLine(
  input: string,
  context: {
    templateId: string;
    variantId?: string;
    globalLineIndex: number;
    sectionIndex?: number;
    lineIndexInSection?: number;
    precedingRhymes?: Array<{ char: string; rhymeGroup: string }>;
    adjacentLines?: { previous?: string; next?: string };
  },
  options: { rhymeDictType: RhymeDictType },
): Promise<LineValidationResult> {
  const dict = await createRhymeDict(options.rhymeDictType);
  const resolved = resolveLineTemplate(context);
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

  let rescues: import("../core/types.js").RescueDetail[] = [];
  const template = getTemplateById(context.templateId);

  if (template && "pattern" in template) {
    const asMeter = template as MeterTemplate;
    const pairIndex = Math.floor(context.globalLineIndex / 2);
    const isUpper = context.globalLineIndex % 2 === 0;

    const pairText = isUpper ? context.adjacentLines?.next : context.adjacentLines?.previous;
    if (pairText) {
      const pairLineNode = buildAnnotatedLineNode({
        text: pairText,
        globalLineIndex: isUpper ? context.globalLineIndex + 1 : context.globalLineIndex - 1,
        dict,
      });

      if (pairLineNode) {
        const tempCouplet = isUpper
          ? {
              upper: line,
              lower: pairLineNode,
              coupletIndex: pairIndex,
              requiresDuizhang: false,
              diagnostics: [],
            }
          : {
              upper: pairLineNode,
              lower: line,
              coupletIndex: pairIndex,
              requiresDuizhang: false,
              diagnostics: [],
            };
        rescues = analyzeRescue(tempCouplet, asMeter, dict);
      }
    }
  }

  const finalizedLine = applyRescueMarks(line, rescues);
  const contextHints: string[] = [];

  if (finalizedLine.coupletRole === "lower") {
    contextHints.push("本句为对句");
  } else {
    contextHints.push("本句为出句");
  }

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

export type { MatchResult } from "../matcher/index.js";
export type { AnyTemplate };

// ============ 内部工具函数 ============

function buildAnnotatedLineNode(params: {
  text: string;
  globalLineIndex: number;
  dict: RhymeDict;
}): LineNode | null {
  const { chars } = annotateLineText(params.text, params.dict);
  if (chars.length === 0) return null;

  return {
    raw: params.text,
    chars,
    charCount: chars.length,
    globalLineIndex: params.globalLineIndex,
    isRhymeLine: false,
    diagnostics: [],
  };
}
