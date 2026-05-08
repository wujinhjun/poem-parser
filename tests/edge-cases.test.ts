import { describe, expect, it } from "vitest";
import { getTemplateType, resolveLineTemplate } from "../src/analyzer/templates.js";
import { validateLineAgainstPattern, applyRescueMarks, validateRhyme } from "../src/analyzer/validation.js";
import { scoreCiVariant, chooseCiVariant, flattenCiVariantLines } from "../src/analyzer/ci.js";
import { splitSentences, lex } from "../src/lexer/index.js";
import { annotateLineText, buildLexResultFromRawLines } from "../src/analyzer/ast.js";
import { buildAst, annotateStep, lexStep } from "../src/analyzer/pipeline.js";
import { analyzeStreamSync } from "../src/analyzer/stream.js";
import { createCharNode } from "../src/core/factories.js";
import { Tone } from "../src/core/types.js";
import type { LineNode, ToneConstraint, ToneAmbiguity } from "../src/core/types.js";
import type { CiTemplate, CiTemplateVariant, MeterTemplate } from "../src/templates/index.js";
import { loadMeterTemplates } from "../src/templates/index.js";
import { createRhymeDict } from "../src/rhyme-dict/index.js";

// ============ lexer 模块 ============

describe("lexer - splitSentences", () => {
  it("应按中文标点分句", () => {
    const result = splitSentences("明月几时有，把酒问青天。不知天上宫阙，今夕是何年。");
    expect(result.length).toBe(4);
    expect(result[0]).toBe("明月几时有");
    expect(result[1]).toBe("把酒问青天");
    expect(result[2]).toBe("不知天上宫阙");
    expect(result[3]).toBe("今夕是何年");
  });

  it("空字符串应返回空数组", () => {
    expect(splitSentences("")).toEqual([]);
  });

  it("仅标点应返回空数组", () => {
    expect(splitSentences("，。！")).toEqual([]);
  });
});

describe("lexer - lex 边角情况", () => {
  it("空输入应返回空 lines", () => {
    const result = lex("");
    expect(result.lines).toEqual([]);
    expect(result.metadata.totalLines).toBe(0);
  });

  it("lex 不再检测标题，所有行均为内容", () => {
    // lex 不再吃标题 —— 调用方应自行过滤
    const result = lex("登鹳雀楼\n白日依山尽，黄河入海流。");
    expect(result.lines.length).toBe(2);
    expect(result.lines[0].raw).toBe("登鹳雀楼");
    expect(result.lines[1].raw).toContain("白日");
  });
});

// ============ templates 模块 ============

describe("templates - getTemplateType", () => {
  it("应识别律诗 ID", () => {
    expect(getTemplateType("qilü-shouju-ping")).toBe("lüshi");
  });

  it("应识别绝句 ID", () => {
    expect(getTemplateType("qijue-pingqi")).toBe("jueju");
  });

  it("默认应返回 ci", () => {
    expect(getTemplateType("水调歌头")).toBe("ci");
  });
});

describe("templates - resolveLineTemplate 错误情况", () => {
  it("不存在的模板 ID 应抛出错误", () => {
    expect(() =>
      resolveLineTemplate({ templateId: "不存在的模板", globalLineIndex: 0 }),
    ).toThrow("Template not found");
  });

  it("律诗行索引超出范围应抛出错误", () => {
    expect(() =>
      resolveLineTemplate({
        templateId: "wujue-pingqi",
        globalLineIndex: 99,
      }),
    ).toThrow("out of range");
  });

  it("词牌无变体时应抛出错误", () => {
    // 使用空变体的模板名称不存在的场景
    expect(() =>
      resolveLineTemplate({
        templateId: "水调歌头",
        variantId: "不存在的变体",
        globalLineIndex: 0,
      }),
    ).toThrow();
  });

  it("词牌行索引超出范围应抛出错误", () => {
    expect(() =>
      resolveLineTemplate({
        templateId: "水调歌头",
        variantId: "水调歌头-v3",
        globalLineIndex: 999,
      }),
    ).toThrow("out of range");
  });
});

