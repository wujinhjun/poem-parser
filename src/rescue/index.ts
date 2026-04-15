import { CoupletNode, RescueDetail, Tone } from "../core/types.js";
import { RhymeDict } from "../rhyme-dict/index.js";
import { MeterTemplate } from "../templates/index.js";

function fixedMismatchCols(coupletLine: CoupletNode["upper"], expected: MeterTemplate["pattern"][number]) {
  const cols: number[] = [];
  for (let col = 0; col < expected.length; col += 1) {
    const exp = expected[col];
    const actual = coupletLine.chars[col];
    if (!actual || exp.type !== "fixed") continue;
    if (actual.tone !== exp.tone) cols.push(col);
  }
  return cols;
}

function detectBenjuZijiou(
  line: CoupletNode["upper"],
  expected: MeterTemplate["pattern"][number],
): RescueDetail[] {
  const mismatchCols = fixedMismatchCols(line, expected);
  if (mismatchCols.length !== 1) return [];

  const naoCol = mismatchCols[0];
  const rescueCol = expected.findIndex(
    (constraint, idx) =>
      idx !== naoCol &&
      constraint.type === "fixed" &&
      line.chars[idx] &&
      line.chars[idx].tone === constraint.tone,
  );
  if (rescueCol < 0) return [];

  return [
    {
      type: "benju-zijiou",
      naoPosition: { line: line.globalLineIndex, col: naoCol },
      jiuPosition: { line: line.globalLineIndex, col: rescueCol },
      description: "本句出现单点失粘，句内检测到可视作补偿的合律位",
    },
  ];
}

function detectSansiHujiou(
  line: CoupletNode["upper"],
  expected: MeterTemplate["pattern"][number],
): RescueDetail[] {
  if (expected.length < 4) return [];
  const third = 2;
  const fourth = 3;
  const e3 = expected[third];
  const e4 = expected[fourth];
  const a3 = line.chars[third];
  const a4 = line.chars[fourth];
  if (!a3 || !a4 || e3.type !== "fixed" || e4.type !== "fixed") return [];

  const isThirdMismatch = a3.tone !== e3.tone;
  const isFourthMismatch = a4.tone !== e4.tone;
  if (!(isThirdMismatch && isFourthMismatch)) return [];

  return [
    {
      type: "sansi-hujiou",
      naoPosition: { line: line.globalLineIndex, col: third },
      jiuPosition: { line: line.globalLineIndex, col: fourth },
      description: "检测到三四字互拗互救形态（启发式）",
    },
  ];
}

function detectDuijuXiangjiou(
  upper: CoupletNode["upper"],
  lower: CoupletNode["lower"],
  upperExpected: MeterTemplate["pattern"][number],
  lowerExpected: MeterTemplate["pattern"][number],
): RescueDetail[] {
  const max = Math.min(upperExpected.length, lowerExpected.length);
  const rescues: RescueDetail[] = [];

  for (let col = 0; col < max; col += 1) {
    const ue = upperExpected[col];
    const le = lowerExpected[col];
    const ua = upper.chars[col];
    const la = lower.chars[col];
    if (!ua || !la || ue.type !== "fixed" || le.type !== "fixed") continue;

    const upperMismatch = ua.tone !== ue.tone;
    const lowerMatch = la.tone === le.tone;
    if (upperMismatch && lowerMatch) {
      rescues.push({
        type: "duiju-xiangjiou",
        naoPosition: { line: upper.globalLineIndex, col },
        jiuPosition: { line: lower.globalLineIndex, col },
        description: "出句该位失粘，对句对应位合律，判定为对句相救（启发式）",
      });
    }
  }

  return rescues;
}

function detectGupingJiou(
  line: CoupletNode["upper"],
  expected: MeterTemplate["pattern"][number],
): RescueDetail[] {
  if (expected.length < 5 || line.chars.length < 5) return [];
  const nonRhyme = line.chars.slice(0, -1);
  const pingCols = nonRhyme
    .map((char, idx) => (char.tone === Tone.Ping ? idx : -1))
    .filter((idx) => idx >= 0);
  if (pingCols.length !== 1) return [];

  const mismatchCols = fixedMismatchCols(line, expected);
  if (!mismatchCols.includes(pingCols[0])) return [];

  return [
    {
      type: "guping-jiou",
      naoPosition: { line: line.globalLineIndex, col: pingCols[0] },
      jiuPosition: { line: line.globalLineIndex, col: Math.max(0, pingCols[0] - 1) },
      description: "疑似孤平并在邻位观察到补偿结构（启发式）",
    },
  ];
}

export function analyzeRescue(
  couplet: CoupletNode,
  template: MeterTemplate,
  _dict: RhymeDict,
): RescueDetail[] {
  const rescues: RescueDetail[] = [];
  const upperExpected = template.pattern[couplet.upper.globalLineIndex];
  const lowerExpected = template.pattern[couplet.lower.globalLineIndex];
  if (!upperExpected || !lowerExpected) return rescues;

  rescues.push(...detectBenjuZijiou(couplet.upper, upperExpected));
  rescues.push(...detectBenjuZijiou(couplet.lower, lowerExpected));
  rescues.push(...detectSansiHujiou(couplet.upper, upperExpected));
  rescues.push(...detectSansiHujiou(couplet.lower, lowerExpected));
  rescues.push(...detectDuijuXiangjiou(couplet.upper, couplet.lower, upperExpected, lowerExpected));
  rescues.push(...detectGupingJiou(couplet.upper, upperExpected));
  rescues.push(...detectGupingJiou(couplet.lower, lowerExpected));

  return rescues;
}
