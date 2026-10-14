import test from "node:test";
import assert from "node:assert/strict";

import { collapseQaParagraphLines } from "../app/qa-paragraphs.js";

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
