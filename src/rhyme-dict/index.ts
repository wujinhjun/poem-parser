/**
 * 韵书接口
 *
 * 纯类型模块 —— 无 fs / path / process 依赖。
 * 调用方实现 RhymeDict 接口或通过 loader.ts 构造 JsonRhymeDict。
 *
 * @module rhyme-dict
 */

import type { Tone, RhymeDictType } from "../core/types.js";

export interface RhymeEntry {
  char: string;
  tone: Tone;
  rhymeGroup: string;
  pronunciation?: string;
}

export interface RhymeDict {
  type: RhymeDictType;
  lookup(char: string): RhymeEntry[];
  getRhymeGroup(char: string): string[];
  isSameRhyme(a: string, b: string): boolean;
}
