export const DENG_GUANQUE_LOU = {
  input: {
    text: ["白日依山尽，", "黄河入海流。", "欲穷千里目，", "更上一层楼。"].join("\n"),
    options: {
      rhymeDictType: "pingshui" as const,
      preferredType: "jueju" as const,
      templateId: "wujue-zeqi" as const,
      strictMode: true,
    },
  },
  expected: {
    templateId: "wujue-zeqi",
    type: "jueju",
    lineCount: 4,
    rhymeChars: ["流", "楼"],
  },
};
