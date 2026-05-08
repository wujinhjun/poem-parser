/**
 * 模板类型定义
 *
 * 纯类型模块 —— 无 fs / path / process 依赖。
 * 词牌数据加载由调用方自行处理（如读取 ci-tunes-bundle.json 后直接使用）。
 *
 * @module templates
 */

import type { ToneConstraint } from "../core/types.js";

// ========== 格律模板 ==========

export type { MeterTemplate } from "./meters.js";
export { loadMeterTemplates } from "./meters.js";

// ========== 词牌模板 ==========

export interface CiTemplateLine {
  charCount: number;
  pattern: ToneConstraint[];
  isRhymeLine: boolean;
  rhymeType?: "ping" | "ze";
  rhymeSwitch?: "ping" | "ze";
}

export interface CiTemplateSection {
  name: string;
  lines: CiTemplateLine[];
}

export interface CiTemplateVariant {
  id: string;
  name: string;
  sketch?: string;
  author?: string;
  source?: string;
  rhymeType?: "ping" | "ze" | "mixed";
  sections: CiTemplateSection[];
}

export interface CiTemplate {
  id: string;
  name: string;
  aliases?: string[];
  variants: CiTemplateVariant[];
  source?: string;
}

// ========== 联合类型 ==========

import type { MeterTemplate } from "./meters.js";
export type AnyTemplate = MeterTemplate | CiTemplate;
