export const QIANTANGHU_CHUNXING = {
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
      templateId: "qilü-shouju-ping" as const,
      strictMode: true,
    },
  },
  expected: {
    templateId: "qilü-shouju-ping",
    type: "lüshi",
    lineCount: 8,
    rhymeChars: ["西", "低", "泥", "蹄", "堤"],
  },
};
