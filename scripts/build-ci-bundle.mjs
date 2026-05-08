/**
 * 词牌合并脚本
 *
 * 将 data/ci-tunes/ 下所有词牌解析为 CiTemplate 格式，
 * 合并输出为单个 data/ci-tunes-bundle.json。
 *
 * 用法: node scripts/build-ci-bundle.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DATA_DIR = resolve("./data");
const INDEX_PATH = resolve(DATA_DIR, "ci-tunes-index.json");
const BUNDLE_PATH = resolve(DATA_DIR, "ci-tunes-bundle.json");

// ---- 解析逻辑（与 src/templates/index.ts 一致） ----

function toneToConstraint(tune, rhythm) {
  if (rhythm === "韵") return { type: "rhyme" };
  if (tune === "平") return { type: "fixed", tone: "平" };
  if (tune === "仄") return { type: "fixed", tone: "仄" };
  return { type: "flexible" };
}

function parseRawTune(raw) {
  const variants = raw.formats.map((fmt, index) => {
    const lines = [];
    let currentLine = { charCount: 0, pattern: [], isRhymeLine: false };

    for (const item of fmt.tunes) {
      currentLine.pattern.push(toneToConstraint(item.tune, item.rhythm));
      currentLine.charCount += 1;
      if (item.rhythm === "韵") {
        currentLine.isRhymeLine = true;
        currentLine.rhymeType = item.tune === "仄" ? "ze" : "ping";
      }
      if (item.shift) {
        currentLine.rhymeSwitch = item.tune === "仄" ? "ze" : "ping";
      }
      if (item.rhythm === "句" || item.rhythm === "韵") {
        lines.push(currentLine);
        currentLine = { charCount: 0, pattern: [], isRhymeLine: false };
      }
    }
    if (currentLine.pattern.length > 0) lines.push(currentLine);

    const middle = Math.ceil(lines.length / 2);
    const sections = [
      { name: "上阕", lines: lines.slice(0, middle) },
      { name: "下阕", lines: lines.slice(middle) },
    ].filter((s) => s.lines.length > 0);

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

  return { id: raw.name, name: raw.name, variants };
}

// ---- 主流程 ----

const index = JSON.parse(readFileSync(INDEX_PATH, "utf8"));

// 收集所有需要读取的文件（去重）
const fileSet = new Set();
for (const group of index.groups) {
  fileSet.add(resolve(DATA_DIR, group.path));
}

const bundle = Object.create(null);
let total = 0;

for (const filePath of fileSet) {
  const data = JSON.parse(readFileSync(filePath, "utf8"));

  // 分组文件是数组，单文件是对象
  const tunes = Array.isArray(data) ? data : [data];

  for (const raw of tunes) {
    if (bundle[raw.name]) continue; // 去重
    bundle[raw.name] = parseRawTune(raw);
    total++;
  }
}

writeFileSync(BUNDLE_PATH, JSON.stringify(bundle, null, 2));
console.log(`写入: ${BUNDLE_PATH}`);
console.log(`词牌数: ${total}`);
console.log(`文件大小: ${(Buffer.byteLength(JSON.stringify(bundle)) / 1024 / 1024).toFixed(1)} MB`);
