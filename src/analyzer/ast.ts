/**
 * AST 构建模块
 *
 * 负责将词法分析结果和音韵标注结果构建成诗歌 AST（抽象语法树）。
 * AST 是整个分析流程的核心数据结构。
 */

import type {
  CharNode,
  CoupletNode,
  LineNode,
  PoemAST,
  RhymeDictType,
} from "../core/types.js";
import type { AnnotationResult } from "../phonology/index.js";
import type { MeterTemplate } from "../templates/index.js";

/**
 * 从标注结果构建 PoemAST
 *
 * @param type - 诗歌类型（律诗/绝句/词牌）
 * @param annotation - 音韵标注结果
 * @param rawLines - 原始行文本
 * @param rhymeDictType - 韵书类型
 * @returns 构建好的 PoemAST
 */
export function buildAstFromAnnotation(
  type: "lüshi" | "jueju" | "ci",
  annotation: AnnotationResult,
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

/**
 * 构建对句结构
 *
 * 将连续的两行配对为对句（couplet），用于后续的对仗和拗救分析。
 * 律诗的对句有特殊的对仗要求（颔联、颈联必须对仗）。
 *
 * @param ast - 诗歌 AST
 * @returns 对句数组
 */
export function buildCouplets(ast: PoemAST): CoupletNode[] {
  const couplets: CoupletNode[] = [];

  for (let i = 0; i + 1 < ast.lines.length; i += 2) {
    const pairIndex = Math.floor(i / 2);
    // 颔联（第二联）和颈联（第三联）要求对仗
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

/**
 * 将律诗模板应用到 AST
 *
 * 为每一行设置期望的平仄模式、韵脚位置等信息。
 *
 * @param ast - 诗歌 AST
 * @param template - 律诗模板
 */
export function applyMeterTemplateToAst(ast: PoemAST, template: MeterTemplate): void {
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

/**
 * 从原始行文本构建词法结果
 *
 * 用于词牌分析，将连续的文本拆分为单行。
 *
 * @param rawLines - 原始行数组
 * @returns 词法分析结果
 */
export function buildLexResultFromRawLines(
  rawLines: string[],
): {
  lines: Array<{ raw: string; chars: string[]; punctuation: string }>;
  metadata: { totalLines: number; charsPerLine: number[] };
} {
  const HANZI_RE = /[\u4e00-\u9fff]/u;

  const lines = rawLines.map((raw) => ({
    raw,
    chars: [...raw].filter((ch) => HANZI_RE.test(ch)),
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
