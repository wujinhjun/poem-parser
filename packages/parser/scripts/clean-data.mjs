import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = process.cwd();
const DATA_DIR = resolve(ROOT, "data");
const OUT_DIR = resolve(DATA_DIR, "cleaned");
const CI_TUNES_SPLIT_DIR = resolve(OUT_DIR, "ci-tunes");

const RHYME_DICT_TYPE = {
  PINGSHUI: "pingshui",
  CILIN: "cilin",
  ZHONGHUA_NEW: "zhonghua_new",
  CI_RHYME: "ci_rhyme"
};

function isSingleHanChar(value) {
  if (typeof value !== "string") return false;
  const ch = value.trim();
  return [...ch].length === 1 && /^\p{Script=Han}$/u.test(ch);
}

function normalizeArrayToUniqueChars(values) {
  const set = new Set();
  for (const item of values ?? []) {
    if (!isSingleHanChar(item)) continue;
    set.add(item.trim());
  }
  return [...set];
}

function normalizeTone(raw) {
  if (!raw) return "未知";
  const value = String(raw).trim();
  if (["平", "阴平", "阳平", "上平", "下平", "平声"].includes(value)) return "平";
  if (["仄", "上声", "去声", "入声", "仄声"].includes(value)) return "仄";
  if (value === "多") return "多";
  return "未知";
}

function normalizeToneFromSectionName(sectionName) {
  const text = String(sectionName);
  if (text.includes("平")) return "平";
  if (text.includes("仄") || text.includes("入")) return "仄";
  return "未知";
}

function pushEntry(index, char, entry) {
  if (!index[char]) index[char] = [];
  const exists = index[char].some((it) =>
    it.dictType === entry.dictType &&
    it.tone === entry.tone &&
    it.rhymeGroup === entry.rhymeGroup &&
    (it.pronunciation ?? "") === (entry.pronunciation ?? "")
  );
  if (!exists) index[char].push(entry);
}

function toSortedObject(obj) {
  return Object.fromEntries(
    Object.entries(obj).sort(([a], [b]) => a.localeCompare(b, "zh-Hans-CN"))
  );
}

function toSafeFileName(name) {
  return String(name)
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/-+/g, "-");
}

async function readJson(fileName) {
  const text = await readFile(resolve(DATA_DIR, fileName), "utf8");
  return JSON.parse(text);
}

function buildPingshuiIndex(raw) {
  const index = {};
  for (const [sectionName, groups] of Object.entries(raw)) {
    const tone = normalizeToneFromSectionName(sectionName);
    for (const [rhymeGroup, chars] of Object.entries(groups ?? {})) {
      for (const char of normalizeArrayToUniqueChars(chars)) {
        pushEntry(index, char, {
          dictType: RHYME_DICT_TYPE.PINGSHUI,
          tone,
          rhymeGroup
        });
      }
    }
  }
  return index;
}

function buildCilinIndex(raw) {
  const index = {};
  for (const [partName, partContent] of Object.entries(raw)) {
    for (const [toneName, chars] of Object.entries(partContent ?? {})) {
      const tone = normalizeToneFromSectionName(toneName);
      const rhymeGroup = `${partName}-${toneName}`;
      for (const char of normalizeArrayToUniqueChars(chars)) {
        pushEntry(index, char, {
          dictType: RHYME_DICT_TYPE.CILIN,
          tone,
          rhymeGroup
        });
      }
    }
  }
  return index;
}

function buildXinyunIndex(raw) {
  const index = {};
  for (const [rhymeGroup, toneMap] of Object.entries(raw)) {
    for (const [toneName, chars] of Object.entries(toneMap ?? {})) {
      const tone = normalizeTone(toneName);
      for (const char of normalizeArrayToUniqueChars(chars)) {
        pushEntry(index, char, {
          dictType: RHYME_DICT_TYPE.ZHONGHUA_NEW,
          tone: tone === "多" ? "未知" : tone,
          rhymeGroup
        });
      }
    }
  }
  return index;
}

function buildCiWordTuneIndex(raw) {
  const index = {};
  for (const [char, data] of Object.entries(raw)) {
    if (!isSingleHanChar(char) || !data || typeof data !== "object") continue;
    const tone = normalizeTone(data.tune);
    const rhymeGroup = String(data.rhyme ?? "").trim() || "未知";
    pushEntry(index, char, {
      dictType: RHYME_DICT_TYPE.CI_RHYME,
      tone: tone === "多" ? "未知" : tone,
      rhymeGroup
    });
  }
  return index;
}

function mergeIndexes(...indexes) {
  const merged = {};
  for (const index of indexes) {
    for (const [char, entries] of Object.entries(index)) {
      for (const entry of entries) {
        pushEntry(merged, char, entry);
      }
    }
  }
  return toSortedObject(merged);
}

function buildToneLookup(rawToneMap) {
  const result = {};
  for (const [char, tone] of Object.entries(rawToneMap)) {
    if (!isSingleHanChar(char)) continue;
    result[char] = normalizeTone(tone);
  }
  return toSortedObject(result);
}

function buildWordExplain(rawExplain) {
  const output = {};
  for (const [char, items] of Object.entries(rawExplain)) {
    if (!isSingleHanChar(char) || !Array.isArray(items)) continue;
    const pronunciations = [];
    for (const item of items) {
      const pronunciation = String(item?.pronunciation ?? "").trim();
      if (!pronunciation) continue;
      pronunciations.push({
        pronunciation,
        explains: Array.isArray(item?.explains)
          ? item.explains.map((v) => String(v).trim()).filter(Boolean)
          : []
      });
    }
    if (pronunciations.length > 0) output[char] = pronunciations;
  }
  return toSortedObject(output);
}