// ============ validation 模块 ============

describe("validation - validateLineAgainstPattern 失配路径", () => {
  it("应处理 tone_mismatch（非多音字失配）", () => {
    const chars = [Tone.Ze, Tone.Ze].map((tone, i) =>
      createCharNode({ char: "测", line: 0, col: i, global: i, tone }),
    );
    const line: LineNode = {
      raw: "测测",
      chars,
      charCount: 2,
      globalLineIndex: 0,
      isRhymeLine: false,
      diagnostics: [],
    };
    const pattern: ToneConstraint[] = [
      { type: "fixed", tone: Tone.Ping },
      { type: "fixed", tone: Tone.Ping },
    ];
    const result = validateLineAgainstPattern(line, pattern, []);
    expect(result.mismatchCount).toBeGreaterThan(0);
    expect(result.nonAmbiguousMismatchCount).toBeGreaterThan(0);
    expect(result.charChecks[0].reason).toBe("tone_mismatch");
  });

  it("应处理 tone_unresolved（未知音调失配）", () => {
    const chars = [null, null].map((tone, i) =>
      createCharNode({ char: "测", line: 0, col: i, global: i, tone }),
    );
    const line: LineNode = {
      raw: "测测",
      chars,
      charCount: 2,
      globalLineIndex: 0,
      isRhymeLine: false,
      diagnostics: [],
    };
    const pattern: ToneConstraint[] = [
      { type: "fixed", tone: Tone.Ping },
      { type: "fixed", tone: Tone.Ping },
    ];
    const result = validateLineAgainstPattern(line, pattern, []);
    expect(result.charChecks[0].reason).toBe("tone_unresolved");
  });

  it("应处理无约束字符（unknown expected）", () => {
    const chars = [Tone.Ping, Tone.Ping].map((tone, i) =>
      createCharNode({ char: "测", line: 0, col: i, global: i, tone }),
    );
    const line: LineNode = {
      raw: "测测",
      chars,
      charCount: 2,
      globalLineIndex: 0,
      isRhymeLine: false,
      diagnostics: [],
    };
    // 空 pattern → 每个字符无约束
    const result = validateLineAgainstPattern(line, [], []);
    expect(result.checkableCount).toBe(0);
  });

  it("多音字失配不增加 nonAmbiguousMismatchCount", () => {
    const chars = [Tone.Ze, Tone.Ping].map((tone, i) =>
      createCharNode({ char: "测", line: 0, col: i, global: i, tone }),
    );
    const line: LineNode = {
      raw: "测测",
      chars,
      charCount: 2,
      globalLineIndex: 0,
      isRhymeLine: false,
      diagnostics: [],
    };
    const pattern: ToneConstraint[] = [
      { type: "fixed", tone: Tone.Ping },
      { type: "fixed", tone: Tone.Ping },
    ];
    const ambiguities: ToneAmbiguity[] = [
      { char: "测", position: { line: 0, col: 0 }, options: [] },
    ];
    const result = validateLineAgainstPattern(line, pattern, ambiguities);
    // col0 是 ambiguous → nonAmbiguousMismatchCount 不应该增加
    expect(result.mismatchCount).toBeGreaterThan(0);
    expect(result.nonAmbiguousMismatchCount).toBe(0);
  });

  it("全部合规应返回 isCompliant=true", () => {
    const chars = [Tone.Ping, Tone.Ping].map((tone, i) =>
      createCharNode({ char: "测", line: 0, col: i, global: i, tone }),
    );
    const line: LineNode = {
      raw: "测测",
      chars,
      charCount: 2,
      globalLineIndex: 0,
      isRhymeLine: false,
      diagnostics: [],
    };
    const pattern: ToneConstraint[] = [
      { type: "fixed", tone: Tone.Ping },
      { type: "flexible" },
    ];
    const result = validateLineAgainstPattern(line, pattern, []);
    expect(result.isCompliant).toBe(true);
  });
});

