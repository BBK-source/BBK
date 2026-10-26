import {
  ANSWER_PREFIX_RE,
  ARROW_ANSWER_RE,
  EXPERT_LINE_RE,
  isAvailabilityHeading,
  isEmploymentHeading,
  isQaTopicHeading,
  isQuestionStart,
  isScreenedHeading,
} from "./structure.js";
import {
  isAvailabilityLine,
  isTimeZoneLine,
  isUnavailableAvailabilityLine,
} from "./availability.js";

function nextNonBlankLineIndex(lines, index) {
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    if (lines[cursor].trim()) return cursor;
  }
  return -1;
}

function joinParagraphLines(lines) {
  return lines.reduce((paragraph, line) => {
    const value = line.trim();
    if (!paragraph) return value;
    const needsSpace = (
      /[A-Za-z0-9%.,;:!?)]$/.test(paragraph)
      && /^[A-Za-z0-9([#]/.test(value)
    ) || /^[·•▪◦§○①②③④⑤⑥⑦⑧⑨⑩]/.test(value);
    return `${paragraph}${needsSpace ? " " : ""}${value}`;
  }, "");
}

function isExplicitQaTopicHeading(value, nextNonBlank) {
  return /^[·•▪◦]\s*\S/.test(value)
    && isQaTopicHeading(value, nextNonBlank);
}

const CIRCLED_QUESTION_RE = /^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]\s*/;

function isSectionBoundary(lines, index, nextNonBlank) {
  const value = lines[index].trim();
  return isScreenedHeading(value)
    || isEmploymentHeading(value)
    || isAvailabilityHeading(value)
    || isAvailabilityLine(value)
    || isUnavailableAvailabilityLine(value)
    || isTimeZoneLine(value)
    || EXPERT_LINE_RE.test(value)
    || /^Book Now$/i.test(value)
    // While a Q or A is active, an unmarked sentence immediately before the
    // next question is still part of the current paragraph. Only an explicit
    // bullet can introduce a new Q&A topic at this point.
    || isExplicitQaTopicHeading(value, nextNonBlank)
    || (/[:：]\s*$/.test(value) && EXPERT_LINE_RE.test(nextNonBlank));
}

export function inferImplicitAnswerPrefixes(sourceLines) {
  const lines = [...sourceLines];

  for (let index = 0; index < lines.length; index += 1) {
    const value = lines[index].trim();
    const nextIndex = nextNonBlankLineIndex(lines, index);
    const nextNonBlank = nextIndex >= 0 ? lines[nextIndex].trim() : "";

    // Some exports use a short circled-number heading as the question and put
    // the answer directly on the next line without an A: label. Treat only an
    // immediately adjacent plain line as the answer. Circled subtopics that
    // are separated by blank rows therefore remain part of their parent Q.
    if (
      CIRCLED_QUESTION_RE.test(value)
      && nextIndex === index + 1
      && nextNonBlank
      && !ANSWER_PREFIX_RE.test(nextNonBlank)
      && !ARROW_ANSWER_RE.test(nextNonBlank)
    ) {
      const afterIndex = nextNonBlankLineIndex(lines, nextIndex);
      const afterCandidate = afterIndex >= 0 ? lines[afterIndex].trim() : "";
      if (
        !isQuestionStart(nextNonBlank, afterCandidate)
        && !isSectionBoundary(lines, nextIndex, afterCandidate)
      ) {
        lines[nextIndex] = `${lines[nextIndex].match(/^\s*/)?.[0] ?? ""}A: ${nextNonBlank}`;
        continue;
      }
    }

    // Some profile exports omit A:/>> entirely and separate the answer from
    // the completed question with a blank line. Add a neutral answer marker
    // so the existing Q&A formatter and diagnostics can treat it correctly.
    if (
      !/[?？]\s*$/.test(value)
      || !isQuestionStart(value, nextNonBlank)
      || nextIndex <= index + 1
      || ANSWER_PREFIX_RE.test(nextNonBlank)
      || ARROW_ANSWER_RE.test(nextNonBlank)
    ) {
      continue;
    }

    const afterIndex = nextNonBlankLineIndex(lines, nextIndex);
    const afterCandidate = afterIndex >= 0 ? lines[afterIndex].trim() : "";
    if (
      isQuestionStart(nextNonBlank, afterCandidate)
      || isSectionBoundary(lines, nextIndex, afterCandidate)
    ) {
      continue;
    }

    lines[nextIndex] = `${lines[nextIndex].match(/^\s*/)?.[0] ?? ""}A: ${nextNonBlank}`;
  }

  return lines;
}

export function collapseQaParagraphLines(sourceLines) {
  const lines = inferImplicitAnswerPrefixes(sourceLines);
  const output = [];
  let activeRole = null;
  let paragraphLines = [];

  const flushParagraph = () => {
    if (paragraphLines.length) output.push(joinParagraphLines(paragraphLines));
    paragraphLines = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const value = line.trim();
    const nextIndex = nextNonBlankLineIndex(lines, index);
    const nextNonBlank = nextIndex >= 0 ? lines[nextIndex].trim() : "";

    if (!value) {
      if (activeRole === "answer") continue;
      if (activeRole === "question") {
        // Circled items commonly list examples or subtopics under one main
        // question. Blank rows copied from the source table must not split
        // each item into a separate colored card.
        if (CIRCLED_QUESTION_RE.test(nextNonBlank)) continue;
        const answerFollows = ANSWER_PREFIX_RE.test(nextNonBlank)
          || ARROW_ANSWER_RE.test(nextNonBlank);
        const afterNextIndex = nextIndex >= 0
          ? nextNonBlankLineIndex(lines, nextIndex)
          : -1;
        const afterNextNonBlank = afterNextIndex >= 0
          ? lines[afterNextIndex].trim()
          : "";
        const questionFollows = isQuestionStart(nextNonBlank, afterNextNonBlank);
        flushParagraph();
        activeRole = null;
        if (!answerFollows && !questionFollows && output.at(-1) !== "") {
          output.push("");
        }
        continue;
      }
      if (output.at(-1) !== "") output.push("");
      continue;
    }

    const startsQuestion = isQuestionStart(value, nextNonBlank);
    const startsAnswer = ANSWER_PREFIX_RE.test(value) || ARROW_ANSWER_RE.test(value);

    if (activeRole === "question" && CIRCLED_QUESTION_RE.test(value)) {
      paragraphLines.push(value);
      continue;
    }

    if (startsQuestion) {
      flushParagraph();
      activeRole = "question";
      paragraphLines = [value];
      continue;
    }

    if (startsAnswer) {
      flushParagraph();
      activeRole = "answer";
      paragraphLines = [value];
      continue;
    }

    if (activeRole && !isSectionBoundary(lines, index, nextNonBlank)) {
      paragraphLines.push(value);
      continue;
    }

    flushParagraph();
    activeRole = null;
    output.push(line);
  }

  flushParagraph();
  while (output.at(-1) === "") output.pop();
  return output;
}
