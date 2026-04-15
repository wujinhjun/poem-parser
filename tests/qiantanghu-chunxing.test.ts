import { describe, expect, it } from "vitest";

import { analyze, analyzeLine, Tone, ToneConstraint } from "../src/index.js";
import { QIANTANGHU_CHUNXING } from "./fixtures/qiantanghu-chunxing.js";

function formatConstraint(constraint: ToneConstraint): string {
  if (constraint.type === "fixed") return constraint.tone;
  if (constraint.type === "flexible") return "中";
  return "韵";
}

describe("七律·白居易《钱塘湖春行》", () => {
  const { input, expected } = QIANTANGHU_CHUNXING;

  it("应识别为七律·首句入韵·平起", async () => {
    const result = await analyze(input.text, input.options);
    expect(result.bestMatch?.templateId).toBe(expected.templateId);
    expect(result.ast.type).toBe(expected.type);
    expect(result.ast.lines).toHaveLength(expected.lineCount);
  });

  it("应检测到5个韵脚字", async () => {
    const result = await analyze(input.text, input.options);
    const rhymeChars = result.ast.lines.filter((line) => line.isRhymeLine).map((line) => line.rhymeChar?.char);
    expect(rhymeChars).toEqual(expected.rhymeChars);
  });

  it("颔联和颈联应标记要求对仗", async () => {
    const result = await analyze(input.text, input.options);
    const couplets = result.ast.couplets ?? [];
    expect(couplets).toHaveLength(4);
    expect(couplets[1]?.requiresDuizhang).toBe(true);
    expect(couplets[2]?.requiresDuizhang).toBe(true);
    expect(couplets[0]?.requiresDuizhang).toBe(false);
    expect(couplets[3]?.requiresDuizhang).toBe(false);
  });

  it("应检测到关键多音字：燕、泥、行、不", async () => {
    const result = await analyze(input.text, input.options);
    const chars = result.ambiguities.map((item) => item.char);
    expect(chars).toEqual(expect.arrayContaining(["燕", "泥", "行", "不"]));
  });
});

describe("逐句模式·《钱塘湖春行》第4句", () => {
  it("应正确校验谁家新燕啄春泥", async () => {
    const result = await analyzeLine(
      "谁家新燕啄春泥",
      {
        templateId: "qilü-shouju-ping",
        globalLineIndex: 3,
        precedingRhymes: [
          { char: "西", rhymeGroup: "八齐" },
          { char: "低", rhymeGroup: "八齐" },
        ],
        adjacentLines: {
          previous: "几处早莺争暖树",
        },
      },
      { rhymeDictType: "pingshui" },
    );

    expect(result.expectedPattern.map(formatConstraint)).toEqual(["中", "平", "中", "仄", "仄", "平", "韵"]);
    expect(result.rhymeCheck?.isRhymeLine).toBe(true);
    expect(result.rhymeCheck?.rhymeChar).toBe("泥");
    expect(result.rhymeCheck?.isConsistent).toBe(true);
    expect(result.ambiguities.some((item) => item.char === "燕")).toBe(true);
    expect(result.contextHints ?? []).toEqual(
      expect.arrayContaining([expect.stringContaining("对句"), expect.stringContaining("对仗")]),
    );
    const tones = result.actualTones.filter((item): item is Tone => item !== null);
    expect(tones.length).toBe(7);
  });
});
