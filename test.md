# 测试样例

## 测试样例：白居易《钱塘湖春行》

以下是一个完整的测试样例，基于白居易《钱塘湖春行》的格律分析结果，覆盖模板匹配、逐行平仄、韵脚检测、对仗标记、多音字警告和逐句模式等全部维度。

> 七言律诗 · 首句入韵 · 平起平收 · 平水韵 · 八齐
>

### 测试数据定义

- 完整测试 fixture

    ```tsx
    // tests/fixtures/qiantanghu-chunxing.ts
    
    /**
     * 白居易《钱塘湖春行》
     * 七言律诗·首句入韵·平起平收
     * 韵书：平水韵
     * 韵部：八齐
     */
    export const QIANTANGHU_CHUNXING = {
      // ===== 输入 =====
      input: {
        text: [
          "孤山寺北贾亭西，",
          "水面初平云脚低。",
          "几处早莺争暖树，",
          "谁家新燕啄春泥。",
          "乱花渐欲迷人眼，",
          "浅草才能没马蹄。",
          "最爱湖东行不足，",
          "绿杨阴里白沙堤。",
        ].join("\n"),
        options: {
          rhymeDictType: "pingshui" as const,
          preferredType: "lüshi" as const,
          strictMode: true,
        },
      },
    
      // ===== 期望输出 =====
      expected: {
        // 模板匹配
        templateId: "qilü-shouju-ping",
        templateName: "七律·首句入韵·平起",
        type: "lüshi",
        charPerLine: 7,
        lineCount: 8,
    
        // 格律模板（含可平可仄「中」）
        templatePatterns: [
          ["中", "平", "中", "仄", "仄", "平", "平"],  // 第1句
          ["中", "仄", "平", "平", "中", "仄", "平"],  // 第2句
          ["中", "仄", "中", "平", "平", "仄", "仄"],  // 第3句
          ["中", "平", "中", "仄", "仄", "平", "平"],  // 第4句
          ["中", "平", "中", "仄", "平", "平", "仄"],  // 第5句
          ["中", "仄", "平", "平", "中", "仄", "平"],  // 第6句
          ["中", "仄", "中", "平", "平", "仄", "仄"],  // 第7句
          ["中", "平", "中", "仄", "仄", "平", "平"],  // 第8句
        ],
    
        // 实际声调（每个字的真实平仄）
        actualTones: [
          ["平", "平", "仄", "仄", "仄", "平", "平"],  // 孤山寺北贾亭西
          ["仄", "仄", "平", "平", "平", "仄", "平"],  // 水面初平云脚低
          ["仄", "仄", "仄", "平", "平", "仄", "仄"],  // 几处早莺争暖树
          ["平", "平", "平", "仄", "仄", "平", "平"],  // 谁家新燕啄春泥
          ["仄", "平", "仄", "仄", "平", "平", "仄"],  // 乱花渐欲迷人眼
          ["仄", "仄", "平", "平", "仄", "仄", "平"],  // 浅草才能没马蹄
          ["仄", "仄", "平", "平", "平", "仄", "仄"],  // 最爱湖东行不足
          ["仄", "平", "平", "仄", "仄", "平", "平"],  // 绿杨阴里白沙堤
        ],
    
        // 韵脚检测
        rhyme: {
          rhymeGroup: "八齐",
          rhymeType: "ping",
          rhymeLines: [
            { lineIndex: 0, char: "西", rhymeGroups: ["八齐"], isConsistent: true },
            { lineIndex: 1, char: "低", rhymeGroups: ["八齐"], isConsistent: true },
            { lineIndex: 3, char: "泥", rhymeGroups: ["八齐", "八茅", "八霁"], isConsistent: true },
            { lineIndex: 5, char: "蹄", rhymeGroups: ["八齐"], isConsistent: true },
            { lineIndex: 7, char: "堤", rhymeGroups: ["八齐"], isConsistent: true },
          ],
        },
    
        // 对仗
        couplets: [
          { coupletIndex: 0, upper: 0, lower: 1, requiresDuizhang: false },
          { coupletIndex: 1, upper: 2, lower: 3, requiresDuizhang: true, duizhangPass: true },
          { coupletIndex: 2, upper: 4, lower: 5, requiresDuizhang: true, duizhangPass: true },
          { coupletIndex: 3, upper: 6, lower: 7, requiresDuizhang: false },
        ],
    
        // 多音字警告
        ambiguities: [
          {
            char: "燕", position: { line: 3, col: 3 },
            options: [
              { tone: "仄", pronunciation: "yàn", meaning: "燕子" },
              { tone: "平", pronunciation: "yān", meaning: "燕国/燕地" },
            ],
            // 此处应取 yàn（燕子），仄声
          },
          {
            char: "泥", position: { line: 3, col: 6 },
            options: [
              { tone: "平", pronunciation: "ní", meaning: "泥土" },
              { tone: "仄", pronunciation: "nì", meaning: "拘泥/涂抹" },
            ],
            // 此处应取 ní（泥土），平声，作韵脚
          },
          {
            char: "行", position: { line: 6, col: 4 },
            options: [
              { tone: "平", pronunciation: "xíng", meaning: "行走" },
              { tone: "仄", pronunciation: "xìng", meaning: "品行/行为" },
            ],
            // 此处应取 xíng（行走），平声
          },
          {
            char: "不", position: { line: 6, col: 5 },
            options: [
              { tone: "仄", pronunciation: "bù", meaning: "不" },
              { tone: "平", pronunciation: "fǒu", meaning: "同'否'" },
            ],
            // 此处应取 bù，仄声
          },
        ],
    
        // 整体诊断
        diagnostics: [],  // 无格律错误
        matchScore: 1.0,  // 完全合律
      },
    }
    ```

