# 架构与解耦 TODO

## 目标原则

- **Parser / 分析核心无状态**：不内部 `await` 加载韵书、不隐式读全局模板；调用方注入依赖。
- **外部传入**：词牌/格律模板（`MeterTemplate` / `CiTemplate` 或解析后的结构）、韵表（`RhymeDict` 或等价只读快照）。
- **入口职责**：仅负责 I/O（读文件、选 `rhymeDictType`）与组装；核心管线为 **同步纯函数 + 注入的只读数据**。

---

## 当前问题（待解决）

### 1. 依赖注入与副作用

- [x] `analyze` / `analyzeLine` / `analyzeStream` 内部 `await createRhymeDict(...)`，核心逻辑与异步资源加载耦合。
- [x] 改为：对外保留便捷异步 API 亦可，但需提供 **同步版本**：`(input, options & { dict: RhymeDict; template: ... }) => AnalysisResult`，由上层 `createRhymeDict` 一次后传入。

### 2. 模板来源

- [ ] `getTemplateById(options.templateId)` 等从内部注册表取模板；与「模板外部传入」目标不一致。
- [ ] 明确 API：`template` 作为参数传入；若保留 `templateId`，仅作为元数据/日志，不强制内部解析。

### 3. 编排层过重（「上帝函数」）

- [x] `src/analyzer/index.ts` 中单次分析串联：分词分支、建 AST、匹配/变体、写回 AST、过滤多音字、校验、拼文案——职责过多。
- [x] 拆成可单测步骤：每步输入输出类型清晰，`runPipeline` 真正串联各步骤。

### 4. 诗体 / 词牌分支分散

- [x] 词牌 `splitCiLines` + `buildLexResultFromRawLines` vs 诗体 `lex`；流式再一套分句。易不一致。
- [x] 收敛为统一中间表示：`splitSentences()` 统一分句，`lexStep()` 统一产出 `LexResult`。
- [x] `analyzeStream` 改用 `splitSentences()` + DI（`analyzeStreamSync`）。

### 5. API 卫生

- [x] `matchTemplate(ast, templates, dict)` 中 `dict` 未使用（`_dict`）—— 已移除参数。
- [x] `analyzeLine` 中 lex+annotate 重复逻辑已提取为 `annotateLineText()`。

### 6. 测试与可替换性

- [ ] 注入 `RhymeDict` 后，校验 / 匹配类测试可使用 **固定小字典夹具**，无需每次异步加载大表。
