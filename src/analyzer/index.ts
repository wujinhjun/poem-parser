/**
 * 分析器模块
 *
 * 顶层分析编排模块，协调词法分析、音韵标注、模板匹配、拗救校验等步骤。
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
import { lex } from "../lexer/index.js";
import { matchTemplate, MatchResult } from "../matcher/index.js";
import { annotate } from "../phonology/index.js";
import { createRhymeDict, RhymeDict } from "../rhyme-dict/index.js";
import { analyzeRescue } from "../rescue/index.js";
import {
  AnyTemplate,
  CiTemplate,
  getTemplateById,
  MeterTemplate,
} from "../templates/index.js";
import { buildAstFromAnnotation, buildCouplets, applyMeterTemplateToAst, buildLexResultFromRawLines } from "./ast.js";
import { validateChars, validateLineAgainstPattern, applyRescueMarks, validateRhyme, LineValidationSummary } from "./validation.js";
import { chooseCiVariant, applyCiVariantToAst } from "./ci.js";
import { resolveLineTemplate, getTemplateType } from "./templates.js";
import { analyzeStream } from "./stream.js";
import type { ResolvedLineTemplate, CiVariantScore } from "./types.js";

export { analyzeStream };
export type { StreamAnalyzeResult, StreamSegment } from "./stream.js";

// ============ 公共导出类型 ============

export interface AnalyzeOptions {
  /** 韵书类型 */
  rhymeDictType: RhymeDictType;
  /** 诗歌类型偏好 */
  preferredType?: "lüshi" | "jueju" | "ci";
  /** 模板 ID */
  templateId: string;
  /** 词牌变体 ID（仅词牌） */
  variantId?: string;
  /** 严格模式 */
  strictMode?: boolean;
}

/**
 * 分析结果接口
 */
export interface AnalysisResult {
  ast: PoemAST;
  matchResults: MatchResult[];
  bestMatch: MatchResult | null;
  diagnostics: Diagnostic[];
  ambiguities: ToneAmbiguity[];
  /** 是否符合格律（包括多音字） */
  isCompliant: boolean;
  /** 排除多音字后是否完全合规 */
  fullyCompliant: boolean;
  complianceRate: number;
  lineValidations: LineValidationSummary[];
  summary: string;
}

// ============ 同步 API（依赖注入） ============

export interface AnalyzeOptionsInternal {
  /** 诗歌类型偏好 */
  preferredType?: "lüshi" | "jueju" | "ci";
  /** 词牌变体 ID（仅词牌） */
  variantId?: string;
  /** 严格模式 */
  strictMode?: boolean;
}

/**
 * 同步分析函数 - 核心纯函数
 *
 * 依赖通过参数注入，便于测试：
 * - dict: RhymeDict 实例（可使用固定小字典夹具）
 * - template: AnyTemplate 实例（直接传入，不通过 ID 查找）
 *
 * @param input 输入文本
 * @param template 模板（MeterTemplate | CiTemplate）
 * @param dict 韵书字典
 * @param options 选项
 */
export function analyzeSync(
  input: string,
  template: AnyTemplate,
  dict: RhymeDict,
  options: AnalyzeOptionsInternal = {},
): AnalysisResult {
  // 分词
  const lexResult =
    !("pattern" in template)
      ? buildLexResultFromRawLines(splitCiLines(input))
      : lex(input);

  // 音韵标注
  const annotation = annotate(lexResult, dict);

  // 构建 AST
  const ast = buildAstFromAnnotation(
    options.preferredType ?? (!("pattern" in template) ? "ci" : "jueju"),
    annotation,
    lexResult.lines.map((line) => line.raw),
    dict.type,
  );

  let matchResults: MatchResult[] = [];
  let bestMatch: MatchResult | null = null;

  // 模板匹配
  if (!("pattern" in template)) {
    // 词牌
    const ciTemplate = template as CiTemplate;
    const variantScore = chooseCiVariant(ciTemplate, ast.lines, options.variantId);
    if (variantScore) {
      applyCiVariantToAst(ast, ciTemplate, variantScore);
      bestMatch = {
        templateId: ciTemplate.id,
        confidence: variantScore.confidence,
        toneDeviations: [],
      };
      matchResults = [bestMatch];
    }
  } else {
    // 格律诗
    const meterTemplate = template as MeterTemplate;
    matchResults = matchTemplate(ast, [meterTemplate], dict);
    bestMatch = matchResults[0] ?? null;
  }

  // 设置 AST 元数据
  ast.templateId = bestMatch?.templateId ?? template.id;
  ast.type = getTemplateType(ast.templateId);

  // 应用模板到行
  if ("pattern" in template) {
    applyMeterTemplateToAst(ast, template as MeterTemplate);
  }

  // 过滤多音字
  const bestMeterTemplate =
    bestMatch && "pattern" in template ? (template as MeterTemplate) : null;
  const filteredAmbiguities = filterAmbiguitiesByBestTemplate(
    annotation.ambiguities,
    ast,
    bestMeterTemplate,
  );

  // 按字符去重
  const seenChars = new Set<string>();
  const uniqueAmbiguities = filteredAmbiguities.filter((amb) => {
    if (seenChars.has(amb.char)) return false;
    seenChars.add(amb.char);
    return true;
  });

  // 行校验
  const lineValidations = ast.lines.map((line) =>
    validateLineAgainstPattern(line, line.expectedPattern, uniqueAmbiguities),
  );

  const totalCheckable = lineValidations.reduce((sum, item) => sum + item.checkableCount, 0);
  const totalMatched = lineValidations.reduce((sum, item) => sum + item.matchedCount, 0);
  const complianceRate = totalCheckable > 0 ? totalMatched / totalCheckable : 1;
  const isCompliant = lineValidations.every((item) => item.isCompliant);
  const fullyCompliant = lineValidations.every((item) => item.nonAmbiguousMismatchCount === 0);

  return {
    ast,
    matchResults,
    bestMatch,
    diagnostics: ast.diagnostics,
    ambiguities: uniqueAmbiguities,
    isCompliant,
    fullyCompliant,
    complianceRate,
    lineValidations,
    summary: bestMatch
      ? `模板：${template.id}，匹配度 ${(bestMatch.confidence * 100).toFixed(1)}%，合律率 ${(complianceRate * 100).toFixed(1)}%`
      : `模板：${template.id}（未命中可用变体）`,
  };
}

