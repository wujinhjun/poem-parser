/**
 * 分析管线步骤
 *
 * 将 analyzeSync 拆分为独立步骤，每步输入输出类型清晰，便于单元测试。
 * 每步是纯函数，前一步的输出作为下一步的输入。
 *
 * @module analyzer/pipeline
 */

import type { RhymeDictType, ToneAmbiguity, PoemAST } from "../core/types.js";
import { lex, splitSentences, LexResult } from "../lexer/index.js";
import { matchTemplate, MatchResult } from "../matcher/index.js";
import { annotate, AnnotationResult } from "../phonology/index.js";
import type { RhymeDict } from "../rhyme-dict/index.js";
import type { CiTemplate, MeterTemplate, AnyTemplate } from "../templates/index.js";
import { buildAstFromAnnotation, applyMeterTemplateToAst, buildLexResultFromRawLines } from "./ast.js";
import { validateLineAgainstPattern, LineValidationSummary } from "./validation.js";
import { chooseCiVariant, applyCiVariantToAst } from "./ci.js";
import { getTemplateType } from "./templates.js";

// ============ 公共类型 ============

export interface PipelineInput {
  input: string;
  template: AnyTemplate;
  dict: RhymeDict;
  preferredType?: "lüshi" | "jueju" | "ci";
  variantId?: string;
}

export interface PipelineOutput {
  ast: PoemAST;
  matchResults: MatchResult[];
  bestMatch: MatchResult | null;
  uniqueAmbiguities: ToneAmbiguity[];
  lineValidations: LineValidationSummary[];
  complianceRate: number;
  isCompliant: boolean;
  fullyCompliant: boolean;
}

export interface LexStepResult {
  lexResult: LexResult;
  isCi: boolean;
}

// ============ 步骤1：分词 ============

/**
 * 统一分词 —— 无论诗体还是词牌，都输出 LexResult。
 * 诗体用标准词法分析（含标题检测），词牌按标点分句后构造 LexResult。
 */
export function lexStep(input: string, template: AnyTemplate): LexStepResult {
  const isCi = !("pattern" in template);
  if (isCi) {
    return { lexResult: buildLexResultFromRawLines(splitSentences(input)), isCi };
  }
  return { lexResult: lex(input), isCi: false };
}

// ============ 步骤2：音韵标注 ============

/** 对分词结果做音韵标注，为每字标平仄和韵部 */
export function annotateStep(lexResult: LexResult, dict: RhymeDict): AnnotationResult {
  return annotate(lexResult, dict);
}

// ============ 步骤3：构建 AST ============

/** 从标注结果构建 PoemAST */
export function buildAst(
  annotation: AnnotationResult,
  rawLines: string[],
  type: "lüshi" | "jueju" | "ci",
  dictType: RhymeDictType,
): PoemAST {
  return buildAstFromAnnotation(type, annotation, rawLines, dictType);
}

// ============ 步骤4：模板匹配 ============

/**
 * 模板匹配 —— 诗体比较 pattern，词牌选择最佳变体。
 * 注意：词牌匹配会将变体信息写回 AST（副作用），诗体不写回。
 */
export function matchStep(
  ast: PoemAST,
  template: AnyTemplate,
  variantId?: string,
): { matchResults: MatchResult[]; bestMatch: MatchResult | null } {
  if (!("pattern" in template)) {
    const ciTemplate = template as CiTemplate;
    const variantScore = chooseCiVariant(ciTemplate, ast.lines, variantId);
    if (!variantScore) return { matchResults: [], bestMatch: null };

    applyCiVariantToAst(ast, ciTemplate, variantScore);
    const bestMatch: MatchResult = {
      templateId: ciTemplate.id,
      confidence: variantScore.confidence,
      toneDeviations: [],
    };
    return { matchResults: [bestMatch], bestMatch };
  }

  const meterTemplate = template as MeterTemplate;
  const matchResults = matchTemplate(ast, [meterTemplate]);
  return { matchResults, bestMatch: matchResults[0] ?? null };
}

// ============ 步骤5：应用模板到 AST ============

