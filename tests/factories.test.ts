import { describe, expect, it } from "vitest";
import { createCharNode, createLineNode, createDiagnostic } from "../src/core/factories.js";
import { Tone } from "../src/core/types.js";

describe("core/factories.ts CharNode工厂", () => {
  it("createCharNode 应正确创建节点", () => {
    const node = createCharNode({
      char: "测",
      line: 0,
      col: 0,
      global: 0,
      tone: Tone.Ping,
      rhymeGroup: "一部",
    });
    expect(node.char).toBe("测");
    expect(node.tone).toBe(Tone.Ping);
    expect(node.rhymeGroup).toBe("一部");
  });

  it("createCharNode 应处理null音调", () => {
    const node = createCharNode({
      char: "测",
      line: 0,
      col: 0,
      global: 0,
      tone: null,
    });
    expect(node.tone).toBeNull();
  });

  it("createCharNode 应处理多音选项", () => {
    const node = createCharNode({
      char: "行",
      line: 0,
      col: 0,
      global: 0,
      tone: Tone.Ping,
      toneOptions: [Tone.Ping, Tone.Ze],
    });
    expect(node.toneOptions).toContain(Tone.Ping);
    expect(node.toneOptions).toContain(Tone.Ze);
  });

  it("createCharNode 应正确设置位置", () => {
    const node = createCharNode({
      char: "测",
      line: 2,
      col: 3,
      global: 11,
    });
    expect(node.position.line).toBe(2);
    expect(node.position.col).toBe(3);
    expect(node.position.global).toBe(11);
  });

  it("createCharNode 不应设置validationStatus（由使用方设置）", () => {
    const node = createCharNode({
      char: "测",
      line: 0,
      col: 0,
      global: 0,
    });
    expect(node.validationStatus).toBeUndefined();
  });

  it("createLineNode 应正确创建行节点", () => {
    const chars = [
      createCharNode({ char: "测", line: 0, col: 0, global: 0 }),
      createCharNode({ char: "试", line: 0, col: 1, global: 1 }),
    ];
    const line = createLineNode({
      raw: "测试",
      globalLineIndex: 0,
      chars,
    });
    expect(line.charCount).toBe(2);
    expect(line.isRhymeLine).toBe(false);
    expect(line.raw).toBe("测试");
  });

  it("createDiagnostic 应直接返回传入的诊断对象", () => {
    const diagnostic = {
      type: "violation" as const,
      severity: "error" as const,
      position: { line: 0 },
      message: "测试错误",
    };
    const result = createDiagnostic(diagnostic);
    expect(result.type).toBe("violation");
  });
});
