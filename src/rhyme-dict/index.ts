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

const TONE_MAP: Record<string, Tone> = { 平: Tone.Ping, 仄: Tone.Ze };
function toTone(raw: RawRhymeItem["tone"]): Tone {
  return TONE_MAP[raw] ?? Tone.Unknown;
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
    // 优先从 tone-lookup 获取音调信息（更完整）
    const toneInfo = this.toneLookup[char];
    const raw = this.index[char] ?? [];

    // 获取当前韵书类型的韵部信息
    const rhymeGroupsForType = raw
      .filter((entry) => entry.dictType === this.type)
      .map((entry) => entry.rhymeGroup)
      .filter(Boolean);

    // 如果 tone-lookup 有记录，以它为准
    if (toneInfo && toneInfo !== "未知") {
      const toneEntries: RhymeEntry[] = [];

      if (toneInfo === "平") {
        // 单音平声：使用韵书中的韵部
        const groups = rhymeGroupsForType.length > 0 ? rhymeGroupsForType : [""];
        for (const group of groups) {
          toneEntries.push({ char, tone: Tone.Ping, rhymeGroup: group });
        }
      } else if (toneInfo === "仄") {
        // 单音仄声
        const groups = rhymeGroupsForType.length > 0 ? rhymeGroupsForType : [""];
        for (const group of groups) {
          toneEntries.push({ char, tone: Tone.Ze, rhymeGroup: group });
        }
      } else if (toneInfo === "多") {
        // 多音字：同时返回平仄两种
        const pingGroups = rhymeGroupsForType.length > 0
          ? rhymeGroupsForType
          : [""];
        for (const group of pingGroups) {
          toneEntries.push({ char, tone: Tone.Ping, rhymeGroup: group });
        }
        // 仄声也尝试获取韵部
        const zeGroups = raw
          .filter((entry) => entry.dictType === this.type && entry.tone === "仄")
          .map((entry) => entry.rhymeGroup)
          .filter(Boolean);
        const finalZeGroups = zeGroups.length > 0 ? zeGroups : [""];
        for (const group of finalZeGroups) {
          toneEntries.push({ char, tone: Tone.Ze, rhymeGroup: group });
        }
      }

      // 如果有有效音调，直接返回（去重）
      const validEntries = toneEntries.filter(e => e.tone !== Tone.Unknown);
      if (validEntries.length > 0) {
        return validEntries;
      }
    }

    // fallback：使用 rhyme-char-index 的数据
    const primary = raw
      .filter((entry) => entry.dictType === this.type)
      .map((entry) => ({
        char,
        tone: toTone(entry.tone),
        rhymeGroup: entry.rhymeGroup,
      }));

    const knownPrimary = primary.filter((entry) => entry.tone !== Tone.Unknown);
    if (knownPrimary.length > 0) return knownPrimary;

    return primary;
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
