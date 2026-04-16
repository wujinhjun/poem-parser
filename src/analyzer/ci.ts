/**
 * 词牌分析模块
 *
 * 负责词牌的变体选择、模式匹配和 AST 应用。
 */

import type { LineNode, PoemAST } from "../core/types.js";
import type { CiTemplate, CiTemplateLine, CiTemplateVariant } from "../templates/index.js";
import type { CiVariantScore } from "./types.js";

/**
 * 将词牌变体的所有行展平
 */
export function flattenCiVariantLines(variant: CiTemplateVariant): CiTemplateLine[] {
  return variant.sections.flatMap((section) => section.lines);
}

/**
 * 对词牌变体进行评分
 *
 * 基于行数和每行字数与期望的匹配程度计算置信度。
 */
export function scoreCiVariant(lines: LineNode[], variant: CiTemplateVariant): CiVariantScore {
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

/**
 * 选择最佳词牌变体
 *
 * @param template - 词牌模板
 * @param astLines - AST 中的行
 * @param variantId - 可选的指定变体 ID
 * @returns 评分最高的变体，或 null
 */
export function chooseCiVariant(
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

/**
 * 将词牌变体应用到 AST
 */
export function applyCiVariantToAst(
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

  // 应用到每一行
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

  // 构建段落结构
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
