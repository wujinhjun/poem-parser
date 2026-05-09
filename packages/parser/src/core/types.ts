/**
 * 核心类型定义
 *
 * 本模块定义了诗词解析器的核心数据类型，是整个项目的基础。
 * 包括音调、韵脚、字符节点、行节点、诗歌 AST 等核心数据结构。
 */

/**
 * 音调枚举
 * - Ping: 平声
 * - Ze: 仄声（上去入）
 * - Unknown: 未知
 */
export enum Tone {
  Ping = "平",
  Ze = "仄",
  Unknown = "未知",
}

/**
 * 韵书类型
 * - pingshui: 平水韵
 * - cilin: 词林正韵
 * - zhonghua_new: 中华新韵
 */
export type RhymeDictType = "pingshui" | "cilin" | "zhonghua_new";

/**
 * 音调约束类型
 * 定义模板中对单个字符的平仄要求
 */
export type ToneConstraint =
  /** 固定平仄要求 */
  | { type: "fixed"; tone: Tone }
  /** 可平可仄（中性） */
  | { type: "flexible" }
  /** 韵脚位置，可指定韵部组 */
  | { type: "rhyme"; group?: string };

/**
 * 字符校验状态
 * 描述字符是否符合模板约束
 */
export type CharValidationStatus =
  /** 符合约束 */
  | "pass"
  /** 违反约束 */
  | "fail"
  /** 处于可平可仄位 */
  | "flexible"
  /** 本身违反但被拗救覆盖 */
  | "rescued"
  /** 无法确定（多音字等） */
  | "unknown";

/**
 * 拗救类型
 * - benju-zijiou: 本句自救
 * - duiju-xiangjiou: 对句相救
 * - sansi-hujiou: 三四互救
 * - guping-jiou: 孤平救
 */
export type RescueType =
  | "benju-zijiou"
  | "duiju-xiangjiou"
  | "sansi-hujiou"
  | "guping-jiou";

/**
 * 拗救详情
 * 记录拗救发生的位置和类型
 */
export interface RescueDetail {
  /** 拗救类型 */
  type: RescueType;
  /** 拗字位置 */
  naoPosition: { line: number; col: number };
  /** 救字位置 */
  jiuPosition: { line: number; col: number };
  /** 描述信息 */
  description: string;
}

/**
 * 诊断信息
 * 用于报告违规、警告、信息等分析结果
 */
export interface Diagnostic {
  /** 诊断类型 */
  type: "violation" | "rescue" | "info" | "ambiguity";
  /** 严重程度 */
  severity: "error" | "warning" | "info";
  /** 位置 */
  position: { line: number; col?: number };
  /** 消息 */
  message: string;
  /** 拗救信息 */
  rescueInfo?: RescueDetail;
  /** 相关位置 */
  relatedPositions?: Array<{ line: number; col?: number; label: string }>;
}

/**
 * 字符节点
 * 代表诗歌中的一个汉字，包含其音韵信息
 */
export interface CharNode {
  /** 汉字 */
  char: string;
  /** 主音调（若唯一） */
  tone: Tone | null;
  /** 可选的音调列表（多音字） */
  toneOptions?: Tone[];
  /** 韵部 */
  rhymeGroup?: string;
  /** 位置信息 */
  position: {
    /** 全局字符索引 */
    global: number;
    /** 行索引 */
    line: number;
    /** 列索引 */
    col: number;
  };
  /** 期望的音调约束 */
  expectedConstraint?: ToneConstraint;
  /** 校验状态 */
  validationStatus?: CharValidationStatus;
}

/**
 * 行节点
 * 代表诗歌中的一行，包含所有字符节点
 */
export interface LineNode {
  /** 原始文本 */
  raw: string;
  /** 字符节点数组 */
  chars: CharNode[];
  /** 字数 */
  charCount: number;
  /** 全局行索引 */
  globalLineIndex: number;
  /** 段落索引（词牌） */
  sectionIndex?: number;
  /** 段落名称（词牌） */
  sectionName?: string;
  /** 在段落内的行索引（词牌） */
  lineIndexInSection?: number;
  /** 是否为韵脚行 */
  isRhymeLine: boolean;
  /** 韵脚字符 */
  rhymeChar?: CharNode;
  /** 期望韵脚类型 */
  expectedRhymeType?: "ping" | "ze";
  /** 期望韵部 */
  expectedRhymeGroup?: string;
  /** 韵脚转换 */
  rhymeSwitch?: "ping" | "ze";
  /** 对句角色 */
  coupletRole?: "upper" | "lower";
  /** 对句对编号 */
  coupletPairIndex?: number;
  /** 是否要求对仗 */
  requiresDuizhang?: boolean;
  /** 期望平仄模式 */
  expectedPattern?: ToneConstraint[];
  /** 模板 ID */
  templateId?: string;
  /** 模板行名称 */
  templateLineName?: string;
  /** 诊断信息 */
  diagnostics: Diagnostic[];
}

