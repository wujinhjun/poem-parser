import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { RhymeDictType, Tone } from "../core/types.js";

export interface RhymeEntry {
  char: string;
  tone: Tone;
  rhymeGroup: string;
  pronunciation?: string;
}

export interface RhymeDict {
  type: RhymeDictType;
  lookup(char: string): RhymeEntry[];
  getRhymeGroup(char: string): string[];
  isSameRhyme(a: string, b: string): boolean;
}

type RawRhymeItem = {
  dictType: "pingshui" | "cilin" | "zhonghua_new" | "ci_rhyme";
  tone: "平" | "仄" | "未知";
  rhymeGroup: string;
};

type RhymeIndex = Record<string, RawRhymeItem[]>;
type ToneLookup = Record<string, "平" | "仄" | "多" | "未知">;

let rhymeIndexCache: RhymeIndex | null = null;
let toneLookupCache: ToneLookup | null = null;

function toTone(raw: RawRhymeItem["tone"]): Tone {
  if (raw === Tone.Ping) return Tone.Ping;
  if (raw === Tone.Ze) return Tone.Ze;
  return Tone.Unknown;
}

async function loadRhymeIndex(): Promise<RhymeIndex> {
  if (rhymeIndexCache) return rhymeIndexCache;
  const file = resolve(process.cwd(), "data", "rhyme-char-index.json");
  const content = await readFile(file, "utf8");
  rhymeIndexCache = JSON.parse(content) as RhymeIndex;
  return rhymeIndexCache;
}

async function loadToneLookup(): Promise<ToneLookup> {
  if (toneLookupCache) return toneLookupCache;
  const file = resolve(process.cwd(), "data", "tone-lookup.json");
  const content = await readFile(file, "utf8");
  toneLookupCache = JSON.parse(content) as ToneLookup;
  return toneLookupCache;
}

function buildFallbackEntries(char: string, toneLookup: ToneLookup): RhymeEntry[] {
  const tone = toneLookup[char];
  if (!tone || tone === "未知") return [];
  if (tone === "平") {
    return [{ char, tone: Tone.Ping, rhymeGroup: "" }];
  }
  if (tone === "仄") {
    return [{ char, tone: Tone.Ze, rhymeGroup: "" }];
  }
  if (tone === "多") {
    return [
      { char, tone: Tone.Ping, rhymeGroup: "" },
      { char, tone: Tone.Ze, rhymeGroup: "" },
    ];
  }
  return [];
}

class JsonRhymeDict implements RhymeDict {
  public readonly type: RhymeDictType;
  private readonly index: RhymeIndex;
  private readonly toneLookup: ToneLookup;

  public constructor(type: RhymeDictType, index: RhymeIndex, toneLookup: ToneLookup) {
    this.type = type;
    this.index = index;
    this.toneLookup = toneLookup;
  }

  public lookup(char: string): RhymeEntry[] {
    const raw = this.index[char] ?? [];
    const primary = raw
      .filter((entry) => entry.dictType === this.type)
      .map((entry) => ({
        char,
        tone: toTone(entry.tone),
        rhymeGroup: entry.rhymeGroup,
      }));

    const knownPrimary = primary.filter((entry) => entry.tone !== Tone.Unknown);
    if (knownPrimary.length > 0) return knownPrimary;

    const fallback = buildFallbackEntries(char, this.toneLookup);
    if (fallback.length === 0) return primary;
    if (primary.length === 0) return fallback;

    // 主字典只有韵部、无可用平仄时：用 fallback 声调回填，保留主字典韵部。
    const merged: RhymeEntry[] = [];
    for (const primaryEntry of primary) {
      for (const fallbackEntry of fallback) {
        merged.push({
          char,
          tone: fallbackEntry.tone,
          rhymeGroup: primaryEntry.rhymeGroup,
        });
      }
    }
    return merged;
  }

  public getRhymeGroup(char: string): string[] {
    return [...new Set(this.lookup(char).map((item) => item.rhymeGroup))];
  }

  public isSameRhyme(a: string, b: string): boolean {
    const aSet = new Set(this.getRhymeGroup(a));
    const bGroups = this.getRhymeGroup(b);
    return bGroups.some((group) => aSet.has(group));
  }
}

export async function createRhymeDict(type: RhymeDictType): Promise<RhymeDict> {
  const index = await loadRhymeIndex();
  const toneLookup = await loadToneLookup();
  return new JsonRhymeDict(type, index, toneLookup);
}