function cleanCiCatalog(rawCatalog) {
  const output = {};
  for (const [category, items] of Object.entries(rawCatalog)) {
    if (!Array.isArray(items)) continue;
    output[category] = items
      .map((item) => ({
        name: String(item?.name ?? "").trim(),
        sketch: String(item?.tunes ?? "").replace(/\s+/g, " ").trim()
      }))
      .filter((item) => item.name);
  }
  return output;
}

function cleanCiTunes(rawCiTunes) {
  const output = {};
  for (const [tuneName, tuneData] of Object.entries(rawCiTunes)) {
    const formats = Array.isArray(tuneData?.formats) ? tuneData.formats : [];
    output[tuneName] = {
      desc: String(tuneData?.desc ?? "").trim(),
      formats: formats.map((format) => ({
        sketch: String(format?.sketch ?? "").replace(/\s+/g, " ").trim(),
        author: String(format?.author ?? "").trim(),
        desc: String(format?.desc ?? "").trim(),
        tunes: Array.isArray(format?.tunes)
          ? format.tunes.map((item) => ({
              tune: normalizeTone(item?.tune),
              rhythm: item?.rhythm ? String(item.rhythm).trim() : undefined,
              shift: String(item?.shift ?? "").toLowerCase() === "true"
            }))
          : []
      }))
    };
  }
  return output;
}

async function writeSplitCiTunes(ciTunes) {
  await rm(CI_TUNES_SPLIT_DIR, { recursive: true, force: true });
  await mkdir(CI_TUNES_SPLIT_DIR, { recursive: true });

  const index = [];
  for (const [tuneName, tuneData] of Object.entries(ciTunes)) {
    const fileName = `${toSafeFileName(tuneName)}.json`;
    const relativePath = `ci-tunes/${fileName}`;
    await writeFile(
      resolve(OUT_DIR, relativePath),
      `${JSON.stringify({ name: tuneName, ...tuneData }, null, 2)}\n`,
      "utf8"
    );
    index.push({
      name: tuneName,
      path: relativePath
    });
  }

  return index.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
}

function buildStats(charIndex) {
  const statsByType = {};
  let totalEntries = 0;
  for (const entries of Object.values(charIndex)) {
    totalEntries += entries.length;
    for (const entry of entries) {
      const key = entry.dictType;
      statsByType[key] ??= { chars: new Set(), entries: 0 };
      statsByType[key].chars.add(entry.rhymeGroup);
      statsByType[key].entries += 1;
    }
  }

  return {
    totalChars: Object.keys(charIndex).length,
    totalEntries,
    byDictType: Object.fromEntries(
      Object.entries(statsByType).map(([key, value]) => [
        key,
        {
          uniqueRhymeGroups: value.chars.size,
          entries: value.entries
        }
      ])
    )
  };
}

async function writeJson(fileName, data) {
  const target = resolve(OUT_DIR, fileName);
  await writeFile(target, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await rm(resolve(OUT_DIR, "ci-tunes-cleaned.json"), { force: true });

  const [
    pingshuiRaw,
    cilinRaw,
    xinyunRaw,
    xinyunFourRaw,
    wordTuneRaw,
    wordExplainRaw,
    ciWordTuneRaw,
    ciCatalogRaw,
    ciTunesRaw
  ] = await Promise.all([
    readJson("Pingshui_Rhyme.json"),
    readJson("Cilin_Rhyme.json"),
    readJson("Xinyun_Rhyme.json"),
    readJson("Xinyun_Rhyme_FourRhyme_Edition.json"),
    readJson("Word_Tune.json"),
    readJson("Word_Explain.json"),
    readJson("Ci_Word_Tune.json"),
    readJson("Ci_Catalog.json"),
    readJson("Ci_Tunes.json")
  ]);

  const pingshuiIndex = buildPingshuiIndex(pingshuiRaw);
  const cilinIndex = buildCilinIndex(cilinRaw);
  const xinyunIndex = buildXinyunIndex(xinyunRaw);
  const xinyunFourIndex = buildXinyunIndex(xinyunFourRaw);
  const ciWordIndex = buildCiWordTuneIndex(ciWordTuneRaw);

  const merged = mergeIndexes(
    pingshuiIndex,
    cilinIndex,
    xinyunIndex,
    xinyunFourIndex,
    ciWordIndex
  );

  const toneLookup = buildToneLookup(wordTuneRaw);
  const explainLookup = buildWordExplain(wordExplainRaw);
  const ciCatalog = cleanCiCatalog(ciCatalogRaw);
  const ciTunes = cleanCiTunes(ciTunesRaw);
  const ciTuneIndex = await writeSplitCiTunes(ciTunes);

  await Promise.all([
    writeJson("rhyme-char-index.json", merged),
    writeJson("tone-lookup.json", toneLookup),
    writeJson("word-explain-cleaned.json", explainLookup),
    writeJson("ci-catalog-cleaned.json", ciCatalog),
    writeJson("ci-tunes-index.json", ciTuneIndex),
    writeJson("stats.json", {
      generatedAt: new Date().toISOString(),
      rhyme: buildStats(merged),
      toneLookupSize: Object.keys(toneLookup).length,
      explainLookupSize: Object.keys(explainLookup).length,
      ciTuneCount: Object.keys(ciTunes).length
    })
  ]);

  process.stdout.write(`Data cleaned into: ${OUT_DIR}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error?.stack ?? error}\n`);
  process.exitCode = 1;
});
