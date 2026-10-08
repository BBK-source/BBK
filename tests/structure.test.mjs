import assert from "node:assert/strict";
import test from "node:test";

import {
  ANSWER_PREFIX_RE,
  QUESTION_PREFIX_RE,
  classifyProfileSections,
  isExpertLine,
  isQuestionStart,
} from "../app/structure.js";

test("recognizes grouped screening question labels", () => {
  const questions = [
    "Q1-1. Regions you can discuss",
    "Q 1-2: Topics you can discuss",
    "Q1.3 Latest developments",
    "Ｑ１－４：最新の動向",
    "问题 2－1：可以讨论的地区",
  ];

  questions.forEach((value) => {
    assert.equal(isQuestionStart(value), true, value);
    assert.match(value, QUESTION_PREFIX_RE);
  });
});

test("recognizes grouped screening answer labels", () => {
  const answers = [
    "A1-1: EU / UK / Australia",
    "A 1-2. I can discuss all topics",
    "A1.3 Regulatory bodies are establishing requirements",
    "Ａ１－４：回答内容",
    "回答 2－1：可以讨论",
  ];

  answers.forEach((value) => assert.match(value, ANSWER_PREFIX_RE));
});

test("recognizes standalone Q and A labels without punctuation", () => {
  const questions = ["Q1", "Q 2", "Ｑ３", "Q1-2", "问题 2－1"];
  const answers = ["A1", "A 2", "Ａ３", "A1-2", "回答 2－1"];

  questions.forEach((value) => {
    assert.equal(isQuestionStart(value), true, value);
    assert.match(value, QUESTION_PREFIX_RE);
  });
  answers.forEach((value) => assert.match(value, ANSWER_PREFIX_RE));

  assert.deepEqual(
    classifyProfileSections(["[screened 2026-9-1]", "Q1", "Question body", "A1", "Answer body"].join("\n")),
    ["qa", "qa", "qa", "qa", "qa"],
  );
});

test("keeps multi-line grouped answers inside the Q&A section", () => {
  const sections = classifyProfileSections([
    "[For experts selecting regulation]",
    "Q1-2. Topics you can discuss",
    "① Overview of AI laws and regulations",
    "② Regulations applicable to high-risk use cases",
    "A1-2: I can discuss them all in the consultation.",
    "Further detail continues on this line.",
    "Q 1-3. Latest developments",
    "A1-3: Regulatory bodies are establishing strict requirements.",
  ].join("\n"));

  assert.deepEqual(sections, ["intro", "qa", "qa", "qa", "qa", "qa", "qa", "qa"]);
});

test("does not mistake dates for standalone question labels", () => {
  assert.equal(QUESTION_PREFIX_RE.test("2026-08-24. Screening completed"), false);
  assert.equal(QUESTION_PREFIX_RE.test("1"), false);
});

test("recognizes recommended expert headings from the project page", () => {
  [
    "Recommended #1.2 - Deepak Khandelwal - Former COO at DBS Bank",
    "Recommended Expert: #A2-1 – Jane Doe - Former Director",
    "推荐 #3.1 - 王女士 - 前总经理",
    "推奨 #4.2 - 山田太郎 - 元部長",
    "추천 #5.1 - 홍길동 - 전 이사",
  ].forEach((value) => assert.equal(isExpertLine(value), true, value));
});
