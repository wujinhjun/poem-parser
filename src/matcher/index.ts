import { PoemAST, ToneConstraint } from "../core/types.js";
import { RhymeDict } from "../rhyme-dict/index.js";
import { AnyTemplate, MeterTemplate } from "../templates/index.js";

export interface MatchResult {
  templateId: string;
  confidence: number;
  toneDeviations: Array<{
    line: number;
    col: number;
    expected: ToneConstraint;
    actual: string;
  }>;
}

function isMeterTemplate(template: AnyTemplate): template is MeterTemplate {
  return (template as MeterTemplate).pattern !== undefined;
}

export function matchTemplate(
  ast: PoemAST,
  templates: AnyTemplate[],
  _dict: RhymeDict,
): MatchResult[] {
  const results: MatchResult[] = [];

  for (const template of templates) {
    if (!isMeterTemplate(template)) continue;

    let checkable = 0;
    let matched = 0;
    const toneDeviations: MatchResult["toneDeviations"] = [];

    for (let lineIdx = 0; lineIdx < template.pattern.length; lineIdx += 1) {
      const line = ast.lines[lineIdx];
      const expectedLine = template.pattern[lineIdx];
      if (!line || !expectedLine) continue;

      for (let col = 0; col < expectedLine.length; col += 1) {
        const actualNode = line.chars[col];
        const expected = expectedLine[col];
        if (!actualNode || expected.type !== "fixed") continue;
        checkable += 1;

        const matchesByPrimary = actualNode.tone === expected.tone;
        const matchesByOptions = (actualNode.toneOptions ?? []).includes(expected.tone);
        if (matchesByPrimary || matchesByOptions) {
          matched += 1;
        } else {
          toneDeviations.push({
            line: lineIdx,
            col,
            expected,
            actual: actualNode.tone ?? "未知",
          });
        }
      }
    }

    const confidence = checkable === 0 ? 0 : matched / checkable;
    results.push({ templateId: template.id, confidence, toneDeviations });
  }

  return results.sort((a, b) => b.confidence - a.confidence);
}
