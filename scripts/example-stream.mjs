import { analyzeStream } from '../dist/analyzer/index.js';

async function main() {
  // 测试：苏轼《水调歌头》前60字
  const text = '明月几时有？把酒问青天。不知天上宫阙，今夕是何年。我欲乘风归去，又恐琼楼玉宇，高处不胜寒。起舞弄清影，何似在';
  const result = await analyzeStream(text, '水调歌头', {
    variantId: '水调歌头-v3',
    rhymeDictType: 'cilin',
  });

  console.log('=== 流式解析结果 ===');
  console.log(`模板: ${result.templateId}`);
  console.log(`变体: ${result.variantId}`);
  console.log(`模板总句数: ${result.totalSentences}`);
  console.log(`每句字数: ${result.sentenceCharCounts.join(', ')}`);
  console.log(`输入总字数: ${result.totalCharCount}`);
  console.log(`已解析句数: ${result.parsedSentenceCount}`);
  console.log();

  console.log('=== 句汇总 ===');
  for (const s of result.sentenceSummaries) {
    const status = s.isComplete ? '✓' : '○';
    const valid = s.isValid ? '合律' : '不合律';
    console.log(
      `句${s.sentenceIndex + 1}: ${s.charCount}/${s.sentenceCharCount}字, 还差${s.remaining}字, ${status} ${valid}, 匹配${s.matchedCount}/${s.checkableCount}`
    );
  }
  console.log();

  console.log('=== 最后一句详情 ===');
  // 显示最后一个有内容的句子（第9句，index=8）
  const lastSegs = result.segments.filter(s => s.sentenceIndex === 8);
  for (const seg of lastSegs) {
    const mismatch = seg.validation.mismatches[0];
    const check = mismatch ? '✗' : '○';
    console.log(
      `  字${seg.startCol + 1}「${seg.text}」期望${mismatch ? mismatch.expected : '合'} ` +
      `实际${mismatch ? mismatch.actual : '合'}, ${check} ${seg.sentenceRemaining > 0 ? `还差${seg.sentenceRemaining}字` : '(完整)'}`
    );
  }
}

main().catch(console.error);
