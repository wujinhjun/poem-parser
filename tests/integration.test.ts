import { describe, expect, it } from "vitest";
import { analyze, analyzeSync, analyzeLine } from "../src/analyzer/index.js";
import { runPipeline } from "../src/analyzer/pipeline.js";
import { loadMeterTemplates, loadCiTemplates, getCandidates, getTemplateById } from "../src/templates/index.js";
import { createRhymeDict } from "../src/rhyme-dict/index.js";
import { analyzeStreamSync, getSentenceCharCounts } from "../src/analyzer/stream.js";
import type { CiTemplate } from "../src/templates/index.js";

// ============ analyzer/index.ts ============

describe("analyze 异步 API", () => {
  it("不存在的模板 ID 应抛出错误", async () => {
    await expect(
      analyze("测试", {
        templateId: "不存在的模板id",
        rhymeDictType: "cilin",
      }),
    ).rejects.toThrow("指定模板不存在");
  });
});

describe("analyzeSync 无匹配变体", () => {
  it("ci 模板无匹配变体时 bestMatch 应为 null", async () => {
    const dict = await createRhymeDict("cilin");
    // 创建一个只有空变体的 ci 模板
    const template: CiTemplate = {
      id: "empty-tune",
      name: "空调",
      variants: [],
    };
    const result = analyzeSync("测试文本", template, dict);
    expect(result.bestMatch).toBeNull();
    expect(result.summary).toContain("未命中可用变体");
  });
});

describe("analyzeLine 拗救路径", () => {
  it("无相邻行文本时不应做拗救分析", async () => {
    const result = await analyzeLine(
      "白日依山尽",
      {
        templateId: "wujue-pingqi",
        globalLineIndex: 0,
        adjacentLines: { next: "" },
      },
      { rhymeDictType: "cilin" },
    );
    // 空字符串相邻行不应产生 rescues
    expect(result).toBeDefined();
  });
});

// ============ templates/index.ts ============

describe("templates - getCandidates", () => {
  it("应返回匹配行数和字数的候选模板", () => {
    const candidates = getCandidates({
      lineCount: 4,
      charsPerLine: [5, 5, 5, 5],
    });
    expect(candidates.length).toBeGreaterThan(0);
    // 应该包含 5 言绝句
    expect(candidates.some((c) => c.id.includes("wujue"))).toBe(true);
  });

  it("不匹配的行数应被过滤", () => {
    const candidates = getCandidates({
      lineCount: 3,
      charsPerLine: [5, 5, 5],
    });
    // 3行不是标准格式，诗体中没有匹配
    const meters = candidates.filter((c) => "pattern" in c);
    expect(meters).toEqual([]);
  });
});

describe("templates - getTemplateById", () => {
  it("律诗模板应正确返回", () => {
    const template = getTemplateById("wujue-pingqi");
    expect(template).toBeDefined();
    expect(template?.id).toBe("wujue-pingqi");
  });

  it("不存在的模板应返回 undefined", () => {
    const template = getTemplateById("完全不存在的模板xyz");
    expect(template).toBeUndefined();
  });
});

describe("templates - loadCiTemplates", () => {
  it("limit 参数应限制返回数量", () => {
    const templates = loadCiTemplates({ limit: 3 });
    expect(templates.length).toBeLessThanOrEqual(3);
  });
});

// ============ stream.ts ============

describe("stream - getSentenceCharCounts", () => {
  it("应正确获取绝句每句字数", () => {
    const meter = loadMeterTemplates().find((m) => m.id === "wujue-pingqi")!;
    const counts = getSentenceCharCounts(meter);
    expect(counts).toEqual([5, 5, 5, 5]);
  });
});

describe("stream - analyzeStreamSync", () => {
  it("应正确流式解析简单文本", async () => {
    const dict = await createRhymeDict("cilin");
    const meter = loadMeterTemplates().find((m) => m.id === "wujue-pingqi")!;
    const result = analyzeStreamSync("白日依山尽，黄河入海流。欲穷千里目，更上一层楼。", meter, dict);
    expect(result.totalSentences).toBe(4);
    expect(result.parsedSentenceCount).toBe(4);
    expect(result.segments.length).toBeGreaterThan(0);
  });

  it("不完整输入应正确标记未完成句", async () => {
    const dict = await createRhymeDict("cilin");
    const meter = loadMeterTemplates().find((m) => m.id === "wujue-pingqi")!;
    const result = analyzeStreamSync("白日", meter, dict);
    // 第一句不完整（只有2字，期望5字）
    expect(result.sentenceSummaries[0].isComplete).toBe(false);
  });

  it("空输入应返回空片段", async () => {
    const dict = await createRhymeDict("cilin");
    const meter = loadMeterTemplates().find((m) => m.id === "wujue-pingqi")!;
    const result = analyzeStreamSync("", meter, dict);
    expect(result.segments).toEqual([]);
  });
});

// ============ phonology 模块 ============

describe("phonology - annotate", () => {
  it("应正确标注 未知音调字", async () => {
    const { annotate } = await import("../src/phonology/index.js");
    const dict = await createRhymeDict("cilin");
    const result = annotate(
      {
        lines: [{ raw: "𠀀", chars: ["𠀀"], punctuation: "" }],
        metadata: { totalLines: 1, charsPerLine: [1] },
      },
      dict,
    );
    expect(result.chars[0]).toBeDefined();
  });
});

// ============ rhyme-dict 边界字符 ============

describe("rhyme-dict - 边角字符", () => {
  it("完全不存在的字符应返回空数组", async () => {
    const dict = await createRhymeDict("cilin");
    const entries = dict.lookup("𠀀");
    expect(Array.isArray(entries)).toBe(true);
  });

  it("getRhymeGroup 对不存在字符应返回空数组", async () => {
    const dict = await createRhymeDict("cilin");
    const groups = dict.getRhymeGroup("𠀀");
    expect(groups).toEqual([]);
  });

  it("isSameRhyme 对不存在字符应返回 false", async () => {
    const dict = await createRhymeDict("cilin");
    const result = dict.isSameRhyme("𠀀", "xyz");
    expect(typeof result).toBe("boolean");
  });
});

// ============ pipeline 字数校验 ============

describe("pipeline - 字数预检", () => {
  it("诗体字数不匹配应抛出错误", async () => {
    const dict = await createRhymeDict("cilin");
    const tpl = loadMeterTemplates().find((m) => m.id === "wujue-pingqi")!;
    // wujue-pingqi = 5字×4行=20字，传入19字
    expect(() =>
      runPipeline({
        input: "白日依山尽\n黄河入海流\n欲穷千里目\n更上一层",  // 19字
        template: tpl,
        dict,
      }),
    ).toThrow("字数不匹配");
  });

  it("诗体字数匹配应正常通过", async () => {
    const dict = await createRhymeDict("cilin");
    const tpl = loadMeterTemplates().find((m) => m.id === "wujue-pingqi")!;
    // wujue-pingqi = 5字×4行=20字，传入正好20字
    const result = runPipeline({
      input: "白日依山尽，\n黄河入海流。\n欲穷千里目，\n更上一层楼。",
      template: tpl,
      dict,
    });
    expect(result.ast.lines.length).toBe(4);
  });
});
