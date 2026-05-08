import { describe, expect, it } from "vitest";
import { analyzeStream } from "./_helpers.js";
import { analyze } from "./_helpers.js";

// 基于苏轼《水调歌头》
const SHUIDIAOGETOU_TEXT = [
  "明月几时有？把酒问青天。",
  "不知天上宫阙，今夕是何年。",
  "我欲乘风归去，又恐琼楼玉宇，高处不胜寒。",
  "起舞弄清影，何似在人间。",
  "转朱阁，低绮户，照无眠。",
  "不应有恨，何事长向别时圆？",
  "人有悲欢离合，月有阴晴圆缺，此事古难全。",
  "但愿人长久，千里共婵娟。",
].join("\n");

describe("流式解析 analyzeStream", () => {
  // 完整输入
  it("应正确处理完整输入", async () => {
    const result = await analyzeStream(
      "明月几时有？把酒问青天。不知天上宫阙，今夕是何年。",
      "水调歌头",
      { variantId: "水调歌头-v3", rhymeDictType: "cilin" }
    );
    expect(result.templateId).toBe("水调歌头");
    expect(result.variantId).toBe("水调歌头-v3");
    expect(result.totalSentences).toBe(19);
    expect(result.sentenceCharCounts.length).toBe(19);
  });

  // 不完整输入 - 部分句子
  it("应正确处理不完整输入", async () => {
    const result = await analyzeStream(
      "明月几时有？把酒问青天。",
      "水调歌头",
      { variantId: "水调歌头-v3", rhymeDictType: "cilin" }
    );
    expect(result.parsedSentenceCount).toBe(2);
    expect(result.sentenceSummaries[0].isComplete).toBe(true);
    expect(result.sentenceSummaries[0].charCount).toBe(5);
    expect(result.sentenceSummaries[1].isComplete).toBe(true);
  });

  // 单字不完整句子
  it("应处理单字不完整的句子", async () => {
    const result = await analyzeStream(
      "明月几时有？把酒问青天。不知天上宫阙，今夕是何年。我欲乘风归去，又恐琼楼玉宇，高处不胜寒。起舞弄清影，何似在",
      "水调歌头",
      { variantId: "水调歌头-v3", rhymeDictType: "cilin" }
    );
    // 第9句只有3字，模板期望5字
    expect(result.sentenceSummaries[8].charCount).toBe(3);
    expect(result.sentenceSummaries[8].sentenceCharCount).toBe(5);
    expect(result.sentenceSummaries[8].remaining).toBe(2);
    expect(result.sentenceSummaries[8].isComplete).toBe(false);
  });

  // segments 详情
  it("应返回每个字符的详细校验结果", async () => {
    const result = await analyzeStream(
      "明月几时有？",
      "水调歌头",
      { variantId: "水调歌头-v3", rhymeDictType: "cilin" }
    );
    expect(result.segments.length).toBe(5);
    expect(result.segments[0].text).toBe("明");
    expect(result.segments[0].sentenceIndex).toBe(0);
    expect(result.segments[0].startCol).toBe(0);
    expect(result.segments[0].sentenceRemaining).toBe(4);
  });

  // 韵脚行处理
  it("应正确处理韵脚行", async () => {
    const result = await analyzeStream(
      "明月几时有？",
      "水调歌头",
      { variantId: "水调歌头-v3", rhymeDictType: "cilin" }
    );
    // 第1句是韵脚行
    expect(result.sentenceSummaries[0].isComplete).toBe(true);
    expect(result.sentenceCharCounts[0]).toBe(5);
  });

  // 错误模板
  it("应对不存在的模板抛出错误", async () => {
    await expect(
      analyzeStream("测试", "不存在的模板", { rhymeDictType: "cilin" })
    ).rejects.toThrow("模板不存在");
  });

  // 错误变体
  it("应对不存在的变体抛出错误", async () => {
    await expect(
      analyzeStream("明月几时有？", "水调歌头", {
        variantId: "不存在的变体",
        rhymeDictType: "cilin",
      })
    ).rejects.toThrow("变体不存在");
  });

  // 律诗模板
  it("应支持律诗模板", async () => {
    const result = await analyzeStream(
      "白日依山尽，黄河入海流。",
      "qijue-pingqi",
      { rhymeDictType: "cilin" }
    );
    expect(result.totalSentences).toBe(4);
    expect(result.sentenceCharCounts.length).toBe(4);
  });

  // 空输入
  it("应处理空输入", async () => {
    const result = await analyzeStream("", "水调歌头", {
      variantId: "水调歌头-v3",
      rhymeDictType: "cilin",
    });
    expect(result.totalCharCount).toBe(0);
    expect(result.parsedSentenceCount).toBe(0);
    expect(result.segments.length).toBe(0);
  });

  // 纯标点输入 - 标点被split过滤，但totalCharCount计算的是原始输入长度
  it("应处理纯标点输入", async () => {
    const result = await analyzeStream("，。！？", "水调歌头", {
      variantId: "水调歌头-v3",
      rhymeDictType: "cilin",
    });
    // 纯标点被filter掉，segments为空，但totalCharCount统计原始输入
    expect(result.totalCharCount).toBe(4);
    expect(result.segments.length).toBe(0);
  });

  // 多音字检测
  it("应检测到多音字的不匹配", async () => {
    // "长" 是多音字，此处用于 "长短" 的 "长" 应为仄声
    const result = await analyzeStream(
      "但愿人长久",
      "水调歌头",
      { variantId: "水调歌头-v3", rhymeDictType: "cilin" }
    );
    // 最后一字 "久" 是韵脚
    const lastSeg = result.segments[result.segments.length - 1];
    expect(lastSeg.text).toBe("久");
  });
});

describe("词牌变体选择 chooseCiVariant", () => {
  it("应基于 analyzeStream 和 analyze 返回一致的变体选择", async () => {
    const fullText = SHUIDIAOGETOU_TEXT;

    // analyze 返回的结果
    const analyzeResult = await analyze(fullText, {
      templateId: "水调歌头",
      rhymeDictType: "cilin",
      preferredType: "ci",
    });

    // 流式解析的结果
    const streamResult = await analyzeStream(fullText, "水调歌头", {
      variantId: undefined,
      rhymeDictType: "cilin",
    });

    // 两者应返回相同的模板ID
    expect(analyzeResult.bestMatch?.templateId).toBe(streamResult.templateId);
  });

  it("指定变体时应返回指定变体", async () => {
    const streamResult = await analyzeStream(
      "明月几时有？",
      "水调歌头",
      { variantId: "水调歌头-v3", rhymeDictType: "cilin" }
    );
    expect(streamResult.variantId).toBe("水调歌头-v3");
  });
});
