import { describe, expect, it } from "vitest";

import { analyze } from "../src/index.js";
import { DENG_GUANQUE_LOU } from "./fixtures/deng-guanque-lou.js";

describe("五绝·王之涣《登鹳雀楼》", () => {
  const { input, expected } = DENG_GUANQUE_LOU;

  it("应识别为五绝·仄起·首句不入韵", async () => {
    const result = await analyze(input.text, input.options);
    expect(result.bestMatch?.templateId).toBe(expected.templateId);
    expect(result.ast.type).toBe(expected.type);
    expect(result.ast.lines).toHaveLength(expected.lineCount);
  });

  it("应检测到2个韵脚（流、楼）", async () => {
    const result = await analyze(input.text, input.options);
    const rhymeChars = result.ast.lines.filter((line) => line.isRhymeLine).map((line) => line.rhymeChar?.char);
    expect(rhymeChars).toEqual(expected.rhymeChars);
  });

  it("绝句不应有对仗要求", async () => {
    const result = await analyze(input.text, input.options);
    const couplets = result.ast.couplets ?? [];
    expect(couplets.every((item) => item.requiresDuizhang === false)).toBe(true);
  });

  it("不应有多音字警告", async () => {
    const result = await analyze(input.text, input.options);
    expect(result.ambiguities).toHaveLength(0);
  });
});