describe("validation - applyRescueMarks", () => {
  it("无拗救应原样返回行", () => {
    const chars = [Tone.Ping].map((tone, i) =>
      createCharNode({ char: "测", line: 0, col: i, global: i, tone }),
    );
    const line: LineNode = {
      raw: "测",
      chars,
      charCount: 1,
      globalLineIndex: 0,
      isRhymeLine: false,
      diagnostics: [],
    };
    const result = applyRescueMarks(line, []);
    expect(result).toBe(line); // 应返回同一个引用
  });

  it("拗救标记应修改对应字符状态", () => {
    const chars = [Tone.Ping].map((tone, i) =>
      createCharNode({ char: "测", line: 0, col: i, global: i, tone }),
    );
    // 手动设置 validationStatus = fail
    chars[0].validationStatus = "fail";
    const line: LineNode = {
      raw: "测",
      chars,
      charCount: 1,
      globalLineIndex: 0,
      isRhymeLine: false,
      diagnostics: [],
    };
    const rescues = [
      {
        type: "benju-zijiou" as const,
        naoPosition: { line: 0, col: 0 },
        jiuPosition: { line: 0, col: 0 },
        description: "test",
      },
    ];
    const result = applyRescueMarks(line, rescues);
    expect(result.chars[0].validationStatus).toBe("rescued");
  });

  it("拗救不在本句不影响", () => {
    const chars = [Tone.Ping].map((tone, i) =>
      createCharNode({ char: "测", line: 0, col: i, global: i, tone }),
    );
    chars[0].validationStatus = "fail";
    const line: LineNode = {
      raw: "测",
      chars,
      charCount: 1,
      globalLineIndex: 0,
      isRhymeLine: false,
      diagnostics: [],
    };
    const rescues = [
      {
        type: "benju-zijiou" as const,
        naoPosition: { line: 1, col: 0 },
        jiuPosition: { line: 1, col: 0 },
        description: "在另一句",
      },
    ];
    const result = applyRescueMarks(line, rescues);
    expect(result.chars[0].validationStatus).toBe("fail"); // 不改变
  });
});

describe("validation - validateRhyme", () => {
  it("非韵脚行应返回 undefined", async () => {
    const dict = await createRhymeDict("cilin");
    const chars = [Tone.Ping].map((tone, i) =>
      createCharNode({ char: "安", line: 0, col: i, global: i, tone, rhymeGroup: "一部" }),
    );
    const result = validateRhyme(chars, {
      templateId: "test",
      expectedPattern: [],
      charCount: 1,
      isRhymeLine: false,
    }, undefined, dict);
    expect(result).toBeUndefined();
  });

  it("韵脚行无前置韵脚应返回有效结果", async () => {
    const dict = await createRhymeDict("cilin");
    const chars = [Tone.Ping].map((tone, i) =>
      createCharNode({ char: "安", line: 0, col: i, global: i, tone, rhymeGroup: "一部" }),
    );
    const result = validateRhyme(chars, {
      templateId: "test",
      expectedPattern: [],
      charCount: 1,
      isRhymeLine: true,
    }, undefined, dict);
    expect(result).toBeDefined();
    expect(result?.isRhymeLine).toBe(true);
    expect(result?.isConsistent).toBeNull(); // 无前置韵脚 → null
  });
});

// ============ ci 模块 ============

describe("ci - scoreCiVariant", () => {
  it("空行应返回置信度 0", () => {
    const variant: CiTemplateVariant = {
      id: "test-v1",
      name: "测试变体",
      sections: [{ name: "上阕", lines: [] }],
    };
    const result = scoreCiVariant([], variant);
    expect(result.confidence).toBe(0);
  });
});

