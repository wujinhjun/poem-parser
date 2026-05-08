import { describe, expect, it } from "vitest";
import { analyzeLine } from "./_helpers.js";
import { validateLineAgainstPattern, validateChars } from "../src/analyzer/validation.js";
import type { LineNode, ToneConstraint } from "../src/core/types.js";
import { Tone } from "../src/core/types.js";

describe("analyzeLine 单行解析", () => {
  it("应正确解析水调歌头第一句", async () => {
    const result = await analyzeLine(
      "明月几时有",
      {
        templateId: "水调歌头",
        variantId: "水调歌头-v3",
        globalLineIndex: 0,
      },
      { rhymeDictType: "cilin" }
    );
    expect(result.line.charCount).toBe(5);
    expect(result.matchScore).toBe(1);
  });

  it("应在字数不符时返回诊断信息", async () => {
    const result = await analyzeLine(
      "明月几",
      {
        templateId: "水调歌头",
        variantId: "水调歌头-v3",
        globalLineIndex: 0,
      },
      { rhymeDictType: "cilin" }
    );
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0].type).toBe("violation");
    expect(result.diagnostics[0].message).toContain("字数不符");
  });

  it("应正确解析律诗", async () => {
    const result = await analyzeLine(
      "白日依山尽",
      {
        templateId: "qijue-pingqi",
        globalLineIndex: 0,
      },
      { rhymeDictType: "cilin" }
    );
    expect(result.line.charCount).toBe(5);
  });

  it("应在空输入时抛出错误", async () => {
    await expect(
      analyzeLine("", { templateId: "水调歌头", globalLineIndex: 0 }, { rhymeDictType: "cilin" })
    ).rejects.toThrow("Empty input");
  });

  it("应返回上下文提示", async () => {
    const result = await analyzeLine(
      "黄河入海流",
      {
        templateId: "qijue-pingqi",
        globalLineIndex: 2,
        adjacentLines: { previous: "白日依山尽" },
      },
      { rhymeDictType: "cilin" }
    );
    expect(result.contextHints).toBeDefined();
    expect(result.contextHints?.length).toBeGreaterThan(0);
  });
});

describe("validation.ts 校验逻辑", () => {
  const createMockChars = (tones: (Tone | null)[]): import("../src/core/types.js").CharNode[] =>
    tones.map((tone, i) => ({
      char: "测",
      tone: tone,
      toneOptions: tone ? [tone] : undefined,
      position: { line: 0, col: i, global: i },
      global: i,
    }));

  it("validateChars 应返回正确分数", () => {
    const chars = createMockChars([Tone.Ping, Tone.Ze, Tone.Ping, Tone.Ze, Tone.Ping]);
    const pattern: ToneConstraint[] = [
      { type: "fixed", tone: Tone.Ping },
      { type: "fixed", tone: Tone.Ze },
      { type: "fixed", tone: Tone.Ping },
      { type: "fixed", tone: Tone.Ze },
      { type: "rhyme" },
    ];
    const { score } = validateChars(chars, pattern);
    expect(score).toBe(1);
  });

  it("validateChars 应处理 flexible 约束", () => {
    const chars = createMockChars([Tone.Ping, Tone.Ze, Tone.Ping, Tone.Ze, null]);
    const pattern: ToneConstraint[] = [
      { type: "flexible" },
      { type: "flexible" },
      { type: "flexible" },
      { type: "flexible" },
      { type: "flexible" },
    ];
    const { score } = validateChars(chars, pattern);
    expect(score).toBe(1);
  });

  it("validateChars 应处理未知字符", () => {
    const chars = createMockChars([null, null, null, null, null]);
    const pattern: ToneConstraint[] = Array(5).fill(null);
    const { score } = validateChars(chars, pattern);
    expect(score).toBe(1);
  });

  it("validateChars 应检测不匹配", () => {
    const chars = createMockChars([Tone.Ping, Tone.Ping, Tone.Ping, Tone.Ping, Tone.Ping]);
    const pattern: ToneConstraint[] = [
      { type: "fixed", tone: Tone.Ze },
      { type: "fixed", tone: Tone.Ze },
      { type: "fixed", tone: Tone.Ze },
      { type: "fixed", tone: Tone.Ze },
      { type: "fixed", tone: Tone.Ze },
    ];
    const { score } = validateChars(chars, pattern);
    expect(score).toBe(0);
  });

  it("validateLineAgainstPattern 应正确处理空模板", () => {
    const line: LineNode = {
      raw: "测试",
      chars: createMockChars([Tone.Ping, Tone.Ping]),
      charCount: 2,
      globalLineIndex: 0,
      isRhymeLine: false,
      diagnostics: [],
    };
    const result = validateLineAgainstPattern(line, undefined, []);
    expect(result.isCompliant).toBe(true);
    expect(result.checkableCount).toBe(0);
  });

  it("validateLineAgainstPattern 应检测韵脚行", () => {
    const chars = createMockChars([Tone.Ping, Tone.Ze, Tone.Ping, Tone.Ze, Tone.Ping]);
    const pattern: ToneConstraint[] = [
      { type: "fixed", tone: Tone.Ping },
      { type: "fixed", tone: Tone.Ze },
      { type: "fixed", tone: Tone.Ping },
      { type: "fixed", tone: Tone.Ze },
      { type: "rhyme" },
    ];
    const line: LineNode = {
      raw: "测试文本",
      chars,
      charCount: 5,
      globalLineIndex: 0,
      isRhymeLine: false,
      diagnostics: [],
    };
    const result = validateLineAgainstPattern(line, pattern, []);
    expect(result.checkableCount).toBe(5);
    expect(result.mismatchCount).toBe(0);
  });
});
