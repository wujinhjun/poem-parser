/**
 * 流式解析模块
 *
 * 按顺序解析输入文本，逐字校验与模板的匹配情况。
 * 支持输入不完整时只校验已有部分。
 *
 * @module analyzer/stream
 */

import type { ToneConstraint } from "../core/types.js";
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

/**
 * 流式解析 - 按顺序解析输入文本
 *
 * 特点：
 * - 支持诗词/词牌/律诗/绝句
 * - 按顺序解析，有字即校验
 * - 输入不完整时只校验已有部分
 * - 返回每个位置与模板的匹配情况
 *
 * @param input 输入文本（连续字符串）
 * @param templateId 模板ID
 * @param options 配置选项
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
  if (!template) {
    throw new Error(`模板不存在: ${templateId}`);
  }

  const dict = await createRhymeDict(options.rhymeDictType);

  // 根据模板类型确定解析方式
  const isCi = !("pattern" in template);

  // 流式分句：按句子分隔符号分割
  const normalized = input.replace(/\r\n?/g, "\n").replace(/\s+/g, "");
  const sentences = normalized.split(/[，。！？；、\n]/u).map((s) => s.trim()).filter(Boolean);

  // 获取每句的期望字数
  const sentenceCharCounts: number[] = [];

  if (isCi) {
    const ciTemplate = template as CiTemplate;
    const variant = options.variantId
      ? ciTemplate.variants.find((v) => v.id === options.variantId)
      : ciTemplate.variants[0];
    if (!variant) throw new Error(`变体不存在: ${options.variantId}`);

    for (const section of variant.sections) {
      for (const line of section.lines) {
        sentenceCharCounts.push(line.charCount);
      }
    }
  } else {
    const meter = template as MeterTemplate;
    for (const pattern of meter.pattern) {
      sentenceCharCounts.push(pattern.length);
    }
  }

  const segments: StreamSegment[] = [];
  const sentenceSummaries: StreamAnalyzeResult["sentenceSummaries"] = [];

  let charIndex = 0;
  let parsedSentenceCount = 0;

  for (let si = 0; si < sentences.length; si++) {
    const sentence = sentences[si];
    const expectedCount = sentenceCharCounts[si] ?? 0;
    const sentenceChars = [...sentence]; // 拆成单字

    let sentenceMatched = 0;
    let sentenceCheckable = 0;
    let sentenceMismatches: StreamSegment["validation"]["mismatches"] = [];

    for (let ci = 0; ci < sentenceChars.length; ci++) {
      const char = sentenceChars[ci];
      const col = ci;

      // 获取该位置的模板约束
      let expected: ToneConstraint | undefined;
      if (isCi) {
        const ciTemplate = template as CiTemplate;
        const variant = options.variantId
          ? ciTemplate.variants.find((v) => v.id === options.variantId)
          : ciTemplate.variants[0];
        const allLines = variant!.sections.flatMap((s) => s.lines);
        expected = allLines[si]?.pattern[col];
      } else {
        expected = (template as MeterTemplate).pattern[si]?.[col];
      }

      // 直接查字典获取音韵信息
      const entries = dict.lookup(char);
      const uniqueTones = [...new Set(entries.map((e) => e.tone))];
      const primaryTone = uniqueTones.length === 1 ? uniqueTones[0] : entries[0]?.tone ?? null;

      // 校验
      let matched = false;
      let expectedStr = "unknown";
      let actualStr = primaryTone ?? "未知";
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
          // flexible
          matched = true;
          sentenceMatched++;
        }
      } else {
        expectedStr = "unknown";
        matched = true; // 超长部分不校验
      }

      segments.push({
        segmentIndex: charIndex,
        text: char,
        charCount: 1,
        sentenceIndex: si,
        sentenceCharCount: expectedCount,
        sentenceRemaining: expectedCount - ci - 1,
        startCol: col,
        validation: {
          matchedCount: matched ? 1 : 0,
          checkableCount: expected ? 1 : 0,
          mismatches: matched ? [] : [{ col, char, expected: expectedStr, actual: actualStr, reason }],
        },
      });

      charIndex++;
    }

    // 该句结束时检查是否完整
    const isComplete = sentenceChars.length >= expectedCount;
    const isValid = sentenceMismatches.length === 0;

    sentenceSummaries.push({
      sentenceIndex: si,
      sentenceCharCount: expectedCount,
      charCount: sentenceChars.length,
      remaining: expectedCount - sentenceChars.length,
      isComplete,
      isValid,
      matchedCount: sentenceMatched,
      checkableCount: sentenceCheckable,
    });

    if (isComplete) {
      parsedSentenceCount++;
    }
  }

  return {
    templateId,
    variantId: options.variantId,
    totalSentences: sentenceCharCounts.length,
    sentenceCharCounts,
    totalCharCount: input.replace(/\s+/g, "").length,
    parsedSentenceCount,
    segments,
    sentenceSummaries,
  };
}
