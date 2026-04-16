import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

export interface CiTemplateLine {
  charCount: number;
  pattern: ToneConstraint[];
  isRhymeLine: boolean;
  rhymeType?: "ping" | "ze";
  rhymeSwitch?: "ping" | "ze";
}

export interface CiTemplateSection {
  name: string;
  lines: CiTemplateLine[];
}

export interface CiTemplateVariant {
  id: string;
  name: string;
  sketch?: string;
  author?: string;
  source?: string;
  rhymeType?: "ping" | "ze" | "mixed";
  sections: CiTemplateSection[];
}

export interface CiTemplate {
  id: string;
  name: string;
  aliases?: string[];
  variants: CiTemplateVariant[];
  source?: string;
}

export type AnyTemplate = MeterTemplate | CiTemplate;
type CiTuneIndexItem = { name: string; path: string };
type RawTuneItem = { tune: "平" | "仄" | "未知"; rhythm?: "句" | "韵"; shift?: boolean };
type RawFormat = {
  sketch?: string;
  author?: string;
  desc?: string;
  tunes: RawTuneItem[];
};
type RawCiTune = {
  name: string;
  desc?: string;
  formats: RawFormat[];
};

const P = (tone: Tone): ToneConstraint => ({ type: "fixed", tone });
const Z = (tone: Tone): ToneConstraint => ({ type: "fixed", tone });
const F: ToneConstraint = { type: "flexible" };
const R: ToneConstraint = { type: "rhyme" };
const ciTemplateCache = new Map<string, CiTemplate>();
let ciTuneIndexCache: CiTuneIndexItem[] | null = null;

function pz(pattern: string): ToneConstraint[] {
  return [...pattern].map((ch) => {
    if (ch === "平") return P(Tone.Ping);
    if (ch === "仄") return Z(Tone.Ze);
    if (ch === "中") return F;
    if (ch === "韵") return R;
    return F;
  });
}

function tuneToConstraint(
  tune: "平" | "仄" | "未知",
  rhythm: "韵" | "句" | undefined,
): ToneConstraint {
  if (rhythm === "韵") return { type: "rhyme" };
  if (tune === "平") return { type: "fixed", tone: Tone.Ping };
  if (tune === "仄") return { type: "fixed", tone: Tone.Ze };
  return { type: "flexible" };
}

function loadCiTuneIndex(): CiTuneIndexItem[] {
  if (ciTuneIndexCache) return ciTuneIndexCache;
  const indexPath = resolve(process.cwd(), "data", "ci-tunes-index.json");
  ciTuneIndexCache = JSON.parse(readFileSync(indexPath, "utf8")) as CiTuneIndexItem[];
  return ciTuneIndexCache;
}

function buildCiTemplateFromIndexItem(item: CiTuneIndexItem): CiTemplate {
  const cached = ciTemplateCache.get(item.name);
  if (cached) return cached;

  const raw = JSON.parse(readFileSync(resolve(process.cwd(), "data", item.path), "utf8")) as RawCiTune;
  const variants: CiTemplateVariant[] = raw.formats.map((fmt, index) => {
    const lines: CiTemplateLine[] = [];
    let currentLine: CiTemplateLine = {
      charCount: 0,
      pattern: [],
      isRhymeLine: false,
    };

    for (const tuneItem of fmt.tunes) {
      currentLine.pattern.push(tuneToConstraint(tuneItem.tune, tuneItem.rhythm));
      currentLine.charCount += 1;
      if (tuneItem.rhythm === "韵") {
        currentLine.isRhymeLine = true;
        currentLine.rhymeType = tuneItem.tune === "仄" ? "ze" : "ping";
      }
      if (tuneItem.shift) {
        currentLine.rhymeSwitch = tuneItem.tune === "仄" ? "ze" : "ping";
      }
      if (tuneItem.rhythm === "句" || tuneItem.rhythm === "韵") {
        lines.push(currentLine);
        currentLine = {
          charCount: 0,
          pattern: [],
          isRhymeLine: false,
        };
      }
    }
    if (currentLine.pattern.length > 0) {
      lines.push(currentLine);
    }

    const middle = Math.ceil(lines.length / 2);
    const sections: CiTemplateSection[] = [
      { name: "上阕", lines: lines.slice(0, middle) },
      { name: "下阕", lines: lines.slice(middle) },
    ].filter((section) => section.lines.length > 0);

    return {
      id: `${raw.name}-v${index + 1}`,
      name: fmt.sketch ?? `变体${index + 1}`,
      sketch: fmt.sketch,
      author: fmt.author,
      source: fmt.desc,
      rhymeType: "mixed",
      sections,
    };
  });

  const parsed: CiTemplate = {
    id: raw.name,
    name: raw.name,
    aliases: [],
    variants,
    source: raw.desc,
  };
  ciTemplateCache.set(item.name, parsed);
  return parsed;
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

export function loadCiTemplates(options?: { limit?: number }): CiTemplate[] {
  const index = loadCiTuneIndex();
  const selected = options?.limit ? index.slice(0, options.limit) : index;
  return selected.map(buildCiTemplateFromIndexItem).filter((item) => item.variants.length > 0);
}

export function getCandidates(meta: {
  lineCount: number;
  charsPerLine: number[];
}): AnyTemplate[] {
  const meters = loadMeterTemplates().filter((template) => {
    if (template.lineCount !== meta.lineCount) return false;
    return meta.charsPerLine.every((count) => count === template.charPerLine);
  });
  const ciTemplates = loadCiTemplates({ limit: 30 });
  return [...meters, ...ciTemplates];
}

export function getTemplateById(id: string): AnyTemplate | undefined {
  const meter = loadMeterTemplates().find((template) => template.id === id);
  if (meter) return meter;

  const ciByName = loadCiTuneIndex().find((item) => item.name === id);
  if (ciByName) return buildCiTemplateFromIndexItem(ciByName);

  return loadCiTemplates().find((template) => template.id === id);
}
