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
