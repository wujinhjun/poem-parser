/**
 * 测试辅助函数
 *
 * 提供向后兼容的便捷封装，避免每个测试文件重复加载逻辑。
 * 仅在测试中使用，非公开 API。
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RhymeDictType, LineValidationResult } from "../src/core/types.js";
import type { AnyTemplate, CiTemplate } from "../src/templates/index.js";
import type { AnalysisResult, AnalyzeLineContext } from "../src/analyzer/kernel.js";
import { analyzeSync, analyzeLineSync } from "../src/analyzer/kernel.js";
import { analyzeStreamSync, getSentenceCharCounts, StreamAnalyzeResult } from "../src/analyzer/stream.js";
import { createRhymeDict } from "../src/rhyme-dict/loader.js";
import { loadMeterTemplates } from "../src/templates/meters.js";

const DATA_DIR = resolve("./data");
const BUNDLE_PATH = resolve(DATA_DIR, "ci-tunes-bundle.json");

let _ciBundle: Record<string, CiTemplate> | null = null;

function loadCiBundle(): Record<string, CiTemplate> {
  if (!_ciBundle) {
    _ciBundle = JSON.parse(readFileSync(BUNDLE_PATH, "utf8"));
  }
  return _ciBundle!;
}

export function getTemplateById(id: string): AnyTemplate | undefined {
  const meter = loadMeterTemplates().find((t) => t.id === id);
  if (meter) return meter;
  const bundle = loadCiBundle();
  return bundle[id];
}

export async function analyze(
  input: string,
  options: { rhymeDictType: RhymeDictType; templateId: string; variantId?: string; preferredType?: string },
): Promise<AnalysisResult> {
  const dict = await createRhymeDict(options.rhymeDictType, DATA_DIR);
  const template = getTemplateById(options.templateId);
  if (!template) throw new Error(`指定模板不存在: ${options.templateId}`);
  return analyzeSync(input, template, dict, {
    preferredType: options.preferredType as any,
    variantId: options.variantId,
  });
}

export async function analyzeLine(
  input: string,
  context: { templateId: string; variantId?: string; globalLineIndex: number; precedingRhymes?: any; adjacentLines?: any },
  options: { rhymeDictType: RhymeDictType },
): Promise<LineValidationResult> {
  const dict = await createRhymeDict(options.rhymeDictType, DATA_DIR);
  const template = getTemplateById(context.templateId);
  if (!template) throw new Error(`指定模板不存在: ${context.templateId}`);
  return analyzeLineSync(input, template, dict, {
    variantId: context.variantId,
    globalLineIndex: context.globalLineIndex,
    precedingRhymes: context.precedingRhymes,
    adjacentLines: context.adjacentLines,
  });
}

export async function analyzeStream(
  input: string,
  templateId: string,
  options: { variantId?: string; rhymeDictType: RhymeDictType },
): Promise<StreamAnalyzeResult> {
  const dict = await createRhymeDict(options.rhymeDictType, DATA_DIR);
  const template = getTemplateById(templateId);
  if (!template) throw new Error(`模板不存在: ${templateId}`);
  return analyzeStreamSync(input, template, dict, { variantId: options.variantId });
}
