/**
 * poem-parser 纯内核
 *
 * 零副作用的分析入口。所有依赖通过参数注入：
 * - template: 由调用方通过 loadMeterTemplates() 或自定义加载获取
 * - dict: 由调用方通过 createRhymeDict() 或实现 RhymeDict 接口获取
 *
 * 不依赖 fs / path / process.cwd()，可在浏览器、Worker、VS Code 等环境运行。
 *
 * @module kernel
 */

// 全诗 & 单行分析
export { analyzeSync, analyzeLineSync } from "./analyzer/kernel.js";
export type { AnalysisResult, AnalyzeOptionsInternal, AnalyzeLineContext, LineValidationSummary } from "./analyzer/kernel.js";

// 流式分析
export { analyzeStreamSync, getSentenceCharCounts } from "./analyzer/stream.js";
export type { StreamAnalyzeResult, StreamSegment } from "./analyzer/stream.js";

// 管线步骤（高级用户可直接调用单步）
export {
  runPipeline,
  lexStep,
  annotateStep,
  buildAst,
  matchStep,
  applyTemplate,
  resolveAmbiguities,
  validate,
} from "./analyzer/pipeline.js";
export type { PipelineInput, PipelineOutput } from "./analyzer/pipeline.js";

// 模板工具
export { getTemplateType, resolveLineTemplate } from "./analyzer/templates.js";

// 核心类型
export type {
  CharNode,
  LineNode,
  CoupletNode,
  SectionNode,
  PoemAST,
  ToneAmbiguity,
  ToneConstraint,
  Diagnostic,
  RescueDetail,
  LineValidationResult,
} from "./core/types.js";
export { Tone } from "./core/types.js";
export type { RhymeDictType } from "./core/types.js";

// 格律模板定义（纯数据，硬编码，零 fs 依赖）
export { loadMeterTemplates } from "./templates/meters.js";
export type { MeterTemplate } from "./templates/meters.js";

// 词牌类型（import type 不加载模块，无 fs 副作用）
export type { CiTemplate, CiTemplateVariant, AnyTemplate } from "./templates/index.js";

// 韵书接口（import type 不加载模块）
export type { RhymeDict, RhymeEntry } from "./rhyme-dict/index.js";
