import { describe, expect, it } from "vitest";
import { toJSON, toAnnotatedText, toCLI } from "../src/reporter/index.js";
import type { AnalysisResult } from "../src/analyzer/index.js";
import type { CharNode, LineNode } from "../src/core/types.js";
import { Tone } from "../src/core/types.js";

function createMockCharNode(overrides?: Partial<CharNode>): CharNode {
  return {
    char: "测",
    tone: Tone.Ping,
    toneOptions: [Tone.Ping],
    position: { global: 0, line: 0, col: 0 },
    validationStatus: "pass",
    ...overrides,
  };
}

function createMockLineNode(chars: CharNode[]): LineNode {
  return {
    raw: chars.map((c) => c.char).join(""),
    chars,
    charCount: chars.length,
    globalLineIndex: 0,
    isRhymeLine: false,
    diagnostics: [],
  };
}

function createMockAnalysisResult(
  lines: LineNode[],
  overrides?: Partial<AnalysisResult>
): AnalysisResult {
  return {
    ast: {
      type: "jueju",
      lines,
      templateId: "qijue-pingqi",
      rhymeDictType: "cilin",
      diagnostics: [],
    },
    matchResults: [],
    bestMatch: { templateId: "qijue-pingqi", confidence: 1, toneDeviations: [] },
    diagnostics: [],
    ambiguities: [],
    isCompliant: true,
    fullyCompliant: true,
    complianceRate: 1,
    lineValidations: [],
    summary: "测试",
    ...overrides,
  };
}

describe("reporter/index.ts CLI输出", () => {
  it("toJSON 应返回格式化的 JSON 字符串", () => {
    const result = createMockAnalysisResult([
      createMockLineNode([createMockCharNode({ char: "白" }), createMockCharNode({ char: "日" })]),
    ]);
    const json = toJSON(result);
    expect(typeof json).toBe("string");
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("toAnnotatedText 应正确标注每行", () => {
    const result = createMockAnalysisResult([
      createMockLineNode([
        createMockCharNode({ char: "白", tone: Tone.Ze }),
        createMockCharNode({ char: "日", tone: Tone.Ze }),
        createMockCharNode({ char: "依", tone: Tone.Ping }),
        createMockCharNode({ char: "山", tone: Tone.Ping }),
        createMockCharNode({ char: "尽", tone: Tone.Ze }),
      ]),
      createMockLineNode([
        createMockCharNode({ char: "黄", tone: Tone.Ping }),
        createMockCharNode({ char: "河", tone: Tone.Ping }),
        createMockCharNode({ char: "入", tone: Tone.Ze }),
        createMockCharNode({ char: "海", tone: Tone.Ze }),
        createMockCharNode({ char: "流", tone: Tone.Ping }),
      ]),
    ]);
    const text = toAnnotatedText(result);
    expect(text).toContain("白(仄) 日(仄) 依(平) 山(平) 尽(仄)");
    expect(text).toContain("黄(平) 河(平) 入(仄) 海(仄) 流(平)");
  });

  it("toAnnotatedText 应标记不合规字符", () => {
    const result = createMockAnalysisResult([
      createMockLineNode([
        createMockCharNode({ char: "白", tone: null, validationStatus: "fail" }),
      ]),
    ]);
    const text = toAnnotatedText(result);
    expect(text).toContain("!");
  });

  it("toCLI 应包含模板匹配信息", () => {
    const result = createMockAnalysisResult(
      [createMockLineNode([createMockCharNode()])],
      { bestMatch: { templateId: "qijue-pingqi", confidence: 1, toneDeviations: [] } }
    );
    const cli = toCLI(result);
    expect(cli).toContain("模板 qijue-pingqi");
    expect(cli).toContain("100.0%");
  });

  it("toCLI 应处理未匹配模板的情况", () => {
    const result = createMockAnalysisResult(
      [createMockLineNode([createMockCharNode()])],
      { bestMatch: null }
    );
    const cli = toCLI(result);
    expect(cli).toContain("未匹配模板");
  });

  it("toCLI 应包含标注文本", () => {
    const result = createMockAnalysisResult([
      createMockLineNode([createMockCharNode({ char: "白", tone: Tone.Ze })]),
    ]);
    const cli = toCLI(result);
    expect(cli).toContain("白(仄)");
  });

  it("空行应正常处理", () => {
    const result = createMockAnalysisResult([]);
    const text = toAnnotatedText(result);
    expect(text).toBe("");
  });

  it("未知音调应显示为'未知'", () => {
    const result = createMockAnalysisResult([
      createMockLineNode([
        createMockCharNode({ char: "测", tone: null, validationStatus: "unknown" }),
      ]),
    ]);
    const text = toAnnotatedText(result);
    expect(text).toContain("测(未知)");
  });
});
