/**
 * 分析器模块
 *
 * 纯分析内核 —— 所有依赖通过参数注入。
 * 异步便捷封装已移除，调用方通过 kernel.ts 入口使用纯函数，
 * 自行加载韵书和模板后注入。
 *
 * @module analyzer
 */

export { analyzeStreamSync } from "./stream.js";
export type { StreamAnalyzeResult, StreamSegment } from "./stream.js";

export { analyzeSync, analyzeLineSync } from "./kernel.js";
export type {
  AnalysisResult,
  AnalyzeOptionsInternal,
  AnalyzeLineContext,
  LineValidationSummary,
} from "./kernel.js";

export type { PipelineInput, PipelineOutput } from "./pipeline.js";

export type { MatchResult } from "../matcher/index.js";
export type { LineValidationResult } from "../core/types.js";
export type { AnyTemplate } from "../templates/index.js";
