export enum Tone {
  Ping = "平",
  Ze = "仄",
  Unknown = "未知",
}

export type RhymeDictType = "pingshui" | "cilin" | "zhonghua_new";

export type ToneConstraint =
  | { type: "fixed"; tone: Tone }
  | { type: "flexible" }
  | { type: "rhyme"; group?: string };

export type CharValidationStatus =
  | "pass"
  | "fail"
  | "flexible"
  | "rescued"
  | "unknown";

export type RescueType =
  | "benju-zijiou"
  | "duiju-xiangjiou"
  | "sansi-hujiou"
  | "guping-jiou";

export interface RescueDetail {
  type: RescueType;
  naoPosition: { line: number; col: number };
  jiuPosition: { line: number; col: number };
  description: string;
}

export interface Diagnostic {
  type: "violation" | "rescue" | "info" | "ambiguity";
  severity: "error" | "warning" | "info";
  position: { line: number; col?: number };
  message: string;
  rescueInfo?: RescueDetail;
  relatedPositions?: Array<{ line: number; col?: number; label: string }>;
}

export interface CharNode {
  char: string;
  tone: Tone | null;
  toneOptions?: Tone[];
  rhymeGroup?: string;
  position: {
    global: number;
    line: number;
    col: number;
  };
  expectedConstraint?: ToneConstraint;
  validationStatus?: CharValidationStatus;
}

export interface LineNode {
  chars: CharNode[];
  raw: string;
  charCount: number;
  globalLineIndex: number;
  sectionIndex?: number;
  sectionName?: string;
  lineIndexInSection?: number;
  isRhymeLine: boolean;
  rhymeChar?: CharNode;
  expectedRhymeType?: "ping" | "ze";
  expectedRhymeGroup?: string;
  rhymeSwitch?: "ping" | "ze";
  coupletRole?: "upper" | "lower";
  coupletPairIndex?: number;
  requiresDuizhang?: boolean;
  expectedPattern?: ToneConstraint[];
  templateId?: string;
  templateLineName?: string;
  diagnostics: Diagnostic[];
}

export interface CoupletNode {
  upper: LineNode;
  lower: LineNode;
  coupletIndex: number;
  requiresDuizhang: boolean;
  diagnostics: Diagnostic[];
}

export interface SectionNode {
  sectionIndex: number;
  name: string;
  lines: LineNode[];
}

export interface RhymeInfo {
  lineIndex: number;
  char: string;
  rhymeGroup: string;
  tone: Tone;
  isConsistent: boolean;
}

export interface PoemAST {
  type: "lüshi" | "jueju" | "ci";
  title?: string;
  lines: LineNode[];
  couplets?: CoupletNode[];
  sections?: SectionNode[];
  templateId?: string;
  rhymeDictType: RhymeDictType;
  diagnostics: Diagnostic[];
  rhymeSequence?: RhymeInfo[];
}

export interface ToneAmbiguityOption {
  tone: Tone;
  rhymeGroup: string;
  pronunciation: string;
  meaning?: string;
}

export interface ToneAmbiguity {
  char: string;
  position: { line: number; col: number };
  options: ToneAmbiguityOption[];
  suggestion?: {
    preferredTone: Tone;
    reason: string;
  };
}

export interface LineAnalysisContext {
  templateId: string;
  variantId?: string;
  globalLineIndex: number;
  sectionIndex?: number;
  lineIndexInSection?: number;
  precedingRhymes?: Array<{
    char: string;
    rhymeGroup: string;
  }>;
  adjacentLines?: {
    previous?: string;
    next?: string;
  };
}

export interface LineValidationResult {
  line: LineNode;
  expectedPattern: ToneConstraint[];
  actualTones: (Tone | null)[];
  matchScore: number;
  diagnostics: Diagnostic[];
  ambiguities: ToneAmbiguity[];
  rhymeCheck?: {
    isRhymeLine: boolean;
    rhymeChar: string;
    rhymeGroup: string;
    expectedRhymeGroup?: string;
    isConsistent: boolean | null;
  };
  rescues?: RescueDetail[];
  contextHints?: string[];
}
