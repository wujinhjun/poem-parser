export interface LexLine {
  raw: string;
  chars: string[];
  punctuation: string;
}

export interface LexResult {
  lines: LexLine[];
  metadata: {
    totalLines: number;
    charsPerLine: number[];
  };
}

const HANZI_RE = /[\u4e00-\u9fff]/u;
const LINE_END_PUNC_RE = /[，。！？；：,.!?;:]$/u;

/** 中文标点分隔符 —— 诗词和词牌的通用分句模式 */
const SENTENCE_SEP_RE = /[，。！？；、\n]/u;

function normalizePunctuation(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/,/g, "，")
    .replace(/\./g, "。")
    .replace(/!/g, "！")
    .replace(/\?/g, "？")
    .replace(/;/g, "；")
    .replace(/:/g, "：");
}

/**
 * 按中文标点分句 —— 不区分诗体/词牌，统一按标点拆分为句子数组。
 * 用于词牌分析、流式解析等场景。
 */
export function splitSentences(input: string): string[] {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/\s+/g, "")
    .split(SENTENCE_SEP_RE)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function lex(input: string): LexResult {
  const normalized = normalizePunctuation(input).trim();
  if (!normalized) {
    return {
      lines: [],
      metadata: { totalLines: 0, charsPerLine: [] },
    };
  }

  const rawLines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const lines: LexLine[] = rawLines.map((raw) => {
    const punctuation = LINE_END_PUNC_RE.test(raw) ? raw.at(-1) ?? "" : "";
    const chars = [...raw].filter((ch) => HANZI_RE.test(ch));
    return { raw, chars, punctuation };
  });

  return {
    lines,
    metadata: {
      totalLines: lines.length,
      charsPerLine: lines.map((line) => line.chars.length),
    },
  };
}
