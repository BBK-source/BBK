const EXPERT_LINE_RE =
  /^(?:[-•]\s*)?(?:#(?:[A-Z][A-Z0-9]*|\d+)(?:[.-]\d+)*|[A-Z][A-Z0-9]*(?:[.-]\d+)+)\s*[-–]/i;

export const QUESTION_PREFIX_RE =
  /^(?:(?:Q|Question)\s*\d*|質問\s*\d+|问题\s*\d+|問題\s*\d+|问\s*\d+|問\s*\d+|\d{1,2})\s*[.:：．、]\s*/i;

export const ANSWER_PREFIX_RE =
  /^(?:(?:A|Answer)\s*\d*|回答\s*\d*|答\s*\d+)\s*[.:：．、]\s*/i;

export const ARROW_ANSWER_RE = /^(?:>>+|→|⇒|->|=>)\s*/;

export function isExpertLine(line) {
  return EXPERT_LINE_RE.test(line.trim());
}

export function isScreenedHeading(line) {
  const value = line.trim();
  return /^(?:[\[【(（]\s*)?(?:screen(?:ed|ing)|スクリーニング|筛选|篩選)(?:\s+(?:on\s+)?)?[^]*?(?:[\]】)）]\s*)?$/i.test(value);
}

export function isEmploymentHeading(line) {
  return /^(?:Employment|Work|Career)\s+History\s*[:：]?\s*$|^(?:職歴|経歴|工作经历|工作經歷|任职经历|任職經歷)\s*[:：]?\s*$/i.test(line.trim());
}

export function isAvailabilityHeading(line) {
  return /^(?:Availability|Available\s+Times?|Interview\s+Availability)\s*[:：]?\s*$|^(?:面談可能時間|対応可能時間|日程候補|可访谈时间|可訪談時間|可用时间|可用時間)\s*[:：]?\s*$/i.test(line.trim());
}

import {
  isAvailabilityLine,
  isUnavailableAvailabilityLine,
} from "./availability.js";

export function isQuestionStart(line, nextNonBlank = "") {
  const value = line.trim();
  if (QUESTION_PREFIX_RE.test(value)) return true;
  return /[?？]\s*$/.test(value)
    && (ANSWER_PREFIX_RE.test(nextNonBlank.trim()) || ARROW_ANSWER_RE.test(nextNonBlank.trim()));
}

export function isAnswerStart(line) {
  const value = line.trim();
  return ANSWER_PREFIX_RE.test(value) || ARROW_ANSWER_RE.test(value);
}

export function classifyProfileSections(text) {
  const lines = text.split(/\r?\n/);
  let section = "intro";
  return lines.map((line, index) => {
    const value = line.trim();
    const nextNonBlank =
      lines.slice(index + 1).find((candidate) => candidate.trim())?.trim() ?? "";

    if (isExpertLine(value)) section = "intro";
    if (isScreenedHeading(value) || isQuestionStart(value, nextNonBlank) || isAnswerStart(value)) {
      section = "qa";
    } else if (isEmploymentHeading(value)) {
      section = "employment";
    } else if (isAvailabilityHeading(value)) {
      section = "availability";
    } else if (isAvailabilityLine(value) || isUnavailableAvailabilityLine(value)) {
      section = "availability";
    }
    return section;
  });
}
