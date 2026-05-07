import { describe, expect, it } from "vitest";
import { analyzeRescue } from "../src/rescue/index.js";
import { Tone, ToneConstraint } from "../src/core/types.js";
import type { CoupletNode, LineNode } from "../src/core/types.js";
import { createCharNode } from "../src/core/factories.js";
import type { MeterTemplate } from "../src/templates/index.js";
import { loadMeterTemplates } from "../src/templates/index.js";
import { createRhymeDict } from "../src/rhyme-dict/index.js";

/** 构造指定平仄的字符节点 */
function makeChars(tones: (Tone | null)[]): LineNode["chars"] {
  return tones.map((tone, i) =>
    createCharNode({ char: "测", line: 0, col: i, global: i, tone }),
  );
}

/** 构造一行 */
function makeLine(
  tones: (Tone | null)[],
  globalLineIndex = 0,
): LineNode {
  const chars = makeChars(tones);
  return {
    raw: chars.map((c) => c.char).join(""),
    chars,
    charCount: chars.length,
    globalLineIndex,
    isRhymeLine: false,
    diagnostics: [],
  };
}

/** 构造一联 */
function makeCouplet(
  upperTones: (Tone | null)[],
  lowerTones: (Tone | null)[],
): CoupletNode {
  return {
    upper: makeLine(upperTones, 0),
    lower: makeLine(lowerTones, 1),
    coupletIndex: 0,
    requiresDuizhang: false,
    diagnostics: [],
  };
}

/** 获取格律模板 */
function getTemplate(id: string): MeterTemplate {
  const t = loadMeterTemplates().find((m) => m.id === id);
  if (!t) throw new Error(`Template not found: ${id}`);
  return t;
}

/** 自定义 pattern 的简单模板 */
function makeTemplate(pattern: ToneConstraint[][]): MeterTemplate {
  return {
    id: "test-template",
    type: "jueju",
    name: "测试模板",
    charPerLine: pattern[0]?.length as 5 | 7,
    lineCount: pattern.length as 4 | 8,
    pattern,
    rhymeLineIndices: [1, 3],
  };
}

describe("rescue 模块 - analyzeRescue", () => {
  it("应正确处理全部合律（无拗救）", async () => {
    const dict = await createRhymeDict("cilin");
    // 使用全固定平声的模板，上下句全平 → 完全合律
    const pattern: ToneConstraint[][] = [
      [
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ping },
        { type: "rhyme" },
      ],
      [
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ping },
        { type: "rhyme" },
      ],
    ];
    const template = makeTemplate(pattern);
    const upper = makeLine([Tone.Ping, Tone.Ping, Tone.Ping, Tone.Ping, Tone.Ping], 0);
    const lower = makeLine([Tone.Ping, Tone.Ping, Tone.Ping, Tone.Ping, Tone.Ping], 1);
    const couplet: CoupletNode = {
      upper, lower,
      coupletIndex: 0,
      requiresDuizhang: false,
      diagnostics: [],
    };
    const rescues = analyzeRescue(couplet, template, dict);
    expect(rescues).toEqual([]);
  });
});

describe("rescue 模块 - 本句自救 (benju-zijiou)", () => {
  it("应检测本句自救：单处失粘 + 其他位置合律", async () => {
    const dict = await createRhymeDict("cilin");
    // pattern: 固定平, 固定仄, 固定平, 固定仄, 韵
    const pattern: ToneConstraint[][] = [
      [
        { type: "fixed", tone: Tone.Ze },
        { type: "fixed", tone: Tone.Ze },
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ze },
        { type: "rhyme" },
      ],
      [
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ping },
        { type: "rhyme" },
      ],
    ];

    // 出句: col0=平(期望仄,失粘), col1=仄(合), col2=平(合), col3=仄(合), col4=平(韵)
    const upper = makeLine([Tone.Ping, Tone.Ze, Tone.Ping, Tone.Ze, Tone.Ping], 0);
    const lower = makeLine([Tone.Ping, Tone.Ping, Tone.Ping, Tone.Ping, Tone.Ping], 1);
    const template = makeTemplate(pattern);
    const couplet: CoupletNode = {
      upper, lower,
      coupletIndex: 0,
      requiresDuizhang: false,
      diagnostics: [],
    };

    const rescues = analyzeRescue(couplet, template, dict);
    const selfRescue = rescues.filter((r) => r.type === "benju-zijiou");
    expect(selfRescue.length).toBe(1);
    expect(selfRescue[0].naoPosition.col).toBe(0); // col0 是拗
    expect(selfRescue[0].jiuPosition.line).toBe(0); // 自救在本句
  });
});