### 测试覆盖维度

| 维度 | 覆盖内容 |
| --- | --- |
| **模板匹配** | 七律 · 首句入韵 · 平起（`qilü-shouju-ping`） |
| **逐行平仄** | 8 行完整的平仄序列 |
| **韵脚** | 5 个韵脚（西/低/泥/蹄/堤），全押八齐 |
| **对仗** | 颔联(3-4句)、颈联(5-6句) 标记要求对仗 |
| **多音字** | 燕/泥/行/不 四个多音字及其读音选项 |
| **逐句模式** | 单独校验第 4 句的完整流程 |

### 全量模式测试

- vitest 测试代码

    ```tsx
    // tests/qiantanghu-chunxing.test.ts
    import { describe, it, expect } from "vitest"
    import { QIANTANGHU_CHUNXING } from "./fixtures/qiantanghu-chunxing"
    
    describe("七律·白居易《钱塘湖春行》", () => {
      const { input, expected } = QIANTANGHU_CHUNXING
    
      it("应识别为七律·首句入韵·平起", async () => {
        const result = await analyze(input.text, input.options)
        expect(result.bestMatch?.templateId).toBe(expected.templateId)
        expect(result.ast.type).toBe(expected.type)
      })
    
      it("实际声调应与 actualTones 一致", async () => {
        const result = await analyze(input.text, input.options)
        result.ast.lines.forEach((line, i) => {
          const tones = line.chars.map(c => c.tone)
          expect(tones).toEqual(
            expected.actualTones[i].map(t =>
              t === "平" ? Tone.Ping : Tone.Ze
            )
          )
        })
      })
    
      it("实际声调应满足模板约束（含可平可仄）", async () => {
        const result = await analyze(input.text, input.options)
        result.ast.lines.forEach((line, i) => {
          line.chars.forEach((charNode, j) => {
            const constraint = expected.templatePatterns[i][j]
            if (constraint === "中") {
              // 可平可仄位，任何声调都合规
              expect([Tone.Ping, Tone.Ze]).toContain(charNode.tone)
            } else {
              const expectedTone = constraint === "平" ? Tone.Ping : Tone.Ze
              expect(charNode.tone).toBe(expectedTone)
            }
          })
        })
      })
    
      it("应检测到5个韵脚，全部押八齐", async () => {
        const result = await analyze(input.text, input.options)
        const rhymeLines = result.ast.lines.filter(l => l.isRhymeLine)
        expect(rhymeLines).toHaveLength(5)
        expected.rhyme.rhymeLines.forEach(({ lineIndex, char }) => {
          const line = result.ast.lines[lineIndex]
          expect(line.rhymeChar?.char).toBe(char)
        })
      })
    
      it("颔联和颈联应标记要求对仗", async () => {
        const result = await analyze(input.text, input.options)
        const couplets = result.ast.couplets!
        expect(couplets[1].requiresDuizhang).toBe(true)   // 颔联
        expect(couplets[2].requiresDuizhang).toBe(true)   // 颈联
        expect(couplets[0].requiresDuizhang).toBe(false)  // 首联
        expect(couplets[3].requiresDuizhang).toBe(false)  // 尾联
      })
    
      it("应检测到4个多音字：燕、泥、行、不", async () => {
        const result = await analyze(input.text, input.options)
        const ambChars = result.ambiguities.map(a => a.char)
        expect(ambChars).toEqual(
          expect.arrayContaining(["燕", "泥", "行", "不"])
        )
      })
    
      it("matchScore 应为 1.0（完全合律）", async () => {
        const result = await analyze(input.text, input.options)
        expect(result.bestMatch?.confidence).toBe(1.0)
        expect(
          result.diagnostics.filter(d => d.type === "violation")
        ).toHaveLength(0)
      })
    })
    ```

