/**
 * 示例：杜甫《登高》
 * 用法: pnpm build && node scripts/example-denggao.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { analyzeSync, loadMeterTemplates } from "../dist/kernel.js";
import { createRhymeDict } from "../dist/rhyme-dict/loader.js";

const DATA_DIR = resolve("./data");

const text = [
  "风急天高猿啸哀，", "渚清沙白鸟飞回。",
  "无边落木萧萧下，", "不尽长江滚滚来。",
  "万里悲秋常作客，", "百年多病独登台。",
  "艰难苦恨繁霜鬓，", "潦倒新停浊酒杯。",
].join("\n");

const dict = await createRhymeDict("pingshui", DATA_DIR);
const template = loadMeterTemplates().find((t) => t.id === "qilü-shouju-ze");
const result = analyzeSync(text, template, dict);

console.log(`模板: ${result.bestMatch.templateId}`);
console.log(`合律率: ${(result.complianceRate * 100).toFixed(1)}%`);
console.log(`完全合律: ${result.fullyCompliant}`);
console.log(`韵脚: ${result.ast.lines.filter((l) => l.isRhymeLine).map((l) => l.rhymeChar?.char).join(" ")}`);