/** 将匹配到的模板写入 AST（设置每行的 expectedPattern、韵脚信息、对句结构等） */
export function applyTemplate(
  ast: PoemAST,
  template: AnyTemplate,
  bestMatch: MatchResult | null,
): void {
  ast.templateId = bestMatch?.templateId ?? template.id;
  ast.type = getTemplateType(ast.templateId);

  if ("pattern" in template) {
    applyMeterTemplateToAst(ast, template as MeterTemplate);
  }
}

// ============ 步骤6：过滤多音字歧义 ============

/**
 * 根据最佳匹配模板过滤多音字歧义，并去重。
 * 若某多音字的某个读音符合模板约束，则不再视为歧义。
 */
export function resolveAmbiguities(
  ambiguities: ToneAmbiguity[],
  ast: PoemAST,
  template: AnyTemplate,
  bestMatch: MatchResult | null,
): ToneAmbiguity[] {
  const bestMeterTemplate =
    bestMatch && "pattern" in template ? (template as MeterTemplate) : null;
  const filtered = _filterByBestTemplate(ambiguities, ast, bestMeterTemplate);

  const seenChars = new Set<string>();
  return filtered.filter((amb) => {
    if (seenChars.has(amb.char)) return false;
    seenChars.add(amb.char);
    return true;
  });
}

function _filterByBestTemplate(
  ambiguities: ToneAmbiguity[],
  ast: PoemAST,
  bestTemplate: MeterTemplate | null,
): ToneAmbiguity[] {
  if (!bestTemplate) return ambiguities;

  return ambiguities.filter((amb) => {
    const constraint = bestTemplate.pattern[amb.position.line]?.[amb.position.col];
    if (!constraint) return true;
    if (ast.type === "jueju" && constraint.type !== "fixed") return false;
    if (constraint.type !== "fixed") return true;
    const matchedOptions = amb.options.filter((item) => item.tone === constraint.tone);
    if (ast.type === "jueju" && matchedOptions.length === 1) return false;
    return true;
  });
}

// ============ 步骤7：行校验 ============

/** 校验每一行是否符合平仄模式，计算整体合规率 */
export function validate(
  ast: PoemAST,
  uniqueAmbiguities: ToneAmbiguity[],
): {
  lineValidations: LineValidationSummary[];
  complianceRate: number;
  isCompliant: boolean;
  fullyCompliant: boolean;
} {
  const lineValidations = ast.lines.map((line) =>
    validateLineAgainstPattern(line, line.expectedPattern, uniqueAmbiguities),
  );

  const totalCheckable = lineValidations.reduce((sum, item) => sum + item.checkableCount, 0);
  const totalMatched = lineValidations.reduce((sum, item) => sum + item.matchedCount, 0);
  const complianceRate = totalCheckable > 0 ? totalMatched / totalCheckable : 1;
  const isCompliant = lineValidations.every((item) => item.isCompliant);
  const fullyCompliant = lineValidations.every((item) => item.nonAmbiguousMismatchCount === 0);

  return { lineValidations, complianceRate, isCompliant, fullyCompliant };
}

// ============ 完整管线 ============

export function runPipeline(input: PipelineInput): PipelineOutput {
  const { input: text, template, dict, preferredType, variantId } = input;

  // 1. 分词
  const { lexResult, isCi } = lexStep(text, template);
  const rawLines = lexResult.lines.map((l) => l.raw);

  // 2. 标注
  const annotation = annotateStep(lexResult, dict);

  // 3. 建 AST
  const type = preferredType ?? (isCi ? "ci" : "jueju");
  const ast = buildAst(annotation, rawLines, type, dict.type);

  // 4. 匹配
  const { matchResults, bestMatch } = matchStep(ast, template, variantId);

  // 5. 应用模板
  applyTemplate(ast, template, bestMatch);

  // 6. 解析歧义
  const uniqueAmbiguities = resolveAmbiguities(annotation.ambiguities, ast, template, bestMatch);

  // 7. 校验
  const { lineValidations, complianceRate, isCompliant, fullyCompliant } = validate(ast, uniqueAmbiguities);

  return {
    ast,
    matchResults,
    bestMatch,
    uniqueAmbiguities,
    lineValidations,
    complianceRate,
    isCompliant,
    fullyCompliant,
  };
}
