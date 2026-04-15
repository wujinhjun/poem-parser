import {
  CharNode,
  CharValidationStatus,
  CoupletNode,
  Diagnostic,
  LineAnalysisContext,
  LineNode,
  LineValidationResult,
  PoemAST,
  RhymeDictType,
  Tone,
  ToneConstraint,
  ToneAmbiguity,
  RescueDetail,
} from "../core/types.js";
import { lex } from "../lexer/index.js";
import { matchTemplate, MatchResult } from "../matcher/index.js";
import { annotate } from "../phonology/index.js";
import { createRhymeDict, RhymeDict } from "../rhyme-dict/index.js";
import { analyzeRescue } from "../rescue/index.js";
import {
  AnyTemplate,
  CiTemplate,
  CiTemplateLine,
  CiTemplateVariant,
  getTemplateById,
  MeterTemplate,
} from "../templates/index.js";

export interface AnalyzeOptions {
  rhymeDictType: RhymeDictType;
  preferredType?: "lüshi" | "jueju" | "ci";
  templateId: string;
  variantId?: string;
  strictMode?: boolean;
}

export interface LineValidationSummary {
  lineIndex: number;
  checkableCount: number;
  matchedCount: number;
  mismatchCount: number;
  isCompliant: boolean;
  charChecks: Array<{
    col: number;
    char: string;
    expected: string;
    actual: string;
    matched: boolean;
    reason?: string;
  }>;
}

export interface AnalysisResult {
  ast: PoemAST;
  matchResults: MatchResult[];
  bestMatch: MatchResult | null;
  diagnostics: Diagnostic[];
  ambiguities: ToneAmbiguity[];
  isCompliant: boolean;
  complianceRate: number;
  lineValidations: LineValidationSummary[];
  summary: string;
}

interface ResolvedLineTemplate {
  templateId: string;
  expectedPattern: ToneConstraint[];
  charCount: number;
  isRhymeLine: boolean;
  sectionInfo?: { index: number; name: string };
  lineIndexInSection?: number;
  variantId?: string;
  expectedRhymeType?: "ping" | "ze";
  rhymeSwitch?: "ping" | "ze";
}

interface CiVariantScore {
  variant: CiTemplateVariant;
  confidence: number;
}

function buildAstFromAnnotation(
  type: "lüshi" | "jueju" | "ci",
  annotation: ReturnType<typeof annotate>,
  rawLines: string[],
  rhymeDictType: RhymeDictType,
): PoemAST {
  const lines: LineNode[] = annotation.chars.map((chars, idx) => ({
    raw: rawLines[idx] ?? chars.map((c) => c.char).join(""),
    chars,
    charCount: chars.length,
    globalLineIndex: idx,
    isRhymeLine: false,
    diagnostics: [],
  }));
  return {
    type,
    lines,
    rhymeDictType,
    diagnostics: [],
  };
}

