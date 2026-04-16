/**
 * 验证模块
 *
 * 负责单行验证、字符校验、拗救标记等核心校验逻辑。
 */

import type {
  CharNode,
  CharValidationStatus,
  Diagnostic,
  LineNode,
  LineValidationResult,
  RescueDetail,
  Tone,
  ToneConstraint,
  ToneAmbiguity,
} from "../core/types.js";
import type { ResolvedLineTemplate } from "./types.js";
import type { RhymeDict } from "../rhyme-dict/index.js";

/**
 * 验证单个字符是否符合模板约束
 */
function validateSingleChar(
  charNode: CharNode,
  constraint: ToneConstraint | undefined,
): { status: CharValidationStatus; isCheckable: boolean } {
  if (!constraint) {
    return { status: "unknown", isCheckable: false };
  }

  switch (constraint.type) {
    case "flexible":
      return { status: "flexible", isCheckable: false };

    case "fixed": {
      if (charNode.tone === null) {
        return { status: "unknown", isCheckable: true };
      }
      const matches = charNode.tone === constraint.tone ||
        (charNode.toneOptions ?? []).includes(constraint.tone);
      return { status: matches ? "pass" : "fail", isCheckable: true };
    }

    case "rhyme":
      return {
        status: charNode.tone !== null ? "pass" : "unknown",
        isCheckable: true,
      };

    default:
      return { status: "unknown", isCheckable: false };
  }
}

/**
 * 验证一行字符是否符合期望模式
 */
export function validateChars(
  chars: CharNode[],
  expectedPattern: ToneConstraint[],
): { validatedChars: CharNode[]; score: number } {
  let matchCount = 0;
  let checkableCount = 0;

  const validatedChars = chars.map((charNode, i) => {
    const constraint = expectedPattern[i];
    const { status, isCheckable } = validateSingleChar(charNode, constraint);

    if (isCheckable) {
      checkableCount += 1;
      if (status === "pass") matchCount += 1;
    }

    return { ...charNode, expectedConstraint: constraint, validationStatus: status };
  });

  return {
    validatedChars,
    score: checkableCount > 0 ? matchCount / checkableCount : 1,
  };
}

/**
 * 行验证摘要信息
 */
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

/**
 * 验证行是否符合平仄模式
 */
export function validateLineAgainstPattern(
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

/**
 * 应用拗救标记到行
 */
export function applyRescueMarks(currentLine: LineNode, rescues: RescueDetail[]): LineNode {
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

/**
 * 验证韵脚一致性
 */
export function validateRhyme(
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