### 逐句模式测试

- 逐句校验第4句「谁家新燕啄春泥」

    ```tsx
    describe("逐句模式·《钱塘湖春行》第4句", () => {
      it("应正确校验'谁家新燕啄春泥'", async () => {
        const result = await analyzeLine(
          "谁家新燕啄春泥",
          {
            templateId: "qilü-shouju-ping",
            globalLineIndex: 3,
            precedingRhymes: [
              { char: "西", rhymeGroup: "八齐" },
              { char: "低", rhymeGroup: "八齐" },
            ],
            adjacentLines: {
              previous: "几处早莺争暖树",
            },
          },
          { rhymeDictType: "pingshui" }
        )
    
        // 格律
        expect(result.expectedPattern.map(formatConstraint))
          .toEqual(["平", "平", "仄", "仄", "仄", "平", "平"])
    
        // 韵脚
        expect(result.rhymeCheck?.isRhymeLine).toBe(true)
        expect(result.rhymeCheck?.rhymeChar).toBe("泥")
        expect(result.rhymeCheck?.isConsistent).toBe(true)
    
        // 多音字
        expect(result.ambiguities.some(a => a.char === "燕")).toBe(true)
    
        // 对仗
        expect(result.contextHints).toEqual(
          expect.arrayContaining([
            expect.stringContaining("对句"),
            expect.stringContaining("对仗"),
          ])
        )
      })
    })
    ```

---

## 测试样例：王之涣《登鹳雀楼》

五言绝句的基础测试样例，无多音字、无对仗要求、无拗救，用于校验最简单的格律匹配场景。

> 五言绝句 · 仄起 · 首句不入韵 · 平水韵 · 十一尤
>

### 测试数据定义

- 完整测试 fixture

    ```tsx
    // tests/fixtures/deng-guanque-lou.ts
    
    /**
     * 王之涣《登鹳雀楼》
     * 五言绝句·仄起·首句不入韵
     * 韵书：平水韵
     * 韵部：十一尤
     * 特点：平仄完全符合要求，无多音字歧义，最简测试样例
     */
    export const DENG_GUANQUE_LOU = {
      // ===== 输入 =====
      input: {
        text: [
          "白日依山尽，",
          "黄河入海流。",
          "欲穷千里目，",
          "更上一层楼。",
        ].join("\n"),
        options: {
          rhymeDictType: "pingshui" as const,
          preferredType: "jueju" as const,
          strictMode: true,
        },
      },
    
      // ===== 期望输出 =====
      expected: {
        // 模板匹配
        templateId: "wujue-zeqi",
        templateName: "五绝·仄起·首句不入韵",
        type: "jueju",
        charPerLine: 5,
        lineCount: 4,
    
        // 格律模板（含可平可仄「中」）
        templatePatterns: [
          ["中", "仄", "平", "平", "仄"],  // 第1句
          ["平", "平", "中", "仄", "平"],  // 第2句
          ["中", "平", "平", "仄", "仄"],  // 第3句
          ["中", "仄", "仄", "平", "平"],  // 第4句
        ],
    
        // 实际声调（每个字的真实平仄）
        actualTones: [
          ["仄", "仄", "平", "平", "仄"],  // 白日依山尽
          ["平", "平", "仄", "仄", "平"],  // 黄河入海流
          ["仄", "平", "平", "仄", "仄"],  // 欲穷千里目（欲=入声，仄）
          ["仄", "仄", "仄", "平", "平"],  // 更上一层楼
        ],
    
        // 韵脚检测
        rhyme: {
          rhymeGroup: "十一尤",
          rhymeType: "ping",
          rhymeLines: [
            { lineIndex: 1, char: "流", rhymeGroups: ["十一尤"], isConsistent: true },
            { lineIndex: 3, char: "楼", rhymeGroups: ["十一尤"], isConsistent: true },
          ],
        },
    
        // 对仗（绝句无对仗要求）
        couplets: [
          { coupletIndex: 0, upper: 0, lower: 1, requiresDuizhang: false },
          { coupletIndex: 1, upper: 2, lower: 3, requiresDuizhang: false },
        ],
    
        // 多音字警告：无
        ambiguities: [],
    
        // 整体诊断
        diagnostics: [],  // 无格律错误
        matchScore: 1.0,  // 完全合律
      },
    }
    ```

