import { createCharNode } from "../core/factories.js";
import { CharNode, Tone, ToneAmbiguity } from "../core/types.js";
import { LexResult } from "../lexer/index.js";
import { RhymeDict } from "../rhyme-dict/index.js";

export interface AnnotationResult {
  chars: CharNode[][];
  ambiguities: ToneAmbiguity[];
}

export function annotate(lexResult: LexResult, dict: RhymeDict): AnnotationResult {
  const ambiguities: ToneAmbiguity[] = [];
  const lines: CharNode[][] = [];
  let globalIndex = 0;

  for (let lineIndex = 0; lineIndex < lexResult.lines.length; lineIndex += 1) {
    const lexLine = lexResult.lines[lineIndex];
    const row: CharNode[] = [];

    for (let col = 0; col < lexLine.chars.length; col += 1) {
      const char = lexLine.chars[col];
      const entries = dict.lookup(char);

      const uniqueTones = [...new Set(entries.map((entry) => entry.tone))];
      const primaryTone =
        uniqueTones.length === 1 ? uniqueTones[0] : entries[0]?.tone ?? null;
      const rhymeGroup = entries[0]?.rhymeGroup;

      row.push(
        createCharNode({
          char,
          line: lineIndex,
          col,
          global: globalIndex,
          tone: primaryTone,
          toneOptions: uniqueTones.length > 1 ? uniqueTones : undefined,
          rhymeGroup,
        }),
      );

      if (uniqueTones.length > 1) {
        ambiguities.push({
          char,
          position: { line: lineIndex, col },
          options: entries.map((entry) => ({
            tone: entry.tone,
            rhymeGroup: entry.rhymeGroup,
            pronunciation: "",
          })),
          suggestion: {
            preferredTone: Tone.Ping,
            reason: "默认建议平声，后续由 matcher 结合模板回溯修正",
          },
        });
      }

      globalIndex += 1;
    }

    lines.push(row);
  }

  return { chars: lines, ambiguities };
}