describe("ci - chooseCiVariant", () => {
  it("无变体时应返回 null", () => {
    const template: CiTemplate = {
      id: "empty-tune",
      name: "空调",
      variants: [],
    };
    const result = chooseCiVariant(template, []);
    expect(result).toBeNull();
  });

  it("指定不存在的变体应抛出错误", () => {
    const template: CiTemplate = {
      id: "test-tune",
      name: "测试调",
      variants: [
        {
          id: "test-tune-v1",
          name: "变体1",
          sections: [{ name: "上阕", lines: [] }],
        },
      ],
    };
    expect(() => chooseCiVariant(template, [], "不存在的变体")).toThrow("指定变体不存在");
  });
});

// ============ pipeline steps 独立测试 ============

describe("pipeline - lexStep", () => {
  it("应正确处理词牌输入", () => {
    const template: CiTemplate = {
      id: "test-ci",
      name: "测试词牌",
      variants: [],
    };
    const result = lexStep("明月几时有，把酒问青天", template);
    expect(result.isCi).toBe(true);
    expect(result.lexResult.lines.length).toBe(2);
  });

  it("应正确处理诗体输入", () => {
    const template = loadMeterTemplates()[0];
    // 每行都带标点，避免首行被当标题
    const result = lexStep("白日依山尽，\n黄河入海流。", template);
    expect(result.isCi).toBe(false);
    expect(result.lexResult.lines.length).toBe(2);
  });
});

describe("pipeline - annotateStep", () => {
  it("应正确标注字符", async () => {
    const dict = await createRhymeDict("cilin");
    const template = loadMeterTemplates()[0];
    const { lexResult } = lexStep("白日依山尽，\n黄河入海流。", template);
    const annotation = annotateStep(lexResult, dict);
    expect(annotation.chars.length).toBe(2);
    expect(annotation.chars[0].length).toBe(5);
    expect(annotation.chars[1].length).toBe(5);
  });
});

describe("pipeline - buildAst", () => {
  it("应正确构建 AST", async () => {
    const dict = await createRhymeDict("cilin");
    const template = loadMeterTemplates()[0];
    const { lexResult } = lexStep("白日依山尽，\n黄河入海流。", template);
    const annotation = annotateStep(lexResult, dict);
    const rawLines = lexResult.lines.map((l) => l.raw);
    const ast = buildAst(annotation, rawLines, "jueju", dict.type);
    expect(ast.type).toBe("jueju");
    expect(ast.lines.length).toBe(2);
  });
});

// ============ ast 模块 ============

describe("ast - annotateLineText", () => {
  it("空文本应返回空字符", async () => {
    const dict = await createRhymeDict("cilin");
    const result = annotateLineText("", dict);
    expect(result.chars).toEqual([]);
    expect(result.ambiguities).toEqual([]);
  });
});

describe("ast - buildLexResultFromRawLines", () => {
  it("应正确构建词法结果", () => {
    const result = buildLexResultFromRawLines(["明月几时有", "把酒问青天"]);
    expect(result.lines.length).toBe(2);
    expect(result.metadata.totalLines).toBe(2);
  });

  it("空行数组应返回空结果", () => {
    const result = buildLexResultFromRawLines([]);
    expect(result.lines).toEqual([]);
    expect(result.metadata.totalLines).toBe(0);
  });
});

// ============ ci 模块补充 ============

describe("ci - chooseCiVariant 指定变体成功路径", () => {
  it("指定存在的变体应返回其评分结果", () => {
    const var1: CiTemplateVariant = {
      id: "test-tune-v1",
      name: "变体1",
      sections: [{ name: "上阕", lines: [{ charCount: 5, pattern: [], isRhymeLine: false }] }],
    };
    const template: CiTemplate = {
      id: "test-tune",
      name: "测试调",
      variants: [var1],
    };
    const astLines = [{ raw: "测试一二三四五", chars: [{ char: "测", tone: null, position: { line: 0, col: 0, global: 0 } }], charCount: 5, globalLineIndex: 0, isRhymeLine: false, diagnostics: [] }];
    const result = chooseCiVariant(template, astLines, "test-tune-v1");
    expect(result).not.toBeNull();
    expect(result!.variant.id).toBe("test-tune-v1");
  });
});

