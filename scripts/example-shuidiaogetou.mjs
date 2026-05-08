import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { analyzeSync } from "../dist/kernel.js";
import { createRhymeDict } from "../dist/rhyme-dict/loader.js";

const DATA_DIR = resolve("./data");
function loadCiBundle() { return JSON.parse(readFileSync(resolve(DATA_DIR, "ci-tunes-bundle.json"), "utf8")); }

const text = [
  '明月几时有？把酒问青天。',
  '不知天上宫阙，今夕是何年。',
  '我欲乘风归去，又恐琼楼玉宇，高处不胜寒。',
  '起舞弄清影，何似在人间。',
  '转朱阁，低绮户，照无眠。',
  '不应有恨，何事长向别时圆？',
  '人有悲欢离合，月有阴晴圆缺，此事古难全。',
  '但愿人长久，千里共婵娟。',
].join('\n');

const dict = await createRhymeDict("cilin", DATA_DIR);
const template = loadCiBundle()["水调歌头"];
const result = analyzeSync(text, template, dict, { variantId: "水调歌头-v3" });

console.log(`模板: ${result.bestMatch?.templateId}`);
console.log(`合律率: ${(result.complianceRate * 100).toFixed(1)}%`);
console.log(`完全合律: ${result.fullyCompliant}`);
console.log(`韵脚: ${result.ast.lines.filter((l) => l.isRhymeLine).map((l) => l.rhymeChar?.char).join(" ")}`);