### 测试覆盖维度

| 维度 | 覆盖内容 |
| --- | --- |
| **模板匹配** | 五绝 · 仄起 · 首句不入韵（`wujue-zeqi`） |
| **逐行平仄** | 4 行完整的平仄序列 |
| **韵脚** | 2 个韵脚（流/楼），全押十一尤 |
| **对仗** | 绝句无对仗要求，两联均为 `false` |
| **多音字** | 无多音字歧义（baseline case） |
| **测试价值** | 最简场景，验证 parser 基本 happy path |

### vitest 测试代码

- 完整测试

    ```tsx
    // tests/deng-guanque-lou.test.ts
    import { describe, it, expect } from "vitest"
    import { DENG_GUANQUE_LOU } from "./fixtures/deng-guanque-lou"
    
    describe("五绝·王之涣《登鹳雀楼》", () => {
      const { input, expected } = DENG_GUANQUE_LOU
    
      it("应识别为五绝·仄起·首句不入韵", async () => {
        const result = await analyze(input.text, input.options)
        expect(result.bestMatch?.templateId).toBe(expected.templateId)
        expect(result.ast.type).toBe("jueju")
      })
    
      it("实际声调应与 actualTones 一致", async () => {
        const result = await analyze(input.text, input.options)
        result.ast.lines.forEach((line, i) => {
          const tones = line.chars.map(c => c.tone)
          expect(tones).toEqual(
            expected.actualTones[i].map(t =>
              t === "平" ? Tone.Ping : Tone.Ze
            )
          )
        })
      })
    
      it("实际声调应满足模板约束（含可平可仄）", async () => {
        const result = await analyze(input.text, input.options)
        result.ast.lines.forEach((line, i) => {
          line.chars.forEach((charNode, j) => {
            const constraint = expected.templatePatterns[i][j]
            if (constraint === "中") {
              // 可平可仄位，任何声调都合规
              expect([Tone.Ping, Tone.Ze]).toContain(charNode.tone)
            } else {
              const expectedTone = constraint === "平" ? Tone.Ping : Tone.Ze
              expect(charNode.tone).toBe(expectedTone)
            }
          })
        })
      })
    
      it("应检测到2个韵脚（流、楼），全押十一尤", async () => {
        const result = await analyze(input.text, input.options)
        const rhymeLines = result.ast.lines.filter(l => l.isRhymeLine)
        expect(rhymeLines).toHaveLength(2)
        expect(rhymeLines[0].rhymeChar?.char).toBe("流")
        expect(rhymeLines[1].rhymeChar?.char).toBe("楼")
      })
    
      it("绝句不应有对仗要求", async () => {
        const result = await analyze(input.text, input.options)
        const couplets = result.ast.couplets!
        expect(couplets.every(c => c.requiresDuizhang === false)).toBe(true)
      })
    
      it("不应有多音字警告", async () => {
        const result = await analyze(input.text, input.options)
        expect(result.ambiguities).toHaveLength(0)
      })
    
      it("matchScore 应为 1.0（完全合律）", async () => {
        const result = await analyze(input.text, input.options)
        expect(result.bestMatch?.confidence).toBe(1.0)
        expect(
          result.diagnostics.filter(d => d.type === "violation")
        ).toHaveLength(0)
      })
    })
    ```

### 与《钱塘湖春行》的对比价值

| 对比项 | 《钱塘湖春行》（七律） | 《登鹳雀楼》（五绝） |
| --- | --- | --- |
| **体裁** | 七言律诗（8句） | 五言绝句（4句） |
| **起式** | 平起平收·首句入韵 | 仄起·首句不入韵 |
| **韵脚数** | 5 个（含首句） | 2 个 |
| **对仗** | 颔联+颈联要求对仗 | 无对仗要求 |
| **多音字** | 4 个（燕/泥/行/不） | 0 个 |
| **测试定位** | 复杂场景（full-featured） | 最简基线（happy path） |
