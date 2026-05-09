import { AnalysisResult } from "../analyzer/index.js";

export function toJSON(result: AnalysisResult): string {
  return JSON.stringify(result, null, 2);
}

export function toAnnotatedText(result: AnalysisResult): string {
  return result.ast.lines
    .map((line) =>
      line.chars
        .map((char) => {
          const tone = char.tone ?? "未知";
          const marker = char.validationStatus === "fail" ? "!" : "";
          return `${char.char}(${tone}${marker})`;
        })
        .join(" "),
    )
    .join("\n");
}

export function toCLI(result: AnalysisResult): string {
  const headline = result.bestMatch
    ? `模板 ${result.bestMatch.templateId} ${(result.bestMatch.confidence * 100).toFixed(1)}%`
    : "未匹配模板";
  return [headline, toAnnotatedText(result)].join("\n\n");
}
