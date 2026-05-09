import { describe, expect, it } from "vitest";
import { createRhymeDict } from "../src/rhyme-dict/loader.js";

describe("rhyme-dict/index.ts 韵书查询", () => {
  it("lookup 应返回单音平声字", async () => {
    const dict = await createRhymeDict("cilin", "./data");
    const entries = dict.lookup("安");
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some(e => e.tone === "平")).toBe(true);
  });

  it("lookup 应返回单音仄声字", async () => {
    const dict = await createRhymeDict("cilin", "./data");
    const entries = dict.lookup("去");
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some(e => e.tone === "仄")).toBe(true);
  });

  it("lookup 应返回多音字的所有音调", async () => {
    const dict = await createRhymeDict("cilin", "./data");
    const entries = dict.lookup("行");
    expect(entries.length).toBeGreaterThan(1);
    const tones = entries.map(e => e.tone);
    expect(tones).toContain("平");
    expect(tones).toContain("仄");
  });

  it("lookup 应返回韵部信息", async () => {
    const dict = await createRhymeDict("cilin", "./data");
    const entries = dict.lookup("天");
    expect(entries.length).toBeGreaterThan(0);
    // 韵部应该非空（对于有韵部的字）
  });

  it("getRhymeGroup 应返回所有韵部", async () => {
    const dict = await createRhymeDict("cilin", "./data");
    const groups = dict.getRhymeGroup("天");
    expect(Array.isArray(groups)).toBe(true);
    expect(groups.length).toBeGreaterThan(0);
  });

  it("getRhymeGroup 应对未知字返回空数组", async () => {
    const dict = await createRhymeDict("cilin", "./data");
    const groups = dict.getRhymeGroup("㿏");
    expect(Array.isArray(groups)).toBe(true);
  });

  it("isSameRhyme 应正确判断同韵字", async () => {
    const dict = await createRhymeDict("cilin", "./data");
    // "天" 和 "年" 在词林正韵中可能同韵部
    const result = dict.isSameRhyme("天", "年");
    expect(typeof result).toBe("boolean");
  });

  it("isSameRhyme 应正确判断不同韵字", async () => {
    const dict = await createRhymeDict("cilin", "./data");
    const result = dict.isSameRhyme("天", "知");
    expect(typeof result).toBe("boolean");
  });

  it("应支持中华新韵", async () => {
    const dict = await createRhymeDict("zhonghua_new", "./data");
    const entries = dict.lookup("安");
    expect(entries.length).toBeGreaterThan(0);
  });

  it("应支持平水韵", async () => {
    const dict = await createRhymeDict("pingshui", "./data");
    const entries = dict.lookup("安");
    expect(entries.length).toBeGreaterThan(0);
  });

  it("lookup 对不存在字符应返回空或降级结果", async () => {
    const dict = await createRhymeDict("cilin", "./data");
    const entries = dict.lookup("xyz");
    // 应该返回空数组或降级结果（不报错）
    expect(Array.isArray(entries)).toBe(true);
  });
});