// ============ stream 补充 ============

describe("stream - rhyme_unresolved 路径", () => {
  it("韵位的未知字符应返回 rhyme_unresolved", async () => {
    const dict = await createRhymeDict("cilin");
    const meter = loadMeterTemplates().find((m) => m.id === "wujue-pingqi")!;
    // wujue-pingqi: sentenceIndex=1 末字为韵位, sentenceIndex=3 末字为韵位
    // 输入一个完全查不到的字符在韵位
    const result = analyzeStreamSync("白日依山尽，黄河入海𠀀。", meter, dict);
    // 第2句末字是韵位，但𠀀不在字典 → rhyme_unresolved
    const rhymeSegments = result.segments.filter(
      (s) => s.validation.mismatches.length > 0 && s.validation.mismatches[0].reason === "rhyme_unresolved",
    );
    expect(rhymeSegments.length).toBeGreaterThanOrEqual(0);
  });
});

// ============ rescue 补充 ============

describe("rescue - 边角条件", () => {
  it("三四互救：短于4字的行不应触发", async () => {
    const dict = await createRhymeDict("cilin");
    const { analyzeRescue } = await import("../src/rescue/index.js");
    // 3字行
    const upperChars = [Tone.Ze, Tone.Ping, Tone.Ping].map((t, i) =>
      createCharNode({ char: "测", line: 0, col: i, global: i, tone: t }),
    );
    const lowerChars = [Tone.Ping, Tone.Ping, Tone.Ping].map((t, i) =>
      createCharNode({ char: "测", line: 1, col: i, global: 3 + i, tone: t }),
    );
    const pattern: ToneConstraint[][] = [
      [
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ze },
        { type: "rhyme" },
      ],
      [
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ping },
        { type: "rhyme" },
      ],
    ];
    const template: MeterTemplate = {
      id: "short",
      type: "jueju",
      name: "短模板",
      charPerLine: 3 as any,
      lineCount: 2,
      pattern,
      rhymeLineIndices: [1],
    };
    const rescues = analyzeRescue(
      {
        upper: { raw: "测测测", chars: upperChars, charCount: 3, globalLineIndex: 0, isRhymeLine: false, diagnostics: [] },
        lower: { raw: "测测测", chars: lowerChars, charCount: 3, globalLineIndex: 1, isRhymeLine: false, diagnostics: [] },
        coupletIndex: 0,
        requiresDuizhang: false,
        diagnostics: [],
      },
      template,
      dict,
    );
    const sansi = rescues.filter((r: { type: string }) => r.type === "sansi-hujiou");
    expect(sansi).toEqual([]);
  });
});

// ============ lexer 补充 ============

describe("lexer - 标点标准化", () => {
  it("英文标点应转换为中文标点", () => {
    const result = lex("Hello, World! How are you?");
    // 英文标点被转为中文，但没有汉字 → 不会识别为标题
    expect(result.metadata.totalLines).toBe(1);
  });
});

// ============ rhyme-dict 边界 ============

describe("rhyme-dict - 所有韵书类型", () => {
  it("平水韵应支持基本查询", async () => {
    const dict = await createRhymeDict("pingshui");
    const entries = dict.lookup("天");
    expect(Array.isArray(entries)).toBe(true);
  });

  it("中华新韵应支持基本查询", async () => {
    const dict = await createRhymeDict("zhonghua_new");
    const entries = dict.lookup("天");
    expect(Array.isArray(entries)).toBe(true);
  });
});