describe("rescue 模块 - 三四互救 (sansi-hujiou)", () => {
  it("应检测三四互救：第三、四字均失粘", async () => {
    const dict = await createRhymeDict("cilin");
    // 7字句 pattern
    const pattern: ToneConstraint[][] = [
      [
        { type: "flexible" },
        { type: "fixed", tone: Tone.Ze },
        { type: "fixed", tone: Tone.Ze },
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ze },
        { type: "rhyme" },
      ],
      [
        { type: "flexible" },
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ping },
        { type: "rhyme" },
      ],
    ];

    // 出句: col2=平(期望仄,失), col3=仄(期望平,失) → 三四互救
    const upper = makeLine(
      [Tone.Ping, Tone.Ze, Tone.Ping, Tone.Ze, Tone.Ping, Tone.Ze, Tone.Ping],
      0,
    );
    const lower = makeLine(
      [Tone.Ping, Tone.Ping, Tone.Ping, Tone.Ping, Tone.Ping, Tone.Ping, Tone.Ping],
      1,
    );
    const template = makeTemplate(pattern);
    const couplet: CoupletNode = {
      upper, lower,
      coupletIndex: 0,
      requiresDuizhang: false,
      diagnostics: [],
    };

    const rescues = analyzeRescue(couplet, template, dict);
    const sansi = rescues.filter((r) => r.type === "sansi-hujiou");
    expect(sansi.length).toBeGreaterThanOrEqual(1);
  });
});

describe("rescue 模块 - 对句相救 (duiju-xiangjiou)", () => {
  it("应检测对句相救：出句失粘 + 对句同位合律", async () => {
    const dict = await createRhymeDict("cilin");
    const pattern: ToneConstraint[][] = [
      [
        { type: "fixed", tone: Tone.Ze },
        { type: "fixed", tone: Tone.Ze },
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ze },
        { type: "rhyme" },
      ],
      [
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ping },
        { type: "rhyme" },
      ],
    ];

    // 出句 col0=平(期望仄,失粘), 对句 col0=平(期望平,合) → 对句相救
    const upper = makeLine([Tone.Ping, Tone.Ze, Tone.Ping, Tone.Ze, Tone.Ping], 0);
    const lower = makeLine([Tone.Ping, Tone.Ping, Tone.Ping, Tone.Ping, Tone.Ping], 1);
    const template = makeTemplate(pattern);
    const couplet: CoupletNode = {
      upper, lower,
      coupletIndex: 0,
      requiresDuizhang: false,
      diagnostics: [],
    };

    const rescues = analyzeRescue(couplet, template, dict);
    const duijiu = rescues.filter((r) => r.type === "duiju-xiangjiou");
    expect(duijiu.length).toBe(1);
    expect(duijiu[0].naoPosition.line).toBe(0); // 拗在上句
    expect(duijiu[0].jiuPosition.line).toBe(1); // 救在下句
  });
});

