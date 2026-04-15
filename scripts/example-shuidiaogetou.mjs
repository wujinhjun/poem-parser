import { analyze, toCLI } from '../dist/index.js';

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

function printSection(title, result) {
  console.log(`\n=== ${title} ===`);
  console.log(`summary: ${result.summary}`);
  console.log(
    `bestMatch: ${result.bestMatch ? result.bestMatch.templateId : 'null'}`,
  );
  console.log(
    `confidence: ${result.bestMatch ? (result.bestMatch.confidence * 100).toFixed(1) + '%' : 'n/a'}`,
  );
  console.log(`ast.type: ${result.ast.type}`);
  console.log(`lines: ${result.ast.lines.length}`);
  console.log(
    `sections: ${
      result.ast.sections
        ?.map((section) => `${section.name}:${section.lines.length}`)
        .join(' | ') ?? '(none)'
    }`,
  );
  console.log(
    `rhymeChars: ${
      result.ast.lines
        .filter((line) => line.isRhymeLine)
        .map((line) => line.rhymeChar?.char ?? '')
        .join(', ') || '(none)'
    }`,
  );
  console.log(
    `ambiguities: ${result.ambiguities.map((item) => item.char).join(', ') || '(none)'}`,
  );
  console.log(`isCompliant: ${result.isCompliant}`);
  console.log(`complianceRate: ${(result.complianceRate * 100).toFixed(1)}%`);
  console.log('lineValidations:');
  result.lineValidations.forEach((item) => {
    console.log(
      `  line ${item.lineIndex + 1}: ${item.matchedCount}/${item.checkableCount} matched, mismatches=${item.mismatchCount}, compliant=${item.isCompliant}`,
    );
    const mismatchDetails = item.charChecks.filter((check) => !check.matched);
    if (mismatchDetails.length > 0) {
      mismatchDetails.forEach((check) => {
        console.log(
          `    - 字${check.col + 1}「${check.char}」 expected=${check.expected}, actual=${check.actual}, reason=${check.reason ?? "n/a"}`,
        );
      });
    }
  });
  console.log('\n--- CLI ---');
  console.log(toCLI(result));
}

const specifiedResult = await analyze(text, {
  rhymeDictType: 'pingshui',
  preferredType: 'ci',
  templateId: '水调歌头',
  strictMode: true,
});
printSection('指定模板（水调歌头）', specifiedResult);
