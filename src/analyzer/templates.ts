/**
 * 模板解析工具
 *
 * 提供模板查找、解析等内部工具函数。
 *
 * @module analyzer/templates
 */

import type {
  AnyTemplate,
  CiTemplate,
  CiTemplateVariant,
  MeterTemplate,
} from "../templates/index.js";
import type { ResolvedLineTemplate } from "./types.js";

/**
 * 判断模板类型（纯函数，仅基于 ID 字符串判断）
 */
export function getTemplateType(templateId: string): "lüshi" | "jueju" | "ci" {
  if (templateId.includes("lü")) return "lüshi";
  if (templateId.includes("jue")) return "jueju";
  return "ci";
}

/**
 * 解析行模板（纯函数 —— 直接接受 template 对象）
 *
 * 根据模板对象和全局行索引，返回该行的详细模板约束。
 * 不依赖 getTemplateById，调用方负责传入已解析的 template。
 */
export function resolveLineTemplate(
  template: AnyTemplate,
  globalLineIndex: number,
  variantId?: string,
): ResolvedLineTemplate {
  if ("pattern" in template) {
    const meter = template as MeterTemplate;
    const expectedPattern = meter.pattern[globalLineIndex];
    if (!expectedPattern) {
      throw new Error(`Line index ${globalLineIndex} out of range for ${meter.id}`);
    }
    return {
      templateId: meter.id,
      expectedPattern,
      charCount: expectedPattern.length,
      isRhymeLine: meter.rhymeLineIndices.includes(globalLineIndex),
    };
  }

  const ciTemplate = template as CiTemplate;
  const variant: CiTemplateVariant | undefined = variantId
    ? ciTemplate.variants.find((item) => item.id === variantId)
    : ciTemplate.variants[0];
  if (!variant) {
    throw new Error(`Variant not found: ${ciTemplate.id}`);
  }

  const allLines = variant.sections.flatMap((section, sectionIndex) =>
    section.lines.map((line, idxInSection) => ({
      line,
      sectionIndex,
      sectionName: section.name,
      idxInSection,
    })),
  );

  const entry = allLines[globalLineIndex];
  if (!entry) {
    throw new Error(`Global line index ${globalLineIndex} out of range for ${ciTemplate.id}`);
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
