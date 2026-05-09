# cleaned data

本目录由 `pnpm run clean:data` 自动生成，供 `poem parser` 代码直接读取。

## 文件说明

- `rhyme-char-index.json`
  - 统一韵书索引：`{ [char]: RhymeEntry[] }`
  - `RhymeEntry` 结构：
    - `dictType`: `pingshui | cilin | zhonghua_new | ci_rhyme`
    - `tone`: `平 | 仄 | 未知`
    - `rhymeGroup`: 韵部名

- `tone-lookup.json`
  - 单字平仄速查：`{ [char]: "平" | "仄" | "多" | "未知" }`

- `word-explain-cleaned.json`
  - 多音字读音和释义：`{ [char]: [{ pronunciation, explains[] }] }`

- `ci-catalog-cleaned.json`
  - 词牌分类索引，`tunes` 字段规范为 `sketch`

- `ci-tunes-index.json`
  - 词牌索引：`[{ name, path }]`
  - 用于根据词牌名定位到拆分文件

- `ci-tunes/*.json`
  - 每个词牌一个文件，结构为 `{ name, desc, formats }`
  - `shift` 统一为 boolean，`tune` 统一为 `平/仄/未知`

- `stats.json`
  - 清洗统计信息