/**
 * 对句节点
 * 代表一联（两句），用于对仗和拗救分析
 */
export interface CoupletNode {
  /** 上句（出句） */
  upper: LineNode;
  /** 下句（对句） */
  lower: LineNode;
  /** 对句编号 */
  coupletIndex: number;
  /** 是否要求对仗 */
  requiresDuizhang: boolean;
  /** 诊断信息 */
  diagnostics: Diagnostic[];
}

/**
 * 段落节点
 * 代表词牌的一个段落（上阙/下阙）
 */
export interface SectionNode {
  /** 段落索引 */
  sectionIndex: number;
  /** 段落名称 */
  name: string;
  /** 包含的行 */
  lines: LineNode[];
}

/**
 * 韵脚信息
 * 记录诗歌中韵脚的详细信息
 */
export interface RhymeInfo {
  /** 行索引 */
  lineIndex: number;
  /** 韵脚字 */
  char: string;
  /** 韵部 */
  rhymeGroup: string;
  /** 音调 */
  tone: Tone;
  /** 与前韵是否一致 */
  isConsistent: boolean;
}

/**
 * 诗歌 AST（抽象语法树）
 * 解析结果的核心数据结构
 */
export interface PoemAST {
  /** 诗歌类型 */
  type: "lüshi" | "jueju" | "ci";
  /** 标题（若有） */
  title?: string;
  /** 所有行 */
  lines: LineNode[];
  /** 对句数组（律诗） */
  couplets?: CoupletNode[];
  /** 段落数组（词牌） */
  sections?: SectionNode[];
  /** 匹配模板 ID */
  templateId?: string;
  /** 韵书类型 */
  rhymeDictType: RhymeDictType;
  /** 诊断信息 */
  diagnostics: Diagnostic[];
  /** 韵脚序列 */
  rhymeSequence?: RhymeInfo[];
}

/**
 * 多音字音调选项
 */
export interface ToneAmbiguityOption {
  /** 音调 */
  tone: Tone;
  /** 韵部 */
  rhymeGroup: string;
  /** 发音 */
  pronunciation: string;
  /** 含义 */
  meaning?: string;
}

/**
 * 多音字歧义
 * 记录多音字的所有可能读音
 */
export interface ToneAmbiguity {
  /** 字符 */
  char: string;
  /** 位置 */
  position: { line: number; col: number };
  /** 可选音调列表 */
  options: ToneAmbiguityOption[];
  /** 建议 */
  suggestion?: {
    preferredTone: Tone;
    reason: string;
  };
}

/**
 * 行分析上下文
 * 单行分析时需要的上下文信息
 */
export interface LineAnalysisContext {
  /** 模板 ID */
  templateId: string;
  /** 变体 ID */
  variantId?: string;
  /** 全局行索引 */
  globalLineIndex: number;
  /** 段落索引（词牌） */
  sectionIndex?: number;
  /** 段落内行索引（词牌） */
  lineIndexInSection?: number;
  /** 前置韵脚 */
  precedingRhymes?: Array<{
    char: string;
    rhymeGroup: string;
  }>;
  /** 相邻行 */
  adjacentLines?: {
    previous?: string;
    next?: string;
  };
}

/**
 * 行验证结果
 */
export interface LineValidationResult {
  /** 行节点 */
  line: LineNode;
  /** 期望的模式 */
  expectedPattern: ToneConstraint[];
  /** 实际音调 */
  actualTones: (Tone | null)[];
  /** 匹配得分 */
  matchScore: number;
  /** 诊断信息 */
  diagnostics: Diagnostic[];
  /** 多音字歧义 */
  ambiguities: ToneAmbiguity[];
  /** 韵脚检查结果 */
  rhymeCheck?: {
    isRhymeLine: boolean;
    rhymeChar: string;
    rhymeGroup: string;
    expectedRhymeGroup?: string;
    isConsistent: boolean | null;
  };
  /** 拗救详情 */
  rescues?: RescueDetail[];
  /** 上下文提示 */
  contextHints?: string[];
}
