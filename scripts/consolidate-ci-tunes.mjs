/**
 * 词谱文件合并脚本
 *
 * 将 818 个词谱文件合并为约 50 个：
 * - TOP 30 常用词牌单独成文件
 * - 其余词牌按拼音首字母分组
 */

import { readFileSync, writeFileSync, readdirSync, unlinkSync, rmdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const DATA_DIR = resolve("./data");
const TUNES_DIR = resolve(DATA_DIR, "ci-tunes");
const INDEX_PATH = resolve(DATA_DIR, "ci-tunes-index.json");

// 获取汉字拼音首字母（简化版）
function getPyInitial(char) {
  const code = char.charCodeAt(0);
  // 常用字拼音首字母映射（简化）
  const map = {
    // A-Z 常用汉字
    '啊': 'a', '阿': 'a', '爱': 'a', '安': 'a', '暗': 'a',
    '把': 'b', '八': 'b', '百': 'b', '半': 'b', '帮': 'b',
    '才': 'c', '采': 'c', '长': 'c', '常': 'c', '朝': 'c',
    '大': 'd', '当': 'd', '道': 'd', '得': 'd', '蝶': 'd',
    '二': 'e', '儿': 'e',
    '发': 'f', '风': 'f', '飞': 'f', '夫': 'f', '福': 'f',
    '高': 'g', '哥': 'g', '古': 'g', '故': 'g', '观': 'g',
    '好': 'h', '花': 'h', '黄': 'h', '回': 'h', '红': 'h',
    '家': 'j', '见': 'j', '江': 'j', '今': 'j', '九': 'j',
    '可': 'k', '开': 'k', '看': 'k', '空': 'k',
    '了': 'l', '来': 'l', '里': 'l', '林': 'l', '临': 'l',
    '妈': 'm', '马': 'm', '满': 'm', '梅': 'm', '明': 'm',
    '你': 'n', '那': 'n', '南': 'n', '年': 'n', '念': 'n',
    '哦': 'o', '欧': 'o',
    '怕': 'p', '平': 'p', '葡': 'p',
    '七': 'q', '青': 'q', '秋': 'q', '清': 'q', '秦': 'q',
    '人': 'r', '日': 'r', '如': 'r',
    '是': 's', '三': 's', '山': 's', '上': 's', '生': 's',
    '他': 't', '天': 't', '同': 't', '头': 't',
    '我': 'w', '无': 'w', '五': 'w', '望': 'w',
    '下': 'x', '小': 'x', '西': 'x', '心': 'x', '相': 'x',
    '呀': 'y', '呀': 'y', '也': 'y', '一': 'y', '以': 'y',
    '在': 'z', '中': 'z', '主': 'z', '字': 'z', '最': 'z',
  };
  return map[char] || char;
}

function getWordPyInitial(word) {
  if (!word) return 'other';
  const first = getPyInitial(word[0]);
  if (first >= 'a' && first <= 'z') return first;
  return 'other';
}

// 扫描所有 tune 文件
const files = readdirSync(TUNES_DIR).filter(f => f.endsWith('.json') && f !== 'ci-tunes-index.json');

// 读取所有词牌数据
const tuneData = [];
for (const file of files) {
  const filePath = resolve(TUNES_DIR, file);
  const data = JSON.parse(readFileSync(filePath, "utf8"));
  // 分组文件是数组，单个文件是对象
  if (Array.isArray(data)) {
    // 分组文件
    for (const item of data) {
      tuneData.push({
        name: item.name,
        path: `ci-tunes/${file}`,
        formatCount: item.formats?.length ?? 1,
        isGrouped: true
      });
    }
  } else {
    tuneData.push({
      name: data.name,
      path: `ci-tunes/${file}`,
      formatCount: data.formats?.length ?? 1,
      isGrouped: false
    });
  }
}

// 按变体数量排序
tuneData.sort((a, b) => b.formatCount - a.formatCount);

// 分出 TOP 30 和其余
const TOP_N = 30;
const topTunes = tuneData.filter(t => !t.isGrouped).slice(0, TOP_N);
const otherTunes = tuneData.filter(t => !t.isGrouped).slice(TOP_N);
const groupedTunes = tuneData.filter(t => t.isGrouped);

// 按拼音首字母分组
const groups = {};
for (const tune of [...otherTunes, ...groupedTunes]) {
  const initial = getWordPyInitial(tune.name);
  if (!groups[initial]) groups[initial] = [];
  groups[initial].push(tune);
}

// 输出分组信息
console.log("分组结果:");
console.log(`TOP ${TOP_N} 词牌单独成文件`);
Object.entries(groups)
  .sort((a, b) => a[0].localeCompare(b[0]))
  .forEach(([initial, tunes]) => {
    console.log(`  ${initial.toUpperCase()}: ${tunes.length} 词牌`);
  });

// 创建新的索引 - 二级结构
const newIndex = {
  // 分组列表（用于遍历）
  groups: [],
  // 词牌名 -> 文件路径 映射（用于快速查找）
  index: {}
};

// 1. TOP 词牌单独文件
for (const tune of topTunes) {
  const path = `ci-tunes/${tune.name}.json`;
  newIndex.groups.push({
    name: tune.name,
    path: path,
    isGroup: false
  });
  newIndex.index[tune.name] = path;
}

// 2. 分组文件
const groupEntries = Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
for (const [initial, tunes] of groupEntries) {
  const groupPath = `ci-tunes/group-${initial}.json`;
  newIndex.groups.push({
    name: `group:${initial.toUpperCase()}`,
    path: groupPath,
    isGroup: true,
    count: tunes.length,
    tunes: tunes.map(t => t.name) // 组内词牌列表
  });
  for (const tune of tunes) {
    newIndex.index[tune.name] = groupPath;
  }
}

// 输出新的索引
console.log("\n新的索引文件:");
console.log(`groups: ${newIndex.groups.length} 条`);
console.log(`index: ${Object.keys(newIndex.index).length} 条`);
console.log("\n示例 - groups 前3条:");
console.log(JSON.stringify(newIndex.groups.slice(0, 3), null, 2));
console.log("\n示例 - index 前3条:");
const indexEntries = Object.entries(newIndex.index).slice(0, 3);
console.log(Object.fromEntries(indexEntries));

// 分组文件已存在，无需重新写入
console.log("\n跳过写入 - 分组文件已存在");

// 更新索引文件
writeFileSync(INDEX_PATH, JSON.stringify(newIndex, null, 2));
console.log(`\n更新索引: ${INDEX_PATH}`);

console.log("\n完成！");
console.log(`- 保留 ${topTunes.length} 个单独词牌文件`);
console.log(`- groups: ${newIndex.groups.length} 条`);
console.log(`- index: ${Object.keys(newIndex.index).length} 条`);
