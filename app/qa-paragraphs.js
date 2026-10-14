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

function isSectionBoundary(lines, index, nextNonBlank) {
  const value = lines[index].trim();
  const qaTopicHeading = isQaTopicHeading(value, nextNonBlank)
    && (/^[·•▪◦]\s*/.test(value) || (!/[.。!?？！]$/.test(value) && value.length <= 40));
  return isScreenedHeading(value)
    || isEmploymentHeading(value)
    || isAvailabilityHeading(value)
    || isAvailabilityLine(value)
    || isUnavailableAvailabilityLine(value)
    || isTimeZoneLine(value)
    || EXPERT_LINE_RE.test(value)
    || /^Book Now$/i.test(value)
    || qaTopicHeading
    || (/[:：]\s*$/.test(value) && EXPERT_LINE_RE.test(nextNonBlank));
}

export function collapseQaParagraphLines(sourceLines) {
  const lines = [...sourceLines];
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
        const answerFollows = ANSWER_PREFIX_RE.test(nextNonBlank)
          || ARROW_ANSWER_RE.test(nextNonBlank);
        flushParagraph();
        activeRole = null;
        if (!answerFollows && output.at(-1) !== "") output.push("");
        continue;
      }
      if (output.at(-1) !== "") output.push("");
      continue;
    }

    const startsQuestion = isQuestionStart(value, nextNonBlank);
    const startsAnswer = ANSWER_PREFIX_RE.test(value) || ARROW_ANSWER_RE.test(value);

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
