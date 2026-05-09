import { describe, expect, it } from "vitest";
import { matchTemplate } from "../src/matcher/index.js";
import { Tone } from "../src/core/types.js";
import type { PoemAST, ToneConstraint } from "../src/core/types.js";
import { createCharNode } from "../src/core/factories.js";
import type { MeterTemplate } from "../src/templates/index.js";

/** 从音调数组构造 AST 行 */
function makeLineNode(tones: (Tone | null)[], lineIndex: number) {
  return {
    raw: tones.map(() => "测").join(""),
    chars: tones.map((tone, i) =>
      createCharNode({ char: "测", line: lineIndex, col: i, global: lineIndex * 10 + i, tone }),
    ),
    charCount: tones.length,
    globalLineIndex: lineIndex,
    isRhymeLine: false,
    diagnostics: [] as any[],
  };
}

function makeAst(lines: (Tone | null)[][]): PoemAST {
  return {
    type: "jueju",
    lines: lines.map((tones, i) => makeLineNode(tones, i)),
    rhymeDictType: "cilin",
    diagnostics: [],
  };
}

function meterTemplate(pattern: ToneConstraint[][]): MeterTemplate {
  return {
    id: "test-meter",
    type: "jueju",
    name: "测试格律",
    charPerLine: pattern[0]?.length as 5 | 7,
    lineCount: pattern.length as 4 | 8,
    pattern,
    rhymeLineIndices: [1, 3],
  };
}

describe("matcher 模块 - matchTemplate", () => {
  it("完全匹配应返回置信度 1", () => {
    const ast = makeAst([
      [Tone.Ping, Tone.Ze, Tone.Ping, Tone.Ze, Tone.Ping],
      [Tone.Ze, Tone.Ping, Tone.Ze, Tone.Ping, Tone.Ze],
    ]);
    const pattern: ToneConstraint[][] = [
      [
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ze },
        { type: "flexible" },
        { type: "fixed", tone: Tone.Ze },
        { type: "rhyme" },
      ],
      [
        { type: "fixed", tone: Tone.Ze },
        { type: "fixed", tone: Tone.Ping },
        { type: "flexible" },
        { type: "fixed", tone: Tone.Ping },
        { type: "rhyme" },
      ],
    ];
    const results = matchTemplate(ast, [meterTemplate(pattern)]);
    expect(results).toHaveLength(1);
    expect(results[0].confidence).toBe(1);
    expect(results[0].toneDeviations).toEqual([]);
  });

  it("存在平仄偏差时应降低置信度并记录偏差", () => {
    const ast = makeAst([
      [Tone.Ping, Tone.Ping, Tone.Ping, Tone.Ping, Tone.Ping],
    ]);
    const pattern: ToneConstraint[][] = [
      [
        { type: "fixed", tone: Tone.Ze },
        { type: "fixed", tone: Tone.Ze },
        { type: "fixed", tone: Tone.Ze },
        { type: "fixed", tone: Tone.Ze },
        { type: "rhyme" },
      ],
    ];
    const results = matchTemplate(ast, [meterTemplate(pattern)]);
    expect(results).toHaveLength(1);
    expect(results[0].confidence).toBeLessThan(1);
    expect(results[0].toneDeviations.length).toBeGreaterThan(0);
  });

  it("多音字选项匹配应视为正确", () => {
    // 主音是平，但 toneOptions 包含仄 → 应匹配
    const ast = makeAst([[Tone.Ping, Tone.Ping, Tone.Ping, Tone.Ping, Tone.Ping]]);
    // 手动给字符加 toneOptions
    ast.lines[0].chars[0].toneOptions = [Tone.Ping, Tone.Ze];

    const pattern: ToneConstraint[][] = [
      [
        { type: "fixed", tone: Tone.Ze },
        { type: "fixed", tone: Tone.Ze },
        { type: "fixed", tone: Tone.Ze },
        { type: "fixed", tone: Tone.Ze },
        { type: "rhyme" },
      ],
    ];
    const results = matchTemplate(ast, [meterTemplate(pattern)]);
    // col0 主音不匹配但 toneOptions 包含仄 → 不应计入偏差
    const col0Deviation = results[0].toneDeviations.find((d) => d.col === 0);
    expect(col0Deviation).toBeUndefined();
  });

  it("多模板应返回按置信度排序的结果", () => {
    const ast = makeAst([
      [Tone.Ping, Tone.Ze, Tone.Ping, Tone.Ze, Tone.Ping],
    ]);
    const goodTemplate: MeterTemplate = {
      id: "good",
      type: "jueju",
      name: "好模板",
      charPerLine: 5,
      lineCount: 1,
      pattern: [
        [
          { type: "fixed", tone: Tone.Ping },
          { type: "fixed", tone: Tone.Ze },
          { type: "fixed", tone: Tone.Ping },
          { type: "fixed", tone: Tone.Ze },
          { type: "rhyme" },
        ],
      ],
      rhymeLineIndices: [0],
    };
    const badTemplate: MeterTemplate = {
      id: "bad",
      type: "jueju",
      name: "差模板",
      charPerLine: 5,
      lineCount: 1,
      pattern: [
        [
          { type: "fixed", tone: Tone.Ze },
          { type: "fixed", tone: Tone.Ze },
          { type: "fixed", tone: Tone.Ze },
          { type: "fixed", tone: Tone.Ze },
          { type: "rhyme" },
        ],
      ],
      rhymeLineIndices: [0],
    };
    const results = matchTemplate(ast, [badTemplate, goodTemplate]);
    expect(results[0].templateId).toBe("good");
    expect(results[0].confidence).toBeGreaterThan(results[1].confidence);
  });

  it("无 checkable 项时应返回置信度 0", () => {
    const ast = makeAst([
      [Tone.Ping, Tone.Ping],
    ]);
    const pattern: ToneConstraint[][] = [
      [
        { type: "flexible" },
        { type: "flexible" },
      ],
    ];
    const results = matchTemplate(ast, [meterTemplate(pattern)]);
    // 全是 flexible，没有 checkable 的 fixed
    expect(results[0].confidence).toBe(0);
  });

  it("行或 pattern 不存在时应跳过", () => {
    const ast = makeAst([
      [Tone.Ping, Tone.Ping],
    ]);
    const pattern: ToneConstraint[][] = [
      [
        { type: "fixed", tone: Tone.Ze },
      ],
      [
        { type: "fixed", tone: Tone.Ze },
      ],
    ];
    // ast 只有1行，template 有2行 → 第2行应被跳过
    const results = matchTemplate(ast, [meterTemplate(pattern)]);
    expect(results).toHaveLength(1);
  });

  it("非 MeterTemplate 应被跳过", () => {
    const ast = makeAst([[Tone.Ping]]);
    const results = matchTemplate(ast, [
      { id: "ci-tune", name: "词牌", variants: [] } as any,
    ]);
    expect(results).toEqual([]);
  });
});
