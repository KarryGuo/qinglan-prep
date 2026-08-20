/**
 * 评测集：3 个标准用例，覆盖班级记忆的三种迁移路径。
 * 用例输入全部预置（课题四要素、学情描述、初始记忆、作业成绩 CSV），
 * 断言全部可机检（见 run.ts），任何人 `npm run eval` 可复现。
 *
 * 用例 A（保留）：弱点仍显著（正确率 48-55%）→ 记忆中弱点必须保留，不许凭空清除
 * 用例 B（生长）：新接手班级、空记忆 + 本次作业暴露新弱点 → 记忆必须从零生长
 * 用例 C（消退）：弱点经训练已达标（正确率 90-95%）→ 记忆必须移除弱点并记入已解决
 */

export type MemoryCheck =
  | { kind: "preserved"; target: string }
  | { kind: "grown" }
  | { kind: "resolved"; target: string };

export type EvalCase = {
  id: string;
  name: string;
  subject: string;
  grade: string;
  textbook: string;
  title: string;
  classDesc: string;
  /** 初始班级记忆（写入 ClassMemory.profile） */
  initialMemory: {
    weakPoints: { name: string; severity: number; evidence: string }[];
    resolved: string[];
  };
  /** diagnose 触发 confirm_required（向教师提问）时的标准回答 */
  teacherAnswer: string;
  /** reflect 阶段注入的作业成绩 CSV（题号/知识点/正确率） */
  reflectCsv: string;
  /** reflect 后对班级记忆的迁移断言 */
  memoryCheck: MemoryCheck;
  /** 端到端 Citation 行数下限（A/C 有学情引用更多，B 无历史弱点引用较少） */
  citationFloor: number;
};

export const CASES: EvalCase[] = [
  {
    id: "case-a-hehua",
    name: "用例 A《荷花》· 弱点延续",
    subject: "语文",
    grade: "三年级",
    textbook: "统编版",
    title: "荷花",
    classDesc:
      "班级共 42 人。多数学生能正确、流利地朗读课文，对比喻、拟人等修辞有初步辨认能力。上学期期末阅读题中，概括段意类题目班级正确率仅 41%，多数学生以偏概全、只抓细节。教师反馈连续讲授超过 12 分钟后约半数学生走神。",
    initialMemory: {
      weakPoints: [
        {
          name: "段落大意概括",
          severity: 3,
          evidence: "上学期期末阅读题中，概括段意类题目班级正确率仅 41%，多数学生以偏概全、只抓细节。",
        },
        {
          name: "注意力持续时间短",
          severity: 2,
          evidence: "教师反馈：连续讲授超过 12 分钟后约半数学生走神，需要穿插互动与切换活动形式。",
        },
      ],
      resolved: [],
    },
    teacherAnswer: "按现有班级记忆与教材信息诊断即可，无需补充。",
    reflectCsv: `题号,知识点,正确率
1,段落大意概括,55%
2,段落大意概括,48%
3,想象画面,88%
4,修辞辨认,85%
5,关键词句体会,80%`,
    memoryCheck: { kind: "preserved", target: "段落大意概括" },
    citationFloor: 5,
  },
  {
    id: "case-b-shouzhudaitu",
    name: "用例 B《守株待兔》· 空记忆冷启动",
    subject: "语文",
    grade: "三年级",
    textbook: "统编版",
    title: "守株待兔",
    classDesc:
      "新接手的班级，暂无历史学情记录。这是学生第一次正式学习文言文，预习反馈中约三分之一的学生表示'读不懂'，个别学生能借助注释说出大意但语句不通顺。",
    initialMemory: {
      weakPoints: [],
      resolved: [],
    },
    teacherAnswer: "按教师描述与教材信息诊断即可，无需补充。",
    reflectCsv: `题号,知识点,正确率
1,文言文理解,45%
2,文言文理解,52%
3,复述与表达,60%
4,朗读与积累,78%
5,文言文理解,48%`,
    memoryCheck: { kind: "grown" },
    citationFloor: 3,
  },
  {
    id: "case-c-huazhong",
    name: "用例 C《花钟》· 弱点消退",
    subject: "语文",
    grade: "三年级",
    textbook: "统编版",
    title: "花钟",
    classDesc:
      "班级经过一学期'借助关键语句概括段意'的专项训练，课前测显示概括段意类题目正确率已从 41% 提升到 80%。近义词辨析与仿写表达仍是薄弱环节。",
    initialMemory: {
      weakPoints: [
        {
          name: "段落大意概括",
          severity: 3,
          evidence: "上学期期末阅读题中，概括段意类题目班级正确率仅 41%，多数学生以偏概全、只抓细节。",
        },
      ],
      resolved: [],
    },
    teacherAnswer: "按现有班级记忆与教材信息诊断即可，无需补充。",
    reflectCsv: `题号,知识点,正确率
1,段落大意概括,92%
2,段落大意概括,90%
3,关键词句体会,84%
4,说明方法,76%
5,段落大意概括,95%`,
    memoryCheck: { kind: "resolved", target: "段落大意概括" },
    citationFloor: 5,
  },
];