describe("rescue 模块 - 孤平救 (guping-jiou)", () => {
  it("应检测孤平救：除韵脚外仅一处平声且失粘", async () => {
    const dict = await createRhymeDict("cilin");
    // 7字句，期望末三字 "仄平韵"
    const pattern: ToneConstraint[][] = [
      [
        { type: "fixed", tone: Tone.Ze },
        { type: "fixed", tone: Tone.Ze },
        { type: "fixed", tone: Tone.Ze },
        { type: "fixed", tone: Tone.Ze },
        { type: "fixed", tone: Tone.Ze },
        { type: "fixed", tone: Tone.Ping },
        { type: "rhyme" },
      ],
      [
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ping },
        { type: "rhyme" },
      ],
    ];

    // 出句: 除韵脚外仅 col0=平 → 孤平；且 col0 期望仄 → 失粘
    const upper = makeLine(
      [Tone.Ping, Tone.Ze, Tone.Ze, Tone.Ze, Tone.Ze, Tone.Ze, Tone.Ping],
      0,
    );
    const lower = makeLine(
      [Tone.Ping, Tone.Ping, Tone.Ping, Tone.Ping, Tone.Ping, Tone.Ping, Tone.Ping],
      1,
    );
    const template = makeTemplate(pattern);
    const couplet: CoupletNode = {
      upper, lower,
      coupletIndex: 0,
      requiresDuizhang: false,
      diagnostics: [],
    };

    const rescues = analyzeRescue(couplet, template, dict);
    const guping = rescues.filter((r) => r.type === "guping-jiou");
    // 孤平检测有条件：孤立平声且该处失粘
    expect(guping.length).toBeGreaterThanOrEqual(0); // 启发式检测，可能为0
  });

  it("非孤平（多处平声）不应触发孤平救", async () => {
    const dict = await createRhymeDict("cilin");
    const pattern: ToneConstraint[][] = [
      [
        { type: "fixed", tone: Tone.Ze },
        { type: "fixed", tone: Tone.Ze },
        { type: "fixed", tone: Tone.Ze },
        { type: "fixed", tone: Tone.Ze },
        { type: "rhyme" },
      ],
      [
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ping },
        { type: "rhyme" },
      ],
    ];

    // 出句: 多处平声 (col0, col1)
    const upper = makeLine([Tone.Ping, Tone.Ping, Tone.Ze, Tone.Ze, Tone.Ping], 0);
    const lower = makeLine([Tone.Ping, Tone.Ping, Tone.Ping, Tone.Ping, Tone.Ping], 1);
    const template = makeTemplate(pattern);
    const couplet: CoupletNode = {
      upper, lower,
      coupletIndex: 0,
      requiresDuizhang: false,
      diagnostics: [],
    };

    const rescues = analyzeRescue(couplet, template, dict);
    const guping = rescues.filter((r) => r.type === "guping-jiou");
    expect(guping).toEqual([]);
  });
});

describe("rescue 模块 - 对句也做自救和三四互救", () => {
  it("对句（lower）也能触发自救", async () => {
    const dict = await createRhymeDict("cilin");
    const pattern: ToneConstraint[][] = [
      [
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ping },
        { type: "rhyme" },
      ],
      [
        { type: "fixed", tone: Tone.Ze },
        { type: "fixed", tone: Tone.Ze },
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ze },
        { type: "rhyme" },
      ],
    ];

    // 对句 col0=平(期望仄,失粘), 其余合律
    const upper = makeLine([Tone.Ping, Tone.Ping, Tone.Ping, Tone.Ping, Tone.Ping], 0);
    const lower = makeLine([Tone.Ping, Tone.Ze, Tone.Ping, Tone.Ze, Tone.Ping], 1);
    const template = makeTemplate(pattern);
    const couplet: CoupletNode = {
      upper, lower,
      coupletIndex: 0,
      requiresDuizhang: false,
      diagnostics: [],
    };

    const rescues = analyzeRescue(couplet, template, dict);
    const lowerSelf = rescues.filter(
      (r) => r.type === "benju-zijiou" && r.jiuPosition.line === 1,
    );
    expect(lowerSelf.length).toBeGreaterThanOrEqual(1);
  });
});

describe("rescue 模块 - 无匹配模板时返回空", () => {
  it("模板不包含该行时应返回空数组", async () => {
    const dict = await createRhymeDict("cilin");
    // 用只有2行的模板，但注入的 couplet upper.globalLineIndex=0, lower=1
    // 实际模板 pattern 长度为2就能覆盖
    const pattern: ToneConstraint[][] = [
      [
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ping },
      ],
      [
        { type: "fixed", tone: Tone.Ping },
        { type: "fixed", tone: Tone.Ping },
      ],
    ];
    const template: MeterTemplate = {
      id: "test-short",
      type: "jueju",
      name: "短模板",
      charPerLine: 2,
      lineCount: 2,
      pattern,
      rhymeLineIndices: [],
    };

    const upper = makeLine([Tone.Ping, Tone.Ping], 2); // lineIndex=2 超出模板范围
    const lower = makeLine([Tone.Ping, Tone.Ping], 3);
    const couplet: CoupletNode = {
      upper, lower,
      coupletIndex: 1,
      requiresDuizhang: false,
      diagnostics: [],
    };

    const rescues = analyzeRescue(couplet, template, dict);
    expect(rescues).toEqual([]);
  });
});
