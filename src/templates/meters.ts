/**
 * 格律模板 —— 纯数据，硬编码
 *
 * 无 fs / path / process 依赖，可被 kernel 直接导入。
 */
import { Tone, ToneConstraint } from "../core/types.js";

export interface MeterTemplate {
  id: string;
  type: "lüshi" | "jueju";
  name: string;
  charPerLine: 5 | 7;
  lineCount: 4 | 8;
  pattern: ToneConstraint[][];
  rhymeLineIndices: number[];
  variants?: string[];
}

const P = (tone: Tone): ToneConstraint => ({ type: "fixed", tone });
const Z = (tone: Tone): ToneConstraint => ({ type: "fixed", tone });
const F: ToneConstraint = { type: "flexible" };
const R: ToneConstraint = { type: "rhyme" };

function pz(pattern: string): ToneConstraint[] {
  return [...pattern].map((ch) => {
    if (ch === "平") return P(Tone.Ping);
    if (ch === "仄") return Z(Tone.Ze);
    if (ch === "中") return F;
    if (ch === "韵") return R;
    return F;
  });
}

export function loadMeterTemplates(): MeterTemplate[] {
  return [
    {
      id: "qilü-shouju-ping",
      type: "lüshi",
      name: "七律·首句入韵·平起",
      charPerLine: 7,
      lineCount: 8,
      pattern: [
        pz("中平中仄仄平韵"),
        pz("中仄平平中仄韵"),
        pz("中仄中平平仄仄"),
        pz("中平中仄仄平韵"),
        pz("中平中仄平平仄"),
        pz("中仄平平中仄韵"),
        pz("中仄中平平仄仄"),
        pz("中平中仄仄平韵"),
      ],
      rhymeLineIndices: [0, 1, 3, 5, 7],
    },
    {
      id: "qilü-shouju-ze",
      type: "lüshi",
      name: "七律·首句入韵·仄起",
      charPerLine: 7,
      lineCount: 8,
      pattern: [
        pz("中仄中平平仄韵"),
        pz("中平中仄仄平韵"),
        pz("中平中仄平平仄"),
        pz("中仄平平中仄韵"),
        pz("中仄中平平仄仄"),
        pz("中平中仄仄平韵"),
        pz("中平中仄平平仄"),
        pz("中仄平平中仄韵"),
      ],
      rhymeLineIndices: [0, 1, 3, 5, 7],
    },
    {
      id: "wulü-shouju-ping",
      type: "lüshi",
      name: "五律·首句入韵·平起",
      charPerLine: 5,
      lineCount: 8,
      pattern: [
        pz("中平中仄韵"),
        pz("中仄仄平韵"),
        pz("中仄平平仄"),
        pz("中平仄仄韵"),
        pz("中平中仄仄"),
        pz("中仄仄平韵"),
        pz("中仄平平仄"),
        pz("中平仄仄韵"),
      ],
      rhymeLineIndices: [0, 1, 3, 5, 7],
    },
    {
      id: "wulü-shouju-ze",
      type: "lüshi",
      name: "五律·首句入韵·仄起",
      charPerLine: 5,
      lineCount: 8,
      pattern: [
        pz("中仄中平韵"),
        pz("中平仄仄韵"),
        pz("中平中仄仄"),
        pz("中仄仄平韵"),
        pz("中仄平平仄"),
        pz("中平仄仄韵"),
        pz("中平中仄仄"),
        pz("中仄仄平韵"),
      ],
      rhymeLineIndices: [0, 1, 3, 5, 7],
    },
    {
      id: "qijue-pingqi",
      type: "jueju",
      name: "七绝·平起·首句不入韵",
      charPerLine: 7,
      lineCount: 4,
      pattern: [
        pz("中平中仄平平仄"),
        pz("中仄平平中仄韵"),
        pz("中仄中平平仄仄"),
        pz("中平中仄仄平韵"),
      ],
      rhymeLineIndices: [1, 3],
    },
    {
      id: "qijue-zeqi",
      type: "jueju",
      name: "七绝·仄起·首句不入韵",
      charPerLine: 7,
      lineCount: 4,
      pattern: [
        pz("中仄中平平仄仄"),
        pz("中平中仄仄平韵"),
        pz("中平中仄平平仄"),
        pz("中仄平平中仄韵"),
      ],
      rhymeLineIndices: [1, 3],
    },
    {
      id: "wujue-pingqi",
      type: "jueju",
      name: "五绝·平起·首句不入韵",
      charPerLine: 5,
      lineCount: 4,
      pattern: [pz("中平中仄仄"), pz("中仄仄平韵"), pz("中仄平平仄"), pz("中平仄仄韵")],
      rhymeLineIndices: [1, 3],
    },
    {
      id: "wujue-zeqi",
      type: "jueju",
      name: "五绝·仄起·首句不入韵",
      charPerLine: 5,
      lineCount: 4,
      pattern: [pz("中仄平平仄"), pz("中平仄仄韵"), pz("中平中仄仄"), pz("中仄仄平韵")],
      rhymeLineIndices: [1, 3],
    },
  ];
}
