/**
 * 分析器内部类型定义
 *
 * 本文件包含 analyzer 模块内部使用的类型定义，这些类型不对外公开，
 * 仅用于模块内部函数之间的类型标注。
 */

import type {
  CharNode,
  Diagnostic,
  ToneConstraint,
} from "../core/types.js";
import type {
  CiTemplate,
  CiTemplateVariant,
  MeterTemplate,
} from "../templates/index.js";

/**
 * 解析后的行模板信息
 * 包含该行对应的模板模式、字数、韵脚位置等关键信息
 */
export interface ResolvedLineTemplate {
  /** 所属模板 ID */
  templateId: string;
  /** 期望的平仄模式 */
  expectedPattern: ToneConstraint[];
  /** 该行字数 */
  charCount: number;
  /** 是否为韵脚行 */
  isRhymeLine: boolean;
  /** 词牌分段信息（仅词牌格式） */
  sectionInfo?: { index: number; name: string };
  /** 该行在段落内的索引（仅词牌格式） */
  lineIndexInSection?: number;
  /** 词牌变体 ID（仅词牌格式） */
  variantId?: string;
  /** 期望的韵脚类型 */
  expectedRhymeType?: "ping" | "ze";
  /** 韵脚转换标记 */
  rhymeSwitch?: "ping" | "ze";
}

/**
 * 词牌变体评分结果
 * 用于比较和选择最匹配的词牌变体
 */
export interface CiVariantScore {
  /** 词牌变体对象 */
  variant: CiTemplateVariant;
  /** 匹配置信度 0-1 */
  confidence: number;
}

/**
 * 行验证字符检查结果
 * 记录每个字符的校验状态
 */
export interface CharCheckResult {
  /** 列索引 */
  col: number;
  /** 字符 */
  char: string;
  /** 期望值（平/仄/中/韵） */
  expected: string;
  /** 实际值 */
  actual: string;
  /** 是否匹配 */
  matched: boolean;
  /** 不匹配原因 */
  reason?: "tone_unresolved" | "tone_mismatch" | "rhyme_unresolved";
}

/**
 * 验证结果是否符合模板约束
 * - 0: 完全符合
 * - > 0: 有不符但可接受（如拗救）
 * - < 0: 严重不符合
 */
export interface ValidationResult {
  /** 验证是否通过 */
  isValid: boolean;
  /** 不符合的字符数 */
  mismatchCount: number;
  /** 详细信息 */
  details: CharCheckResult[];
}
