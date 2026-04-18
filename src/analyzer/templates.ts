/**
 * 模板解析工具
 *
 * 提供模板查找、解析等内部工具函数。
 *
 * @module analyzer/templates
 */

import {
  AnyTemplate,
  CiTemplate,
  CiTemplateVariant,
  getTemplateById,
  MeterTemplate,
} from "../templates/index.js";
import type { ResolvedLineTemplate } from "./types.js";

/**
 * 判断模板类型
 */
export function getTemplateType(templateId: string): "lüshi" | "jueju" | "ci" {
  if (templateId.includes("lü")) return "lüshi";
  if (templateId.includes("jue")) return "jueju";
  return "ci";
}

/**
 * 解析行模板
 *
 * 根据全局行索引和模板信息，返回该行的详细模板约束。
 */
export function resolveLineTemplate(context: {
  templateId: string;
  variantId?: string;
  globalLineIndex: number;
  sectionIndex?: number;
  lineIndexInSection?: number;
}): ResolvedLineTemplate {
  const template = getTemplateById(context.templateId);
  if (!template) {
    throw new Error(`Template not found: ${context.templateId}`);
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
    throw new Error(`Variant not found: ${context.templateId}`);
  }

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

  const resolvedLine = entry.line;
  return {
    templateId: ciTemplate.id,
    variantId: variant.id,
    expectedPattern: resolvedLine.pattern,
    charCount: resolvedLine.charCount,
    isRhymeLine: resolvedLine.isRhymeLine,
    expectedRhymeType: resolvedLine.rhymeType,
    rhymeSwitch: resolvedLine.rhymeSwitch,
    sectionInfo: { index: entry.sectionIndex, name: entry.sectionName },
    lineIndexInSection: entry.idxInSection,
  };
}
