/**
 * 流式解析模块
 *
 * 按顺序解析输入文本，逐字校验与模板的匹配情况。
 * 支持输入不完整时只校验已有部分。
 *
 * analyzeStreamSync —— 纯函数，依赖通过参数注入
 * analyzeStream     —— 异步便捷封装
 *
 * @module analyzer/stream
 */

import type { ToneConstraint } from "../core/types.js";
import { splitSentences } from "../lexer/index.js";
import { createRhymeDict, RhymeDict } from "../rhyme-dict/index.js";
import {
  AnyTemplate,
  CiTemplate,
  getTemplateById,
  MeterTemplate,
} from "../templates/index.js";

export interface StreamSegment {
  /** 片段序号（从0开始） */
  segmentIndex: number;
  /** 片段文本 */
  text: string;
  /** 该片段字数 */
  charCount: number;
  /** 所属句序号（从0开始） */
  sentenceIndex: number;
  /** 该句总字数 */
  sentenceCharCount: number;
  /** 该句还差多少字 */
  sentenceRemaining: number;
  /** 该片段在句内的字符位置 */
  startCol: number;
  /** 校验结果 */
  validation: {
    matchedCount: number;
    checkableCount: number;
    mismatches: Array<{
      col: number;
      char: string;
      expected: string;
      actual: string;
      reason?: string;
    }>;
  };
}

export interface StreamAnalyzeResult {
  /** 模板ID */
  templateId: string;
  /** 变体ID（仅词牌） */
  variantId?: string;
  /** 模板总句数 */
  totalSentences: number;
  /** 模板每句字数 */
  sentenceCharCounts: number[];
  /** 输入总字数 */
  totalCharCount: number;
  /** 已解析句数 */
  parsedSentenceCount: number;
  /** 片段详情 */
  segments: StreamSegment[];
  /** 每句的汇总 */
  sentenceSummaries: Array<{
    sentenceIndex: number;
    sentenceCharCount: number;
    charCount: number;
    remaining: number;
    isComplete: boolean;
    isValid: boolean;
    matchedCount: number;
    checkableCount: number;
  }>;
}

// ============ 工具函数 ============

/** 从模板中提取每句的期望字数 */
export function getSentenceCharCounts(template: AnyTemplate, variantId?: string): number[] {
  if (!("pattern" in template)) {
    const ciTemplate = template as CiTemplate;
    const variant = variantId
      ? ciTemplate.variants.find((v) => v.id === variantId)
      : ciTemplate.variants[0];
    if (!variant) throw new Error(`变体不存在: ${variantId}`);
    return variant.sections.flatMap((s) => s.lines.map((l) => l.charCount));
  }
  return (template as MeterTemplate).pattern.map((p) => p.length);
}

/** 按句子索引和列索引获取模板约束 */
function getExpectedConstraint(
  template: AnyTemplate,
  sentenceIndex: number,
  col: number,
  isCi: boolean,
  variantId?: string,
): ToneConstraint | undefined {
  if (isCi) {
    const ciTemplate = template as CiTemplate;
    const variant = variantId
      ? ciTemplate.variants.find((v) => v.id === variantId)
      : ciTemplate.variants[0];
    return variant?.sections.flatMap((s) => s.lines)[sentenceIndex]?.pattern[col];
  }
  return (template as MeterTemplate).pattern[sentenceIndex]?.[col];
}

// ============ 同步核心 ============

/**
 * 流式解析（同步，依赖注入）
 *
 * 特点：
 * - 支持诗词/词牌/律诗/绝句
 * - 按顺序解析，有字即校验
 * - 输入不完整时只校验已有部分
 * - 返回每个位置与模板的匹配情况
 *
 * @param input    输入文本（连续字符串）
 * @param template 模板对象（外部注入）
 * @param dict     韵书实例（外部注入）
 * @param options  可选配置
 */
