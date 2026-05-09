/**
 * @poem/shared —— 跨包共享类型与工具
 *
 * 供 parser、web、rn、agent 等包共同使用。
 */

// ---- 诗词基础类型 ----

/** 诗歌体裁 */
export type PoemGenre = "wujue" | "qijue" | "wulü" | "qilü" | "ci";

/** 韵书类型 */
export type RhymeDictType = "pingshui" | "cilin" | "zhonghua_new";

/** 音调 */
export const Tone = { Ping: "平", Ze: "仄", Unknown: "未知" } as const;
export type Tone = (typeof Tone)[keyof typeof Tone];

/** 校验状态 */
export type CharValidationStatus = "pass" | "fail" | "flexible" | "rescued" | "unknown";

// ---- 诗词元数据 ----

/** 诗词作品元数据（用于数据库、API 传输） */
export interface PoemMeta {
  id: string;
  title: string;
  author: string;
  dynasty: string;
  genre: PoemGenre;
  rhymeDictType: RhymeDictType;
  templateId: string;
  variantId?: string;
  text: string;
  complianceRate: number;
  isCompliant: boolean;
  createdAt: string;
}

/** 分析请求参数 */
export interface AnalyzeRequest {
  text: string;
  templateId: string;
  rhymeDictType: RhymeDictType;
  variantId?: string;
  genre?: PoemGenre;
}

/** 自度曲（自定义词牌）定义 */
export interface CustomTune {
  id: string;
  name: string;
  author: string;
  sections: CustomTuneSection[];
}

export interface CustomTuneSection {
  name: string;
  lines: CustomTuneLine[];
}

export interface CustomTuneLine {
  charCount: number;
  pattern: string; // "平仄中韵" 格式
  isRhymeLine: boolean;
  rhymeType?: "ping" | "ze";
}
