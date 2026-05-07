/**
 * 诗词格律分析示例
 *
 * 展示 poem-parser 对不同体裁、不同韵书的分析能力。
 * 用法: pnpm build && node examples/run.mjs
 */

import { analyze } from '../dist/index.js';

const EXAMPLES = [
  // ========== 五绝 ==========
  {
    label: '[唐] 王之涣《登鹳雀楼》',
    text: '白日依山尽，\n黄河入海流。\n欲穷千里目，\n更上一层楼。',
    opts: { rhymeDictType: 'pingshui', templateId: 'wujue-zeqi' },
  },
  {
    label: '[唐] 李白《静夜思》',
    text: '床前明月光，\n疑是地上霜。\n举头望明月，\n低头思故乡。',
    opts: { rhymeDictType: 'pingshui', templateId: 'wujue-pingqi' },
  },

  // ========== 七绝 ==========
  {
    label: '[唐] 李白《早发白帝城》',
    text: '朝辞白帝彩云间，\n千里江陵一日还。\n两岸猿声啼不住，\n轻舟已过万重山。',
    opts: { rhymeDictType: 'pingshui', templateId: 'qijue-pingqi' },
  },
  {
    label: '[唐] 王维《渭城曲》',
    text: '渭城朝雨浥轻尘，\n客舍青青柳色新。\n劝君更尽一杯酒，\n西出阳关无故人。',
    opts: { rhymeDictType: 'pingshui', templateId: 'qijue-zeqi' },
  },

  // ========== 五律 ==========
  {
    label: '[唐] 杜甫《春望》',
    text: [
      '国破山河在，',
      '城春草木深。',
      '感时花溅泪，',
      '恨别鸟惊心。',
      '烽火连三月，',
      '家书抵万金。',
      '白头搔更短，',
      '浑欲不胜簪。',
    ].join('\n'),
    opts: { rhymeDictType: 'pingshui', templateId: 'wulü-shouju-ze' },
  },
  {
    label: '[唐] 王勃《送杜少府之任蜀州》',
    text: [
      '城阙辅三秦，',
      '风烟望五津。',
      '与君离别意，',
      '同是宦游人。',
      '海内存知己，',
      '天涯若比邻。',
      '无为在歧路，',
      '儿女共沾巾。',
    ].join('\n'),
    opts: { rhymeDictType: 'pingshui', templateId: 'wulü-shouju-ping' },
  },

  // ========== 七律 ==========
  {
    label: '[唐] 杜甫《登高》',
    text: [
      '风急天高猿啸哀，',
      '渚清沙白鸟飞回。',
      '无边落木萧萧下，',
      '不尽长江滚滚来。',
      '万里悲秋常作客，',
      '百年多病独登台。',
      '艰难苦恨繁霜鬓，',
      '潦倒新停浊酒杯。',
    ].join('\n'),
    opts: { rhymeDictType: 'pingshui', templateId: 'qilü-shouju-ze' },
  },
  {
    label: '[唐] 李商隐《锦瑟》',
    text: [
      '锦瑟无端五十弦，',
      '一弦一柱思华年。',
      '庄生晓梦迷蝴蝶，',
      '望帝春心托杜鹃。',
      '沧海月明珠有泪，',
      '蓝田日暖玉生烟。',
      '此情可待成追忆，',
      '只是当时已惘然。',
    ].join('\n'),
    opts: { rhymeDictType: 'pingshui', templateId: 'qilü-shouju-ping' },
  },

  // ========== 词牌（词林正韵） ==========
  {
    label: '[宋] 苏轼《水调歌头》',
    text: '明月几时有？把酒问青天。不知天上宫阙，今夕是何年。我欲乘风归去，又恐琼楼玉宇，高处不胜寒。起舞弄清影，何似在人间。转朱阁，低绮户，照无眠。不应有恨，何事长向别时圆？人有悲欢离合，月有阴晴圆缺，此事古难全。但愿人长久，千里共婵娟。',
    opts: {
      rhymeDictType: 'cilin',
      templateId: '水调歌头',
      variantId: '水调歌头-v3',
    },
  },
  {
    label: '[宋] 岳飞《满江红》',
    text: '怒发冲冠，凭栏处、潇潇雨歇。抬望眼、仰天长啸，壮怀激烈。三十功名尘与土，八千里路云和月。莫等闲、白了少年头，空悲切。靖康耻，犹未雪。臣子恨，何时灭。驾长车踏破，贺兰山缺。壮志饥餐胡虏肉，笑谈渴饮匈奴血。待从头、收拾旧山河，朝天阙。',
    opts: { rhymeDictType: 'cilin', templateId: '满江红' },
  },
  {
    label: '[宋] 李清照《声声慢》',
    text: '寻寻觅觅，冷冷清清，凄凄惨惨戚戚。乍暖还寒时候，最难将息。三杯两盏淡酒，怎敌他、晚来风急。雁过也，正伤心，却是旧时相识。满地黄花堆积，憔悴损，如今有谁堪摘。守着窗儿，独自怎生得黑。梧桐更兼细雨，到黄昏、点点滴滴。这次第，怎一个愁字了得。',
    opts: { rhymeDictType: 'cilin', templateId: '声声慢' },
  },

  // ========== 中华新韵 ==========
  {
    label: '[唐] 王之涣《登鹳雀楼》(中华新韵)',
    text: '白日依山尽，\n黄河入海流。\n欲穷千里目，\n更上一层楼。',
    opts: { rhymeDictType: 'zhonghua_new', templateId: 'wujue-zeqi' },
  },
];

async function main() {
  let ok = 0;
  for (const { label, text, opts } of EXAMPLES) {
    console.log(`\n${'='.repeat(58)}`);
    console.log(label);
    console.log('-'.repeat(58));
    try {
      const r = await analyze(text, opts);
      console.log(
        `  模板: ${r.bestMatch?.templateId ?? '—'}  |  类型: ${r.ast.type}  |  行数: ${r.ast.lines.length}`,
      );
      console.log(
        `  合律率: ${(r.complianceRate * 100).toFixed(0)}%  |  完全合律: ${r.fullyCompliant ? '是' : '否'}`,
      );
      const rhymes = r.ast.lines
        .filter((l) => l.isRhymeLine)
        .map((l) => l.rhymeChar?.char ?? '?')
        .join(' ');
      console.log(`  韵脚: ${rhymes}`);
      const amb = r.ambiguities.map((a) => a.char).join(', ') || '无';
      console.log(`  多音字: ${amb}`);
      console.log(
        `  逐行: ${r.lineValidations.map((v) => `${v.isCompliant ? '✓' : '✗'}${v.matchedCount}/${v.checkableCount}`).join('  ')}`,
      );
      ok++;
    } catch (e) {
      console.log(`  ❌ ${e.message}`);
    }
  }
  console.log(`\n${'='.repeat(58)}`);
  console.log(`${ok}/${EXAMPLES.length} 首分析完成`);
}

main().catch(console.error);
