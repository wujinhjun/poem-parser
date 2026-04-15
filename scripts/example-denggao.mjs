import { analyze, toCLI } from '../dist/index.js';

const text = [
  '风急天高猿啸哀，',
  '渚清沙白鸟飞回。',
  '无边落木萧萧下，',
  '不尽长江滚滚来。',
  '万里悲秋常作客，',
  '百年多病独登台。',
  '艰难苦恨繁霜鬓，',
  '潦倒新停浊酒杯。',
].join('\n');

function printSection(title, result) {
  console.log(`\n=== ${title} ===`);
  console.log(`summary: ${result.summary}`);
  console.log(
    `bestMatch: ${result.bestMatch ? result.bestMatch.templateId : 'null'}`,
  );
  console.log(`ast.type: ${result.ast.type}`);
  console.log(`lines: ${result.ast.lines.length}`);
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
  preferredType: 'lüshi',
  templateId: 'qilü-shouju-ze',
  strictMode: true,
});
printSection('指定模板（qilü-shouju-ze）', specifiedResult);
