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
    title?: string;
  };
}

const HANZI_RE = /[\u4e00-\u9fff]/u;
const LINE_END_PUNC_RE = /[，。！？；：,.!?;:]$/u;

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

function shouldTreatAsTitle(line: string): boolean {
  const hasHanzi = HANZI_RE.test(line);
  const hasEndPunc = LINE_END_PUNC_RE.test(line);
  return hasHanzi && !hasEndPunc;
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

  let title: string | undefined;
  let contentLines = rawLines;
  if (rawLines.length > 1 && shouldTreatAsTitle(rawLines[0])) {
    title = rawLines[0];
    contentLines = rawLines.slice(1);
  }

  const lines: LexLine[] = contentLines.map((raw) => {
    const punctuation = LINE_END_PUNC_RE.test(raw) ? raw.at(-1) ?? "" : "";
    const chars = [...raw].filter((ch) => HANZI_RE.test(ch));
    return { raw, chars, punctuation };
  });

  return {
    lines,
    metadata: {
      totalLines: lines.length,
      charsPerLine: lines.map((line) => line.chars.length),
      title,
    },
  };
}