function splitCiLines(input: string): string[] {
  const normalized = input.replace(/\r\n?/g, "\n").replace(/\s+/g, "");
  return normalized
    .split(/[，。！？；、\n]/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildLexResultFromRawLines(rawLines: string[]): {
  lines: Array<{ raw: string; chars: string[]; punctuation: string }>;
  metadata: { totalLines: number; charsPerLine: number[] };
} {
  const lines = rawLines.map((raw) => ({
    raw,
    chars: [...raw].filter((ch) => /[\u4e00-\u9fff]/u.test(ch)),
    punctuation: "",
  }));
  return {
    lines,
    metadata: {
      totalLines: lines.length,
      charsPerLine: lines.map((line) => line.chars.length),
    },
  };
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

function validateChars(
  chars: CharNode[],
  expectedPattern: ToneConstraint[],
): { validatedChars: CharNode[]; score: number } {
  let matchCount = 0;
  let checkableCount = 0;

  const validatedChars = chars.map((charNode, i) => {
    const constraint = expectedPattern[i];
    if (!constraint) {
      return { ...charNode, expectedConstraint: undefined, validationStatus: "unknown" as const };
    }

    let status: CharValidationStatus;
    switch (constraint.type) {
      case "flexible":
        status = "flexible";
        break;
      case "fixed":
        checkableCount += 1;
        if (charNode.tone === null) {
          status = "unknown";
        } else if (charNode.tone === constraint.tone) {
          status = "pass";
          matchCount += 1;
        } else {
          status = "fail";
        }
        break;
      case "rhyme":
        checkableCount += 1;
        status = charNode.tone !== null ? "pass" : "unknown";
        matchCount += 1;
        break;
      default:
        status = "unknown";
    }

    return { ...charNode, expectedConstraint: constraint, validationStatus: status };
  });

  return { validatedChars, score: checkableCount > 0 ? matchCount / checkableCount : 1 };
}

function validateLineAgainstPattern(
  line: LineNode,
  expectedPattern: ToneConstraint[] | undefined,
): LineValidationSummary {
  if (!expectedPattern) {
    return {
      lineIndex: line.globalLineIndex,
      checkableCount: 0,
      matchedCount: 0,
      mismatchCount: 0,
      isCompliant: true,
      charChecks: line.chars.map((charNode, idx) => ({
        col: idx,
        char: charNode.char,
        expected: "unknown",
        actual: charNode.tone ?? "未知",
        matched: true,
      })),
    };
  }

  let checkableCount = 0;
  let matchedCount = 0;
  let mismatchCount = 0;
  const charChecks: LineValidationSummary["charChecks"] = [];

  line.chars = line.chars.map((charNode, idx) => {
    const constraint = expectedPattern[idx];
    if (!constraint) {
      charChecks.push({
        col: idx,
        char: charNode.char,
        expected: "unknown",
        actual: charNode.tone ?? "未知",
        matched: true,
      });
      return { ...charNode, validationStatus: "unknown" as const, expectedConstraint: undefined };
    }
    if (constraint.type === "flexible") {
      charChecks.push({
        col: idx,
        char: charNode.char,
        expected: "中",
        actual: charNode.tone ?? "未知",
        matched: true,
      });
      return { ...charNode, validationStatus: "flexible" as const, expectedConstraint: constraint };
    }

    checkableCount += 1;
    const matchesFixed =
      constraint.type === "fixed" &&
      (charNode.tone === constraint.tone || (charNode.toneOptions ?? []).includes(constraint.tone));
    const matchesRhyme = constraint.type === "rhyme" && charNode.tone !== null;
    const isMatch = matchesFixed || matchesRhyme;
    if (isMatch) {
      matchedCount += 1;
      charChecks.push({
        col: idx,
        char: charNode.char,
        expected: constraint.type === "fixed" ? constraint.tone : "韵",
        actual: charNode.tone ?? "未知",
        matched: true,
      });
      return { ...charNode, validationStatus: "pass" as const, expectedConstraint: constraint };
    }

    mismatchCount += 1;
    const actualTone = charNode.tone ?? "未知";
    const unresolved = actualTone === "未知";
    charChecks.push({
      col: idx,
      char: charNode.char,
      expected: constraint.type === "fixed" ? constraint.tone : "韵",
      actual: actualTone,
      matched: false,
      reason: unresolved
        ? "tone_unresolved"
        : constraint.type === "fixed"
          ? "tone_mismatch"
          : "rhyme_unresolved",
    });
    return { ...charNode, validationStatus: "fail" as const, expectedConstraint: constraint };
  });

  return {
    lineIndex: line.globalLineIndex,
    checkableCount,
    matchedCount,
    mismatchCount,
    isCompliant: mismatchCount === 0,
    charChecks,
  };
}

function applyRescueMarks(currentLine: LineNode, rescues: RescueDetail[]): LineNode {
  if (rescues.length === 0) return currentLine;
  const rescuedCols = rescues
    .filter((item) => item.jiuPosition.line === currentLine.globalLineIndex)
    .map((item) => item.jiuPosition.col);
  if (rescuedCols.length === 0) return currentLine;

  return {
    ...currentLine,
    chars: currentLine.chars.map((char, idx) =>
      rescuedCols.includes(idx) && char.validationStatus === "fail"
        ? { ...char, validationStatus: "rescued" as const }
        : char,
    ),
  };
}

function validateRhyme(
  chars: CharNode[],
  resolvedTemplate: ResolvedLineTemplate,
  precedingRhymes: Array<{ char: string; rhymeGroup: string }> | undefined,
  dict: RhymeDict,
) {
  if (!resolvedTemplate.isRhymeLine) return undefined;
  const lastChar = chars[chars.length - 1];
  if (!lastChar) return undefined;

  let expectedRhymeGroup: string | undefined;
  let isConsistent: boolean | null = null;
  if (precedingRhymes?.length) {
    expectedRhymeGroup = precedingRhymes[0].rhymeGroup;
    isConsistent = dict.isSameRhyme(lastChar.char, precedingRhymes[0].char);
  }

  return {
    isRhymeLine: true,
    rhymeChar: lastChar.char,
    rhymeGroup: lastChar.rhymeGroup ?? "",
    expectedRhymeGroup,
    isConsistent,
  };
}

function resolveLineTemplate(context: LineAnalysisContext): ResolvedLineTemplate {
  const template = getTemplateById(context.templateId);
  if (!template) {
    throw new Error(`Template not found in analyzeLine: ${context.templateId}`);
  }

  if ("pattern" in template) {
    const meter = template as MeterTemplate;
    const expectedPattern = meter.pattern[context.globalLineIndex];
    if (!expectedPattern) {
      throw new Error(`Line index ${context.globalLineIndex} out of range for ${context.templateId}`);
    }
    return {
      templateId: meter.id,
      expectedPattern,
      charCount: expectedPattern.length,
      isRhymeLine: meter.rhymeLineIndices.includes(context.globalLineIndex),
    };
  }

  const ciTemplate = template as CiTemplate;
  const variant: CiTemplateVariant | undefined = context.variantId
    ? ciTemplate.variants.find((item) => item.id === context.variantId)
    : ciTemplate.variants[0];
  if (!variant) {
    throw new Error(`Variant not found in template ${context.templateId}`);
  }

  let resolvedLine: CiTemplateLine | undefined;
  let sectionInfo: { index: number; name: string } | undefined;
  let lineIndexInSection: number | undefined;

  if (context.sectionIndex !== undefined && context.lineIndexInSection !== undefined) {
    const section = variant.sections[context.sectionIndex];
    if (!section) {
      throw new Error(`Section index ${context.sectionIndex} out of range for ${context.templateId}`);
    }
    resolvedLine = section.lines[context.lineIndexInSection];
    if (!resolvedLine) {
      throw new Error(
        `Line index in section ${context.lineIndexInSection} out of range for ${context.templateId}`,
      );
    }
    sectionInfo = { index: context.sectionIndex, name: section.name };
    lineIndexInSection = context.lineIndexInSection;
  } else {
    const allLines = variant.sections.flatMap((section, sectionIndex) =>
      section.lines.map((line, idxInSection) => ({
        line,
        sectionIndex,
        sectionName: section.name,
        idxInSection,
      })),
    );
    const entry = allLines[context.globalLineIndex];
    if (!entry) {
      throw new Error(`Global line index ${context.globalLineIndex} out of range for ${context.templateId}`);
    }
    resolvedLine = entry.line;
    sectionInfo = { index: entry.sectionIndex, name: entry.sectionName };
    lineIndexInSection = entry.idxInSection;
  }

  return {
    templateId: ciTemplate.id,
    variantId: variant.id,
    expectedPattern: resolvedLine.pattern,
    charCount: resolvedLine.charCount,
    isRhymeLine: resolvedLine.isRhymeLine,
    expectedRhymeType: resolvedLine.rhymeType,
    rhymeSwitch: resolvedLine.rhymeSwitch,
    sectionInfo,
    lineIndexInSection,
  };
}

function getTemplateType(templateId: string): "lüshi" | "jueju" | "ci" {
  if (templateId.includes("lü")) return "lüshi";
  if (templateId.includes("jue")) return "jueju";
  return "ci";
}

function buildCouplets(ast: PoemAST): CoupletNode[] {
  const couplets: CoupletNode[] = [];
  for (let i = 0; i + 1 < ast.lines.length; i += 2) {
    const pairIndex = Math.floor(i / 2);
    const requiresDuizhang = ast.type === "lüshi" && (pairIndex === 1 || pairIndex === 2);
    const upper = ast.lines[i];
    const lower = ast.lines[i + 1];
    upper.coupletRole = "upper";
    upper.coupletPairIndex = pairIndex;
    upper.requiresDuizhang = requiresDuizhang;
    lower.coupletRole = "lower";
    lower.coupletPairIndex = pairIndex;
    lower.requiresDuizhang = requiresDuizhang;
    couplets.push({
      upper,
      lower,
      coupletIndex: pairIndex,
      requiresDuizhang,
      diagnostics: [],
    });
  }
  return couplets;
}

function applyMeterTemplateToAst(ast: PoemAST, template: MeterTemplate): void {
  for (let i = 0; i < ast.lines.length; i += 1) {
    const line = ast.lines[i];
    const expectedPattern = template.pattern[i];
    if (!line || !expectedPattern) continue;
    line.expectedPattern = expectedPattern;
    line.templateId = template.id;
    line.isRhymeLine = template.rhymeLineIndices.includes(i);
    if (line.isRhymeLine) {
      line.rhymeChar = line.chars.at(-1);
      line.expectedRhymeType = "ping";
    }
  }
  ast.couplets = buildCouplets(ast);
}

function flattenCiVariantLines(variant: CiTemplateVariant): CiTemplateLine[] {
  return variant.sections.flatMap((section) => section.lines);
}

function scoreCiVariant(lines: LineNode[], variant: CiTemplateVariant): CiVariantScore {
  const expectedLines = flattenCiVariantLines(variant);
  const lineCount = Math.max(lines.length, expectedLines.length);
  if (lineCount === 0) {
    return { variant, confidence: 0 };
  }

  let score = 0;
  for (let i = 0; i < lineCount; i += 1) {
    const actual = lines[i];
    const expected = expectedLines[i];
    if (!actual || !expected) continue;

    if (actual.charCount === expected.charCount) {
      score += 1;
    } else {
      const diff = Math.abs(actual.charCount - expected.charCount);
      score += Math.max(0, 1 - diff / Math.max(1, expected.charCount));
    }
  }
  return { variant, confidence: score / lineCount };
}

function chooseCiVariant(
  template: CiTemplate,
  astLines: LineNode[],
  variantId?: string,
): CiVariantScore | null {
  if (template.variants.length === 0) return null;
  if (variantId) {
    const specified = template.variants.find((item) => item.id === variantId);
    if (!specified) {
      throw new Error(`指定变体不存在: ${variantId}`);
    }
    return scoreCiVariant(astLines, specified);
  }

  const scored = template.variants.map((item) => scoreCiVariant(astLines, item));
  scored.sort((a, b) => b.confidence - a.confidence);
  return scored[0] ?? null;
}

function applyCiVariantToAst(
  ast: PoemAST,
  template: CiTemplate,
  variantScore: CiVariantScore,
): void {
  const variant = variantScore.variant;
  const expectedLines = flattenCiVariantLines(variant);
  ast.templateId = template.id;
  ast.type = "ci";
  ast.sections = variant.sections.map((section, sectionIndex) => ({
    sectionIndex,
    name: section.name,
    lines: [],
  }));

  for (let i = 0; i < ast.lines.length; i += 1) {
    const line = ast.lines[i];
    const expected = expectedLines[i];
    if (!line || !expected) continue;

    line.templateId = template.id;
    line.templateLineName = `${template.name}·${variant.name}·第${i + 1}句`;
    line.expectedPattern = expected.pattern;
    line.isRhymeLine = expected.isRhymeLine;
    line.expectedRhymeType = expected.rhymeType;
    line.rhymeSwitch = expected.rhymeSwitch;
    if (expected.isRhymeLine) {
      line.rhymeChar = line.chars.at(-1);
    }
  }

  let cursor = 0;
  for (let si = 0; si < variant.sections.length; si += 1) {
    const section = variant.sections[si];
    for (let li = 0; li < section.lines.length; li += 1) {
      const line = ast.lines[cursor];
      if (!line) break;
      line.sectionIndex = si;
      line.sectionName = section.name;
      line.lineIndexInSection = li;
      ast.sections[si].lines.push(line);
      cursor += 1;
    }
  }
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

export async function analyze(input: string, options: AnalyzeOptions): Promise<AnalysisResult> {
  const specifiedTemplate = getTemplateById(options.templateId);
  if (!specifiedTemplate) {
    throw new Error(`指定模板不存在: ${options.templateId}`);
  }
  const lexResult =
    specifiedTemplate && !("pattern" in specifiedTemplate)
      ? buildLexResultFromRawLines(splitCiLines(input))
      : lex(input);
  const dict = await createRhymeDict(options.rhymeDictType);
  const annotation = annotate(lexResult, dict);
  const candidates = [specifiedTemplate];

  const ast = buildAstFromAnnotation(
    options.preferredType ?? (specifiedTemplate && !("pattern" in specifiedTemplate) ? "ci" : "jueju"),
    annotation,
    lexResult.lines.map((line) => line.raw),
    options.rhymeDictType,
  );
  let matchResults: MatchResult[] = [];
  let bestMatch: MatchResult | null = null;

  if (specifiedTemplate && !("pattern" in specifiedTemplate)) {
    const ciTemplate = specifiedTemplate as CiTemplate;
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
    const meterCandidates = candidates.filter((candidate): candidate is MeterTemplate => "pattern" in candidate);
    matchResults = matchTemplate(ast, meterCandidates, dict);
    bestMatch = matchResults[0] ?? null;
  }
  ast.templateId = bestMatch?.templateId ?? options.templateId;
  if (ast.templateId) {
    ast.type = getTemplateType(ast.templateId);
  }

  const bestTemplateCandidate = ast.templateId ? getTemplateById(ast.templateId) : undefined;
  const bestMeterTemplate =
    bestTemplateCandidate && "pattern" in bestTemplateCandidate
      ? (bestTemplateCandidate as MeterTemplate)
      : null;
  if (bestMeterTemplate) {
    applyMeterTemplateToAst(ast, bestMeterTemplate);
  }

  const filteredAmbiguities = filterAmbiguitiesByBestTemplate(
    annotation.ambiguities,
    ast,
    bestMeterTemplate,
  );

  const lineValidations = ast.lines.map((line) =>
    validateLineAgainstPattern(line, line.expectedPattern),
  );
  const totalCheckable = lineValidations.reduce((sum, item) => sum + item.checkableCount, 0);
  const totalMatched = lineValidations.reduce((sum, item) => sum + item.matchedCount, 0);
  const complianceRate = totalCheckable > 0 ? totalMatched / totalCheckable : 1;
  const isCompliant = lineValidations.every((item) => item.isCompliant);

  return {
    ast,
    matchResults,
    bestMatch,
    diagnostics: ast.diagnostics,
    ambiguities: filteredAmbiguities,
    isCompliant,
    complianceRate,
    lineValidations,
    summary: bestMatch
      ? `指定模板：${options.templateId}，匹配度 ${(bestMatch.confidence * 100).toFixed(1)}%，合律率 ${(complianceRate * 100).toFixed(1)}%`
      : `指定模板：${options.templateId}（未命中可用变体）`,
  };
}

export async function analyzeLine(
  input: string,
  context: LineAnalysisContext,
  options: AnalyzeOptions,
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

  let rescues: RescueDetail[] = [];
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
