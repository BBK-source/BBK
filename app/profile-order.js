import {
  isAvailabilityHeading,
  isExpertLine,
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

function isAngleTitleLine(lines, index) {
  const candidate = lines[index]?.trim() ?? "";
  const nextIndex = nextNonBlankLineIndex(lines, index);
  return /[:：]\s*$/.test(candidate)
    && nextIndex >= 0
    && isExpertLine(lines[nextIndex]);
}

function isAvailabilityContent(line) {
  return isAvailabilityLine(line) || isUnavailableAvailabilityLine(line);
}

function trimBlankEdges(lines) {
  let start = 0;
  let end = lines.length;
  while (start < end && !lines[start].trim()) start += 1;
  while (end > start && !lines[end - 1].trim()) end -= 1;
  return lines.slice(start, end);
}

function collapseBlankLines(lines) {
  return lines.filter((line, index) => (
    line.trim() || index === 0 || lines[index - 1].trim()
  ));
}

function availabilityIndexes(block) {
  const directContent = block
    .map((line, index) => (isAvailabilityContent(line) ? index : -1))
    .filter((index) => index >= 0);

  if (!directContent.length) return new Set();

  const indexes = new Set(directContent);
  block.forEach((line, index) => {
    if (isAvailabilityHeading(line) || isTimeZoneLine(line)) indexes.add(index);
  });

  // Keep blank separators located inside an availability section so copied
  // schedules retain their readable grouping after being moved.
  const first = Math.min(...indexes);
  const last = Math.max(...indexes);
  for (let index = first; index <= last; index += 1) {
    if (!block[index].trim()) indexes.add(index);
  }
  return indexes;
}

function reorderExpertBlock(block) {
  if (block.length < 2) return block;
  const title = block[0];
  const tail = block.slice(1);
  const indexes = availabilityIndexes(tail);
  if (!indexes.size) return block;

  const availability = collapseBlankLines(trimBlankEdges(
    tail.filter((_, index) => indexes.has(index)),
  ));
  const remainder = trimBlankEdges(tail.filter((_, index) => !indexes.has(index)));

  // Book Now must remain the first non-empty line after the expert title so
  // the formatter can bind it to the correct expert URL.
  const firstNonBlank = remainder.findIndex((line) => line.trim());
  const bookNowIndex = firstNonBlank >= 0 && /^Book\s*Now$/i.test(remainder[firstNonBlank].trim())
    ? firstNonBlank
    : -1;
  const bookNow = bookNowIndex >= 0 ? remainder.splice(bookNowIndex, 1) : [];
  const body = trimBlankEdges(remainder);
  const output = [title, ...bookNow, ...availability];
  if (body.length) output.push("", ...body);
  return output;
}

function expertBlockEnd(lines, start) {
  for (let index = start + 1; index < lines.length; index += 1) {
    if (isExpertLine(lines[index]) || isAngleTitleLine(lines, index)) return index;
  }
  return lines.length;
}

export function reorderAvailabilityLines(text) {
  const lines = text.split(/\r?\n/);
  const output = [];
  let index = 0;

  while (index < lines.length) {
    if (!isExpertLine(lines[index])) {
      output.push(lines[index]);
      index += 1;
      continue;
    }
    const end = expertBlockEnd(lines, index);
    output.push(...reorderExpertBlock(lines.slice(index, end)));
    index = end;
  }

  return output.join("\n");
}

export function countExpertsWithAvailability(text) {
  const lines = text.split(/\r?\n/);
  let experts = 0;
  let withAvailability = 0;

  for (let index = 0; index < lines.length; index += 1) {
    if (!isExpertLine(lines[index])) continue;
    experts += 1;
    const end = expertBlockEnd(lines, index);
    if (lines.slice(index + 1, end).some(isAvailabilityContent)) {
      withAvailability += 1;
    }
    index = end - 1;
  }

  return { experts, withAvailability };
}