export function analyzeStreamSync(
  input: string,
  template: AnyTemplate,
  dict: RhymeDict,
  options: { variantId?: string } = {},
): StreamAnalyzeResult {
  const isCi = !("pattern" in template);
  const sentences = splitSentences(input);
  const sentenceCharCounts = getSentenceCharCounts(template, options.variantId);

  const segments: StreamSegment[] = [];
  const sentenceSummaries: StreamAnalyzeResult["sentenceSummaries"] = [];

  let charIndex = 0;
  let parsedSentenceCount = 0;

  for (let si = 0; si < sentences.length; si++) {
    const sentence = sentences[si];
    const expectedCount = sentenceCharCounts[si] ?? 0;
    const sentenceChars = [...sentence];

    let sentenceMatched = 0;
    let sentenceCheckable = 0;
    const sentenceMismatches: StreamSegment["validation"]["mismatches"] = [];

    for (let ci = 0; ci < sentenceChars.length; ci++) {
      const char = sentenceChars[ci];
      const expected = getExpectedConstraint(template, si, ci, isCi, options.variantId);

      // 查韵书获取音韵
      const entries = dict.lookup(char);
      const uniqueTones = [...new Set(entries.map((e) => e.tone))];
      const primaryTone = uniqueTones.length === 1 ? uniqueTones[0] : entries[0]?.tone ?? null;

      // 校验
      let matched = false;
      let expectedStr = "unknown";
      const actualStr = primaryTone ?? "未知";
      let reason: string | undefined;

      if (expected) {
        sentenceCheckable++;
        if (expected.type === "fixed") {
          expectedStr = expected.tone;
          if (primaryTone === expected.tone || uniqueTones.includes(expected.tone)) {
            matched = true;
            sentenceMatched++;
          } else {
            reason = primaryTone === null ? "tone_unresolved" : "tone_mismatch";
          }
        } else if (expected.type === "rhyme") {
          expectedStr = "韵";
          if (primaryTone !== null) {
            matched = true;
            sentenceMatched++;
          } else {
            reason = "rhyme_unresolved";
          }
        } else {
          matched = true;
          sentenceMatched++;
        }
      } else {
        matched = true;
      }

      segments.push({
        segmentIndex: charIndex,
        text: char,
        charCount: 1,
        sentenceIndex: si,
        sentenceCharCount: expectedCount,
        sentenceRemaining: expectedCount - ci - 1,
        startCol: ci,
        validation: {
          matchedCount: matched ? 1 : 0,
          checkableCount: expected ? 1 : 0,
          mismatches: matched ? [] : [{ col: ci, char, expected: expectedStr, actual: actualStr, reason }],
        },
      });

      charIndex++;
    }

    const isComplete = sentenceChars.length >= expectedCount;

    sentenceSummaries.push({
      sentenceIndex: si,
      sentenceCharCount: expectedCount,
      charCount: sentenceChars.length,
      remaining: expectedCount - sentenceChars.length,
      isComplete,
      isValid: sentenceMismatches.length === 0,
      matchedCount: sentenceMatched,
      checkableCount: sentenceCheckable,
    });

    if (isComplete) parsedSentenceCount++;
  }

  return {
    templateId: template.id,
    variantId: options.variantId,
    totalSentences: sentenceCharCounts.length,
    sentenceCharCounts,
    totalCharCount: input.replace(/\s+/g, "").length,
    parsedSentenceCount,
    segments,
    sentenceSummaries,
  };
}

// ============ 异步便捷 API ============

/**
 * 流式解析（异步便捷封装）
 *
 * 内部加载韵书和模板，适合快速调用。
 * 对性能和可测试性有要求时，请使用 analyzeStreamSync 注入依赖。
 */
export async function analyzeStream(
  input: string,
  templateId: string,
  options: {
    variantId?: string;
    rhymeDictType: "cilin" | "pingshui" | "zhonghua_new";
  },
): Promise<StreamAnalyzeResult> {
  const template = getTemplateById(templateId);
  if (!template) throw new Error(`模板不存在: ${templateId}`);
  const dict = await createRhymeDict(options.rhymeDictType);
  return analyzeStreamSync(input, template, dict, { variantId: options.variantId });
}
