import {
  classifyProfileSections,
  isAvailabilityHeading,
  isExpertLine,
  normalizeCopiedText,
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

export const AVAILABILITY_SUMMARY_END = "[[BBK_AVAILABILITY_SUMMARY_END]]";

function isProjectLinksStartLine(line) {
  return /^(?:To\s+manage\s+this\s+project\b|Scheduler\s+Link\s*[:：]|Project\s+page\s*[:：]|Excel\s+download\s*[:：]|View\s+project\s+(?:online|in\s+Excel)\b)/i.test(
    line.trim(),
  );
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

function movableSectionIndexes(block, section) {
  if (section === "availability") return availabilityIndexes(block);
  if (section !== "intro") return new Set();

  const classifications = classifyProfileSections(block.join("\n"));
  const directContent = block
    .map((line, index) => {
      if (!line.trim() || /^Book\s*Now$/i.test(line.trim())) return -1;
      return classifications[index] === section ? index : -1;
    })
    .filter((index) => index >= 0);

  if (!directContent.length) return new Set();

  const indexes = new Set(directContent);
  const first = Math.min(...indexes);
  const last = Math.max(...indexes);
  for (let index = first; index <= last; index += 1) {
    if (!block[index].trim()) indexes.add(index);
  }
  return indexes;
}

function extractSectionFromExpertBlock(block, section, keepOriginal = false) {
  if (block.length < 2) return { summary: [], profile: block };
  const title = block[0];
  const tail = block.slice(1);
  const indexes = movableSectionIndexes(tail, section);
  if (!indexes.size) return { summary: [], profile: block };

  const selected = collapseBlankLines(trimBlankEdges(
    tail.filter((_, index) => indexes.has(index)),
  ));
  const profileTail = trimBlankEdges(tail.filter((_, index) => !indexes.has(index)));

  return {
    summary: [title, ...selected],
    profile: keepOriginal ? block : profileTail.length ? [title, ...profileTail] : [title],
  };
}

function expertBlockEnd(lines, start) {
  for (let index = start + 1; index < lines.length; index += 1) {
    if (isExpertLine(lines[index]) || isAngleTitleLine(lines, index)) return index;
  }
  return lines.length;
}

export function reorderAvailabilityLines(text, section = "availability", keepOriginal = false) {
  const lines = normalizeCopiedText(text).split(/\r?\n/);
  const projectLinksIndex = lines.findIndex(isProjectLinksStartLine);

  // If the copied email already contains a title + availability block above
  // its project links, leave that authored summary in place.
  const alreadyHasSummary = projectLinksIndex > 0 && lines
    .slice(0, projectLinksIndex)
    .some(isExpertLine);

  if (alreadyHasSummary) return text;

  if (projectLinksIndex >= 0) {
    const summaries = [];
    const profiles = [];
    let index = 0;

    while (index < lines.length) {
      if (!isExpertLine(lines[index])) {
        profiles.push(lines[index]);
        index += 1;
        continue;
      }
      const end = expertBlockEnd(lines, index);
      const extracted = extractSectionFromExpertBlock(
        lines.slice(index, end),
        section,
        keepOriginal && section === "availability",
      );
      if (extracted.summary.length) {
        if (summaries.length) summaries.push("");
        summaries.push(...extracted.summary);
      }
      profiles.push(...extracted.profile);
      index = end;
    }

    if (summaries.length) {
      const insertionIndex = profiles.findIndex(isProjectLinksStartLine);
      return [
        ...profiles.slice(0, insertionIndex),
        ...summaries,
        AVAILABILITY_SUMMARY_END,
        "",
        ...profiles.slice(insertionIndex),
      ].join("\n");
    }
  }

  // Without a project-link boundary there is nowhere to create an email-body
  // summary. Preserve the existing Availability fallback for older inputs.
  if (section !== "availability") return text;

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
  const lines = normalizeCopiedText(text).split(/\r?\n/);
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

export function buildAvailabilitySummary(text) {
  const allLines = normalizeCopiedText(text).split(/\r?\n/);
  const projectLinksIndex = allLines.findIndex(isProjectLinksStartLine);
  const lines = projectLinksIndex >= 0 ? allLines.slice(projectLinksIndex + 1) : allLines;
  const summary = [];
  let index = 0;
  let currentAngle = "";
  let angleIncluded = false;

  while (index < lines.length) {
    if (isAngleTitleLine(lines, index)) {
      currentAngle = lines[index].trim();
      angleIncluded = false;
      index += 1;
      continue;
    }
    if (!isExpertLine(lines[index])) {
      index += 1;
      continue;
    }
    const end = expertBlockEnd(lines, index);
    const block = lines.slice(index, end);
    const availability = block.slice(1).filter(isAvailabilityContent);
    if (availability.length) {
      if (summary.length) summary.push("");
      if (currentAngle && !angleIncluded) {
        summary.push(currentAngle);
        angleIncluded = true;
      }
      summary.push(block[0]);
      summary.push(...availability);
    }
    index = end;
  }

  return summary.join("\n");
}

export function buildTitleSummary(text) {
  const allLines = normalizeCopiedText(text).split(/\r?\n/);
  const projectLinksIndex = allLines.findIndex(isProjectLinksStartLine);
  const lines = projectLinksIndex >= 0 ? allLines.slice(projectLinksIndex + 1) : allLines;
  const summary = [];
  let currentAngle = "";
  let angleIncluded = false;

  for (let index = 0; index < lines.length; index += 1) {
    if (isAngleTitleLine(lines, index)) {
      currentAngle = lines[index].trim();
      angleIncluded = false;
      continue;
    }
    if (!isExpertLine(lines[index])) continue;

    if (summary.length) summary.push("");
    if (currentAngle && !angleIncluded) {
      summary.push(currentAngle);
      angleIncluded = true;
    }
    summary.push(`•${lines[index].trim().replace(/^[-•]\s*/, "")}`);
  }

  return summary.join("\n");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function renderTitleSummaryHtml(text, style = "simple") {
  const lines = normalizeCopiedText(text).split(/\r?\n/);
  const groups = [];
  let currentGroup = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;

    if (isAngleTitleLine(lines, index)) {
      currentGroup = { angle: line, titles: [] };
      groups.push(currentGroup);
      continue;
    }

    if (!isExpertLine(line)) continue;
    if (!currentGroup) {
      currentGroup = { angle: "", titles: [] };
      groups.push(currentGroup);
    }
    currentGroup.titles.push(line.replace(/^[-•]\s*/, ""));
  }

  if (!groups.length) return "";

  const markerStyle = style === "highlight"
    ? "background-color:#fff0a8;padding:1px 2px;font-weight:700;box-decoration-break:clone;-webkit-box-decoration-break:clone"
    : "font-weight:600";
  const groupHtml = groups
    .filter((group) => group.titles.length)
    .map((group, groupIndex) => {
      const angle = group.angle
        ? `<div style="margin:0 0 5px;padding:${groupIndex ? "10px" : "0"} 0 5px;border-bottom:1px solid #e5e5ea;color:#1d1d1f;font-size:13px;font-weight:700">${escapeHtml(group.angle)}</div>`
        : "";
      const titles = group.titles.map((title) => (
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0">` +
        `<tr><td style="width:14px;padding:4px 0;vertical-align:top;color:#1d1d1f">•</td>` +
        `<td style="padding:4px 0;vertical-align:top;color:#1d1d1f"><span style="${markerStyle}">${escapeHtml(title)}</span></td></tr></table>`
      )).join("");
      return `${angle}${titles}`;
    })
    .join("");

  return groupHtml
    ? `<div style="font-family:Arial,'Noto Sans JP','Noto Sans KR',sans-serif;font-size:12px;line-height:1.45;color:#1d1d1f">${groupHtml}</div>`
    : "";
}
