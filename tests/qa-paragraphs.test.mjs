import test from "node:test";
import assert from "node:assert/strict";

import {
  collapseQaParagraphLines,
  inferImplicitAnswerPrefixes,
} from "../app/qa-paragraphs.js";

test("collapses consecutive Q&A continuation lines into natural paragraphs", () => {
  const lines = [
    "Q1: Which standards were reviewed?",
    "Please include the decision criteria.",
    "A1: We reviewed the global standard.",
    "We compared security and cost.",
    "The final decision was made centrally.",
    "",
    "Q2: What changed?",
    "A2: The approval flow changed.",
    "Employment History:",
    "Apr 2020 - Present",
  ];

  assert.deepEqual(collapseQaParagraphLines(lines), [
    "Q1: Which standards were reviewed? Please include the decision criteria.",
    "A1: We reviewed the global standard. We compared security and cost. The final decision was made centrally.",
    "Q2: What changed?",
    "A2: The approval flow changed.",
    "Employment History:",
    "Apr 2020 - Present",
  ]);
});

test("joins Japanese answer lines without inserting artificial spaces", () => {
  const lines = [
    "Q1: 規程変更時の周知方法は？",
    "A1: 管理職経由で説明します。",
    "予約システム外利用時は理由記載を必須とします。",
    "宿泊延長もシステムで統制します。",
    "Availability:",
    "Wednesday 14 October 17:00 - 21:00",
  ];

  assert.deepEqual(collapseQaParagraphLines(lines), [
    "Q1: 規程変更時の周知方法は？",
    "A1: 管理職経由で説明します。予約システム外利用時は理由記載を必須とします。宿泊延長もシステムで統制します。",
    "Availability:",
    "Wednesday 14 October 17:00 - 21:00",
  ]);
});

test("keeps the final answer sentence before the next numbered question", () => {
  const lines = [
    "① 海外拠点を含めた標準仕様の意思決定のベストプラクティス",
    "A: 本社と海外拠点で候補構成を検証します。",
    "現地調達価格と保守体制も含めて判断します",
    "② 実施すべき検証と評価項目",
    "A: OSと業務アプリの条件を分けて比較します。",
    "評価結果を本社と拠点で確認します",
    "③ 更新時の運用方法",
  ];

  assert.deepEqual(collapseQaParagraphLines(lines), [
    "① 海外拠点を含めた標準仕様の意思決定のベストプラクティス",
    "A: 本社と海外拠点で候補構成を検証します。現地調達価格と保守体制も含めて判断します",
    "② 実施すべき検証と評価項目",
    "A: OSと業務アプリの条件を分けて比較します。評価結果を本社と拠点で確認します",
    "③ 更新時の運用方法",
  ]);
});

test("preserves an explicitly bulleted Q&A topic boundary", () => {
  const lines = [
    "Q1: 規程変更時の周知方法は？",
    "A1: 管理職経由で説明します。",
    "· OA機器 (PC)",
    "Q2: 標準仕様はどのように決めますか？",
    "A2: 本社と各拠点で決定します。",
  ];

  assert.deepEqual(collapseQaParagraphLines(lines), [
    "Q1: 規程変更時の周知方法は？",
    "A1: 管理職経由で説明します。",
    "· OA機器 (PC)",
    "Q2: 標準仕様はどのように決めますか？",
    "A2: 本社と各拠点で決定します。",
  ]);
});

test("infers answers that are separated from complete questions by a blank line", () => {
  const lines = [
    "Q3. Can you discuss the process of setting standard costs for products?",
    "",
    "Yes, standard cost setting has been one of my core responsibilities.",
    "",
    "The process requires input from several departments.",
    "",
    "Q4. Can you discuss category-level P&L management?",
    "",
    "I regularly reviewed product profitability.",
  ];

  assert.deepEqual(inferImplicitAnswerPrefixes(lines), [
    "Q3. Can you discuss the process of setting standard costs for products?",
    "",
    "A: Yes, standard cost setting has been one of my core responsibilities.",
    "",
    "The process requires input from several departments.",
    "",
    "Q4. Can you discuss category-level P&L management?",
    "",
    "A: I regularly reviewed product profitability.",
  ]);

  assert.deepEqual(collapseQaParagraphLines(lines), [
    "Q3. Can you discuss the process of setting standard costs for products?",
    "A: Yes, standard cost setting has been one of my core responsibilities. The process requires input from several departments.",
    "Q4. Can you discuss category-level P&L management?",
    "A: I regularly reviewed product profitability.",
  ]);
});

test("does not infer an answer when the next block is a new section", () => {
  const lines = [
    "Q5. Which brands can you discuss?",
    "",
    "Employment History:",
    "Mar 2025 - Present",
  ];

  assert.deepEqual(inferImplicitAnswerPrefixes(lines), lines);
});

test("keeps circled subtopics inside their main question card", () => {
  const lines = [
    "Q. 原価管理はどのような目的で活用されていましたか？",
    "",
    "① バランシンググループにおける電力の卸",
    "",
    "② 相対電源での電力卸",
    "",
    "③ 小売電気事業者における電気料金メニューの策定",
    "",
    "④ 他電源の調達",
    "",
    "Q. 会社全体ではどのようなプロセスでしたか？",
    "A: 営業部門や経営企画が関与していました。",
  ];

  assert.deepEqual(collapseQaParagraphLines(lines), [
    "Q. 原価管理はどのような目的で活用されていましたか？ ① バランシンググループにおける電力の卸 ② 相対電源での電力卸 ③ 小売電気事業者における電気料金メニューの策定 ④ 他電源の調達",
    "Q. 会社全体ではどのようなプロセスでしたか？",
    "A: 営業部門や経営企画が関与していました。",
  ]);
});

test("keeps separately answered circled questions as separate cards", () => {
  const lines = [
    "① 最初の質問ですか？",
    "A: 最初の回答です。",
    "② 次の質問ですか？",
    "A: 次の回答です。",
  ];

  assert.deepEqual(collapseQaParagraphLines(lines), lines);
});

test("infers answers placed directly below circled question headings", () => {
  const lines = [
    "[Screened 2026-10-26]",
    "① 経験領域・役割・規模",
    "建設×データセンター、環境設備建設に対応可能です。案件の技術管理を担当しました。",
    "",
    "② 今後の需要動向",
    "AI・クラウド需要の拡大に伴い、DCの新設・増設需要は増加すると考えます。",
    "",
    "③ 受注に重要な要件",
    "品質、安全性、技術力、施工実績、納期遵守が特に重要です。",
    "Employment History:",
  ];

  assert.deepEqual(collapseQaParagraphLines(lines), [
    "[Screened 2026-10-26]",
    "① 経験領域・役割・規模",
    "A: 建設×データセンター、環境設備建設に対応可能です。案件の技術管理を担当しました。",
    "② 今後の需要動向",
    "A: AI・クラウド需要の拡大に伴い、DCの新設・増設需要は増加すると考えます。",
    "③ 受注に重要な要件",
    "A: 品質、安全性、技術力、施工実績、納期遵守が特に重要です。",
    "Employment History:",
  ]);
});
