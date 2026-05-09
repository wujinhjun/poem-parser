import {
  CharNode,
  Diagnostic,
  LineNode,
  Tone,
  ToneConstraint,
} from "./types.js";

export function createCharNode(params: {
  char: string;
  line: number;
  col: number;
  global: number;
  tone?: Tone | null;
  toneOptions?: Tone[];
  rhymeGroup?: string;
}): CharNode {
  return {
    char: params.char,
    tone: params.tone ?? null,
    toneOptions: params.toneOptions,
    rhymeGroup: params.rhymeGroup,
    position: {
      global: params.global,
      line: params.line,
      col: params.col,
    },
  };
}

export function createLineNode(params: {
  raw: string;
  globalLineIndex: number;
  chars: CharNode[];
  expectedPattern?: ToneConstraint[];
}): LineNode {
  return {
    raw: params.raw,
    globalLineIndex: params.globalLineIndex,
    chars: params.chars,
    charCount: params.chars.length,
    isRhymeLine: false,
    diagnostics: [],
    expectedPattern: params.expectedPattern,
  };
}

export function createDiagnostic(params: Diagnostic): Diagnostic {
  return params;
}