// ============ 异步便捷 API ============

/**
 * 异步便捷分析函数
 *
 * 内部调用 createRhymeDict 加载韵书，通过 getTemplateById 查找模板。
 * 适合快速上手，测试或正式使用时建议用 analyzeSync 配合固定字典。
 */
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

/**
 * 单行分析（异步便捷版）
 */
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
  const lexResult = lex(input);

  if (lexResult.lines.length === 0) {
    throw new Error("Empty input");
  }

  const lexLine = lexResult.lines[0];
  const diagnostics: Diagnostic[] = [];

  if (lexLine.chars.length !== resolved.charCount) {
    diagnostics.push({
      type: "violation",
      severity: "error",
      position: { line: context.globalLineIndex },
      message: `字数不符：期望 ${resolved.charCount} 字，实际 ${lexLine.chars.length} 字`,
    });
  }

  const annotation = annotate(
    {
      lines: [lexLine],
      metadata: { totalLines: 1, charsPerLine: [lexLine.chars.length] },
    },
    dict,
  );

  const chars = annotation.chars[0] ?? [];
  const { validatedChars, score } = validateChars(chars, resolved.expectedPattern);
  const rhymeCheck = validateRhyme(validatedChars, resolved, context.precedingRhymes, dict);

  const line: LineNode = {
    raw: lexLine.raw,
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

  if (line.coupletRole === "lower") {
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
    ambiguities: annotation.ambiguities,
    rhymeCheck,
    rescues,
    contextHints,
  };
}

export type { MatchResult, AnyTemplate };

// ============ 内部工具函数 ============

function splitCiLines(input: string): string[] {
  const normalized = input.replace(/\r\n?/g, "\n").replace(/\s+/g, "");
  return normalized
    .split(/[，。！？；、\n]/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildAnnotatedLineNode(params: {
  text: string;
  globalLineIndex: number;
  dict: RhymeDict;
}): LineNode | null {
  const lexResult = lex(params.text);
  const lexLine = lexResult.lines[0];
  if (!lexLine) return null;

  const annotation = annotate(
    {
      lines: [lexLine],
      metadata: { totalLines: 1, charsPerLine: [lexLine.chars.length] },
    },
    params.dict,
  );

  const chars = annotation.chars[0] ?? [];
  return {
    raw: lexLine.raw,
    chars,
    charCount: chars.length,
    globalLineIndex: params.globalLineIndex,
    isRhymeLine: false,
    diagnostics: [],
  };
}

function filterAmbiguitiesByBestTemplate(
  ambiguities: ToneAmbiguity[],
  ast: PoemAST,
  bestTemplate: MeterTemplate | null,
): ToneAmbiguity[] {
  if (!bestTemplate) return ambiguities;

  return ambiguities.filter((amb) => {
    const constraint = bestTemplate.pattern[amb.position.line]?.[amb.position.col];
    if (!constraint) return true;
    if (ast.type === "jueju" && constraint.type !== "fixed") {
      return false;
    }
    if (constraint.type !== "fixed") return true;
    const matchedOptions = amb.options.filter((item) => item.tone === constraint.tone);
    if (ast.type === "jueju" && matchedOptions.length === 1) {
      return false;
    }
    return true;
  });
}

// ============ 公共 API ============
