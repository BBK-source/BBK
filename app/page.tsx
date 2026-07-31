"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ClipboardEvent } from "react";
import {
  emphasizeCompanyNamesText,
  emphasizeCompaniesText,
  emphasizeQaText,
} from "./emphasis.js";
import {
  ANSWER_PREFIX_RE,
  ARROW_ANSWER_RE,
  QUESTION_PREFIX_RE,
  isAvailabilityHeading,
  isEmploymentHeading,
  isQuestionStart,
  isScreenedHeading,
} from "./structure.js";
import { applyIntroTreatment } from "./intro-treatment.js";
import {
  emphasizeAvailabilityTimes,
  isAvailabilityLine,
  isUnavailableAvailabilityLine,
} from "./availability.js";

type StyleId = "smart" | "classic" | "list" | "qa" | "minimal";
type Lang = "zh" | "ja" | "en";
type PaletteId = "tb" | "ocean" | "forest" | "plum" | "amber" | "slate";
type EmphasisVariantId = "color" | "marker" | "colorMarker" | "strong" | "underline";
type IntroTreatmentId = "none" | "color" | "bold" | "marker";
type Appearance = { palette: PaletteId; emphasisVariant: EmphasisVariantId };
type FormatOptions = {
  introTreatment: IntroTreatmentId;
  entityHighlights: boolean;
  expertCards: boolean;
  angleGroups: boolean;
  fullProfileCards: boolean;
  blackAngleTitles: boolean;
  emphasisVariant: EmphasisVariantId;
};
type RichLink = { label: string; href: string };

const STYLE_IDS: StyleId[] = ["smart", "classic", "list", "qa", "minimal"];
const VISIBLE_STYLE_IDS: StyleId[] = ["smart", "list", "qa"];
const LANGUAGE_STORAGE_KEY = "bbk-bunken-language";
const ENTITY_HIGHLIGHT_STORAGE_KEY = "bbk-bunken-entity-highlights";
const EXPERT_LINE_RE = /^(?:[-•]\s*)?(?:#(?:[A-Z][A-Z0-9]*|\d+)(?:[.-]\d+)*|[A-Z][A-Z0-9]*(?:[.-]\d+)+)\s*[-–]/i;
const EXPERT_ID_RE = /^(?:[-•]\s*)?((?:#(?:[A-Z][A-Z0-9]*|\d+)(?:[.-]\d+)*|[A-Z][A-Z0-9]*(?:[.-]\d+)+))/i;
const QUESTION_END_RE = /[?？]\s*$/;

const PALETTES: Record<PaletteId, { accent: string; key: string; soft: string; border: string }> = {
  tb: { accent: "#5f89a5", key: "#e83b2e", soft: "#fff2bf", border: "#cfd8de" },
  ocean: { accent: "#287c91", key: "#1769aa", soft: "#e2f5f7", border: "#b8d6dc" },
  forest: { accent: "#47745a", key: "#b54b38", soft: "#eef3d6", border: "#c5d3c9" },
  plum: { accent: "#7b5b8e", key: "#b84562", soft: "#f5e8f0", border: "#d8c8df" },
  amber: { accent: "#9a6a22", key: "#c34f32", soft: "#fff0d0", border: "#dfc99f" },
  slate: { accent: "#526b78", key: "#263f50", soft: "#e9eef1", border: "#c8d1d6" },
};
const EMPHASIS_VARIANTS: EmphasisVariantId[] = ["color", "marker", "colorMarker", "strong", "underline"];
const INTRO_TREATMENTS: IntroTreatmentId[] = ["none", "color", "bold", "marker"];

const UI = {
  zh: {
    headerHint: "粘贴文字，自动排版，一键复制到 Gmail",
    title: "邮件不用再一段段改格式了。",
    subtitle: "自动识别专家标题、重点经历、Q&A 和日期，并随机生成专业版式与配色。",
    paste: "粘贴", format: "自动排版", copyStep: "复制到 Gmail",
    source: "粘贴原文", clear: "清空", placeholder: "在这里粘贴准备发送的邮件内容…",
    tip: "这是富文本输入框：从原系统直接粘贴，会保留链接、表格和原有框线，再继续复制到 Gmail。",
    result: "自动排版结果", current: "当前", formatMode: "排版", random: "换个配色", changed: "已更换",
    copied: "已复制，可粘贴到 Gmail", copy: "复制富文本格式",
    foot1: "版式与结构保持不变；随机按钮只改变重点颜色、荧光笔和粗体效果。",
    foot2: "所有内容只在当前浏览器中处理，不会上传。",
    styles: ["自动排版", "重点卡片", "专家名单", "Q&A", "极简"],
    notes: ["按内容自动选择完整结构", "整份专家资料以重点卡片呈现", "同一 Angle 下压缩成名单", "问题与回答使用分层色块", "去掉彩色强调与外框"],
    palettes: ["TB 经典", "海洋蓝", "森林绿", "梅紫", "暖琥珀", "商务灰"],
    emphasisStyles: ["彩色粗体", "荧光笔", "彩色荧光", "黑色重粗", "彩色下划线"],
    options: "简易设置", introLabel: "介绍文", introTreatments: ["无", "标色", "加粗", "荧光"], entityHighlight: "自动标记公司／职位",
    previous: "上一个", next: "下一个",
    linksKept: "已保留链接",
  },
  ja: {
    headerHint: "文章を貼り付けて、自動整形し、Gmailへコピー",
    title: "メールの書式調整を、もっと手軽に。",
    subtitle: "エキスパート名、重要経歴、Q&A、日付を自動判別し、プロ向けのレイアウトと配色を生成します。",
    paste: "貼り付け", format: "自動整形", copyStep: "Gmailへコピー",
    source: "原文を貼り付け", clear: "クリア", placeholder: "送信予定のメール本文を貼り付けてください…",
    tip: "リッチテキスト入力欄です。元のシステムから直接貼り付けると、リンク・表・元の枠線を保持したままGmailへコピーできます。",
    result: "自動整形結果", current: "現在", formatMode: "レイアウト", random: "配色を変更", changed: "変更済み",
    copied: "コピー済み・Gmailへ貼り付け可能", copy: "リッチテキストをコピー",
    foot1: "レイアウトと構成はそのまま、ランダムボタンでは強調色・マーカー・太字だけが変わります。",
    foot2: "内容はブラウザ内のみで処理され、アップロードされません。",
    styles: ["自動", "重点カード", "専門家リスト", "Q&A", "シンプル"],
    notes: ["内容に合わせて構成も自動選択", "一名ずつ全体を重点カードで表示", "同じAngle内をコンパクトな一覧に整理", "質問と回答を色付きカードで分ける", "色の強調と外枠を省いた簡潔表示"],
    palettes: ["TBクラシック", "オーシャン", "フォレスト", "プラム", "アンバー", "ビジネスグレー"],
    emphasisStyles: ["カラー太字", "マーカー", "カラー＋マーカー", "黒の太字", "カラー下線"],
    options: "簡単設定", introLabel: "紹介文", introTreatments: ["なし", "カラー", "太字", "マーカー"], entityHighlight: "会社・役職を自動強調",
    previous: "前へ", next: "次へ",
    linksKept: "リンクを保持",
  },
  en: {
    headerHint: "Paste, format automatically, and copy to Gmail",
    title: "Format emails without the repetitive work.",
    subtitle: "Automatically detects expert headings, key experience, Q&A and dates, then applies a professional layout and color palette.",
    paste: "Paste", format: "Auto-format", copyStep: "Copy to Gmail",
    source: "Paste source text", clear: "Clear", placeholder: "Paste the email content you want to send…",
    tip: "This is a rich-text input. Paste directly from the source system to keep links, tables, and original borders through to Gmail.",
    result: "Formatted result", current: "Current", formatMode: "Layout", random: "Try another color", changed: "Changed",
    copied: "Copied and ready for Gmail", copy: "Copy rich text",
    foot1: "Layout and structure stay fixed; randomization changes only emphasis color, marker and bold treatment.",
    foot2: "Everything is processed locally in this browser and is not uploaded.",
    styles: ["Auto", "Feature card", "Expert list", "Q&A", "Simple"],
    notes: ["Automatically selects both structure and styling", "Frames each full expert profile as a feature card", "Compresses experts under each angle into a list", "Separates questions and answers into colored cards", "Removes colored emphasis and outer frames"],
    palettes: ["TB classic", "Ocean", "Forest", "Plum", "Amber", "Business gray"],
    emphasisStyles: ["Color bold", "Highlighter", "Color + highlight", "Strong black", "Color underline"],
    options: "Simple settings", introLabel: "Introduction", introTreatments: ["None", "Color", "Bold", "Highlight"], entityHighlight: "Auto-highlight companies & roles",
    previous: "Previous", next: "Next",
    linksKept: "links preserved",
  },
} as const;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function safeLink(value?: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return escapeHtml(url.toString()).replaceAll('"', "&quot;");
  } catch {
    return "";
  }
}

function renderBookNow(url: string | undefined, palette: PaletteId) {
  const href = safeLink(url);
  const css = `color:${PALETTES[palette].accent};font-weight:700;text-decoration:underline;white-space:nowrap`;
  return href
    ? `<a href="${href}" target="_blank" rel="noopener noreferrer" style="${css}">Book Now</a>`
    : `<span style="${css}">Book Now</span>`;
}

function renderInlineLink(link: RichLink, palette: PaletteId) {
  const href = safeLink(link.href);
  const label = escapeHtml(link.label);
  if (!href) return label;
  return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:${PALETTES[palette].accent};font-weight:700;text-decoration:underline">${label}</a>`;
}

function applyLineLinks(html: string, links: RichLink[], palette: PaletteId) {
  let output = html;
  for (const link of links) {
    const label = escapeHtml(link.label);
    output = output.replace(label, renderInlineLink(link, palette));
  }
  return output;
}

function sanitizePastedContent(clipboardHtml: string) {
  const documentFromClipboard = new DOMParser().parseFromString(clipboardHtml, "text/html");
  const passthroughTags = new Set([
    "DIV", "P", "SPAN", "B", "STRONG", "I", "EM", "U", "S",
    "TABLE", "THEAD", "TBODY", "TFOOT", "TR", "TD", "TH",
    "UL", "OL", "LI", "H1", "H2", "H3", "H4", "H5", "H6",
  ]);
  const blockFallbackTags = new Set(["SECTION", "ARTICLE", "HEADER", "FOOTER"]);
  const safeStyleProperties = [
    "color", "background-color", "font-weight", "font-style", "text-decoration",
    "border", "border-top", "border-right", "border-bottom", "border-left",
    "border-width", "border-style", "border-color", "border-radius",
    "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
    "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
    "text-align", "vertical-align", "width", "max-width", "min-width",
    "border-collapse", "border-spacing", "line-height", "white-space",
  ];

  function sanitizedStyle(element: HTMLElement) {
    const declarations: string[] = [];
    safeStyleProperties.forEach((property) => {
      const value = element.style.getPropertyValue(property).trim();
      if (!value || /(?:url|expression|javascript|@import)\s*\(/i.test(value)) return;
      declarations.push(`${property}:${value}`);
    });
    return declarations.join(";");
  }

  function safeTableAttributes(element: HTMLElement) {
    const attributes: string[] = [];
    if (element.tagName === "TABLE") {
      const width = element.getAttribute("width");
      const border = element.getAttribute("border");
      const cellpadding = element.getAttribute("cellpadding");
      const cellspacing = element.getAttribute("cellspacing");
      if (width && /^(?:\d+(?:\.\d+)?%?|\d+(?:\.\d+)?px)$/i.test(width.trim())) {
        attributes.push(`width="${escapeHtml(width.trim())}"`);
      }
      if (border && /^\d+$/.test(border.trim())) attributes.push(`border="${border.trim()}"`);
      if (cellpadding && /^\d+$/.test(cellpadding.trim())) attributes.push(`cellpadding="${cellpadding.trim()}"`);
      if (cellspacing && /^\d+$/.test(cellspacing.trim())) attributes.push(`cellspacing="${cellspacing.trim()}"`);
    }
    if (["TD", "TH"].includes(element.tagName)) {
      const colspan = element.getAttribute("colspan");
      const rowspan = element.getAttribute("rowspan");
      if (colspan && /^\d+$/.test(colspan.trim())) attributes.push(`colspan="${colspan.trim()}"`);
      if (rowspan && /^\d+$/.test(rowspan.trim())) attributes.push(`rowspan="${rowspan.trim()}"`);
    }
    return attributes.join(" ");
  }

  function isExpertContainer(element: HTMLElement) {
    if (!["DIV", "P", "LI", "TR"].includes(element.tagName)) return false;
    if (!EXPERT_LINE_RE.test((element.textContent ?? "").trim())) return false;
    return !Array.from(element.children).some((child) => (
      ["DIV", "P", "LI", "TR"].includes(child.tagName)
      && EXPERT_LINE_RE.test((child.textContent ?? "").trim())
    ));
  }

  function renderNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent ?? "");
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const element = node as HTMLElement;
    const tag = element.tagName;
    if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "FORM", "INPUT", "BUTTON"].includes(tag)) return "";
    if (tag === "BR") return "<br>";
    const children = Array.from(element.childNodes).map(renderNode).join("");
    if (tag === "A") {
      const href = safeLink(element.getAttribute("href") ?? "");
      const style = sanitizedStyle(element);
      return href
        ? `<a href="${href}" target="_blank" rel="noopener noreferrer"${style ? ` style="${style}"` : ""}>${children || escapeHtml(element.textContent ?? "")}</a>`
        : children;
    }
    if (passthroughTags.has(tag)) {
      const style = sanitizedStyle(element);
      const attributes = safeTableAttributes(element);
      const expertClass = isExpertContainer(element) ? 'class="sourceExpertFrame"' : "";
      const attributeText = [attributes, expertClass, style ? `style="${style}"` : ""].filter(Boolean).join(" ");
      return `<${tag.toLowerCase()}${attributeText ? ` ${attributeText}` : ""}>${children}</${tag.toLowerCase()}>`;
    }
    return blockFallbackTags.has(tag) ? `<div>${children}</div>` : children;
  }

  return Array.from(documentFromClipboard.body.childNodes)
    .map(renderNode)
    .join("")
    .replace(/(?:<br>\s*){4,}/g, "<br><br>");
}

function emphasisDecoration(palette: PaletteId, variant: EmphasisVariantId) {
  const colors = PALETTES[palette];
  if (variant === "marker") {
    return { color: "#25313a", background: colors.soft, weight: 700 };
  }
  if (variant === "colorMarker") {
    return { color: colors.key, background: colors.soft, weight: 700 };
  }
  if (variant === "strong") {
    return { color: "#171717", weight: 800 };
  }
  if (variant === "underline") {
    return { color: colors.accent, weight: 700, underline: true };
  }
  return { color: colors.key, weight: 700 };
}

function emphasizeCompanies(text: string, style: StyleId, palette: PaletteId, enabled = true, variant: EmphasisVariantId = "color") {
  if (style === "minimal") return text;
  return emphasizeCompaniesText(text, PALETTES[palette].key, enabled, emphasisDecoration(palette, variant));
}

function emphasizeExpertTitleCompanies(text: string, style: StyleId, palette: PaletteId, enabled = true, variant: EmphasisVariantId = "color") {
  if (style === "minimal") return text;
  return emphasizeCompanyNamesText(text, PALETTES[palette].key, enabled, emphasisDecoration(palette, variant));
}

function emphasizeQa(text: string, style: StyleId, palette: PaletteId, includeEntities: boolean, variant: EmphasisVariantId) {
  if (style === "minimal") return text;
  return emphasizeQaText(text, PALETTES[palette].key, includeEntities, emphasisDecoration(palette, variant));
}

function formatIntroduction(
  text: string,
  palette: PaletteId,
  treatment: IntroTreatmentId,
  entityHighlights: boolean,
  style: StyleId,
  emphasisVariant: EmphasisVariantId,
) {
  const base = treatment === "none"
    ? emphasizeCompanies(text, style, palette, entityHighlights, emphasisVariant)
    : text;
  return applyIntroTreatment(base, PALETTES[palette], treatment);
}

function detectStyle(text: string): StyleId {
  const lines = text.split(/\r?\n/);
  const expertLines = lines.filter((line) => EXPERT_LINE_RE.test(line.trim())).length;
  const questions = lines.filter((line, index) => {
    const trimmed = line.trim();
    if (QUESTION_PREFIX_RE.test(trimmed)) return true;
    if (!QUESTION_END_RE.test(trimmed)) return false;
    const nextNonBlank = lines.slice(index + 1).find((candidate) => candidate.trim())?.trim() ?? "";
    return ANSWER_PREFIX_RE.test(nextNonBlank) || ARROW_ANSWER_RE.test(nextNonBlank);
  }).length;
  const answers = lines.filter((line) => {
    const trimmed = line.trim();
    return ANSWER_PREFIX_RE.test(trimmed) || ARROW_ANSWER_RE.test(trimmed);
  }).length;
  if (expertLines >= 3) return "list";
  if (questions >= 2 || (questions >= 1 && answers >= 1)) return "qa";
  if (text.length < 700) return "minimal";
  return "classic";
}

type ProfileSection = "body" | "qa" | "employment" | "availability" | "meta";
type QaRole = "question" | "answer" | null;

function formatLine(
  line: string,
  style: StyleId,
  palette: PaletteId,
  section: ProfileSection,
  options: FormatOptions,
  expertCount: number,
  qaRole: QaRole = null,
  qaStart = false,
  compactExpert = false,
  bookNowUrl?: string,
  lineLinks: RichLink[] = [],
  qaEnd = false,
) {
  const raw = line.trim();
  const safe = applyLineLinks(escapeHtml(line), lineLinks, palette);
  const colors = PALETTES[palette];
  const accent = style === "minimal" ? "#596773" : colors.accent;
  const keyColor = style === "minimal" ? "#26343d" : colors.key;
  if (!safe.trim()) return `<div style="height:4px;line-height:4px"><br></div>`;
  if (EXPERT_LINE_RE.test(safe)) {
    const idMatch = safe.match(EXPERT_ID_RE);
    const id = idMatch?.[0] ?? "";
    const rest = safe.slice(id.length);
    const useCard = options.expertCards && expertCount > 1 && !compactExpert;
    const listCss = compactExpert
      ? style === "classic"
        ? `line-height:1.4;font-weight:700;padding:5px 7px 5px 21px;position:relative;background:${colors.soft};border-left:3px solid ${colors.accent}`
        : style === "qa"
          ? `line-height:1.4;font-weight:700;padding:5px 7px 5px 21px;position:relative;border:1px solid ${colors.border};background:#fff`
          : style === "minimal"
            ? `line-height:1.4;font-weight:700;padding:4px 3px 5px 18px;position:relative;border-bottom:1px solid ${colors.border}`
            : "line-height:1.38;font-weight:700;padding:4px 6px 4px 20px;position:relative"
      : style === "classic"
        ? `line-height:1.42;font-weight:700;margin:3px 0 6px;padding:6px 8px 6px 22px;background:${colors.soft};border-left:3px solid ${colors.accent};position:relative`
        : style === "qa"
          ? `line-height:1.42;font-weight:700;margin:3px 0 6px;padding:6px 8px 6px 22px;border:1px solid ${colors.border};background:#fff;position:relative`
          : style === "minimal"
            ? `line-height:1.42;font-weight:700;margin:2px 0 5px;padding:4px 3px 5px 19px;border-bottom:1px solid ${colors.border};position:relative`
            : style === "list" || useCard
              ? `line-height:1.38;font-weight:700;margin:2px 0;padding:4px 6px 4px 20px;border:1px dotted ${colors.border};position:relative`
              : "line-height:1.42;font-weight:700;margin:2px 0 5px";
    const bullet = style === "list" || style === "classic" || style === "qa" || style === "minimal" || useCard || compactExpert
      ? `<span style="position:absolute;left:${compactExpert ? "6px" : "7px"};color:#151515">•</span>`
      : "";
    const expertRest = style === "minimal"
      ? rest
      : emphasizeExpertTitleCompanies(rest, style, palette, options.entityHighlights, options.emphasisVariant);
    return `<div style="${listCss}">${bullet}<span style="color:${accent}">${id.replace(/^[-•]\s*/, "")}</span>${expertRest}</div>`;
  }
  if (/^(Customers?|CUSTOMERS?)[-:| ｜]/i.test(safe)) {
    const css = style === "list"
      ? `font-weight:800;margin:8px 0 0;padding:4px 6px;background:${colors.soft};border-left:3px solid ${colors.accent}`
      : style === "classic"
        ? `font-weight:800;margin:8px 0 4px;padding:3px 0 4px;border-bottom:2px solid ${colors.accent}`
        : style === "qa"
          ? `font-weight:800;margin:8px 0 4px;padding:4px 6px;border:1px solid ${colors.border};background:${colors.soft}`
          : style === "minimal"
            ? `font-weight:800;margin:8px 0 4px;padding:2px 0 4px;border-bottom:1px solid #9aa5ad`
            : "font-weight:800;text-decoration:underline;margin:8px 0 4px";
    return `<div style="${css}">${safe}</div>`;
  }
  if (isScreenedHeading(raw)) {
    const bg = style === "qa" || style === "classic" ? colors.soft : "transparent";
    const screenedCss = style === "qa"
      ? `font-weight:800;margin-top:9px;padding:5px 7px;background:${bg};border:1px solid ${colors.border}`
      : style === "classic"
        ? `font-weight:800;margin-top:10px;padding:5px 7px;background:${bg};border-top:2px solid ${colors.accent}`
        : style === "list"
          ? `font-weight:800;margin-top:8px;padding:4px 2px;border-top:1px dashed ${colors.border}`
          : `font-weight:800;margin-top:9px;padding:5px 0 3px;border-top:1px solid #9aa5ad`;
    return `<div style="${screenedCss}">${safe}</div>`;
  }
  if (qaRole === "question") {
    const labelMatch = raw.match(QUESTION_PREFIX_RE);
    const label = labelMatch ? escapeHtml(labelMatch[0].trimEnd()) : "";
    const rawBody = applyLineLinks(
      escapeHtml(labelMatch ? raw.slice(labelMatch[0].length) : raw),
      lineLinks,
      palette,
    );
    const body = emphasizeCompanies(rawBody, style, palette, options.entityHighlights, options.emphasisVariant);
    const bg = style === "qa" ? colors.soft : style === "list" ? "#f6f8f9" : "transparent";
    const margin = qaStart ? (style === "qa" ? "margin-top:7px;" : "margin-top:4px;") : "";
    const padding = style === "qa" ? (qaStart ? "5px 6px" : "1px 6px 4px") : style === "list" ? "3px 5px" : "2px 5px";
    const border = style === "minimal" ? "#9aa5ad" : colors.accent;
    const extra = style === "qa"
      ? `${qaStart ? `border-top:1px solid ${colors.border};` : ""}border-right:1px solid ${colors.border}`
      : "";
    return `<div style="line-height:1.42;background:${bg};${margin}padding:${padding};border-left:${style === "minimal" ? "2px" : "3px"} solid ${border};${extra}">${label ? `<b>${label}</b> ` : ""}${body}</div>`;
  }
  if (qaRole === "answer") {
    const prefixMatch = raw.match(ANSWER_PREFIX_RE) ?? raw.match(ARROW_ANSWER_RE);
    const prefix = prefixMatch ? escapeHtml(prefixMatch[0].trimEnd()) : "";
    const body = applyLineLinks(
      escapeHtml(prefixMatch ? raw.slice(prefixMatch[0].length) : raw),
      lineLinks,
      palette,
    );
    const weight = style === "qa" || style === "minimal" ? "400" : style === "list" ? "600" : "700";
    const bg = style === "qa" ? colors.soft : "transparent";
    const onlyLabel = Boolean(prefixMatch && !body);
    const padding = style === "qa"
      ? onlyLabel ? "5px 6px 0" : qaStart ? "5px 6px" : "1px 6px 4px"
      : onlyLabel ? "4px 5px 0" : qaStart ? "3px 5px" : "1px 5px 3px";
    const extra = style === "qa"
      ? `border-left:3px solid ${colors.accent};border-right:1px solid ${colors.border};${qaEnd ? `border-bottom:1px solid ${colors.border};` : ""}`
      : "";
    const answerBody = emphasizeQa(body, style, palette, options.entityHighlights, options.emphasisVariant);
    return `<div style="color:${keyColor};font-weight:${onlyLabel ? "700" : weight};line-height:1.45;background:${bg};padding:${padding};${extra}">${prefix ? `<b>${prefix}</b>${body ? " " : ""}` : ""}${answerBody}</div>`;
  }
  if (isEmploymentHeading(raw) || isAvailabilityHeading(raw)) {
    const bg = style === "qa" ? colors.soft : "transparent";
    return `<div style="font-weight:800;margin-top:11px;padding:${style === "qa" ? "5px 6px" : "5px 0 3px"};border-bottom:1px solid ${colors.border};color:${accent};background:${bg}">${safe}</div>`;
  }
  if (section === "employment" && /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\b/i.test(safe)) {
    return `<div style="font-weight:700;line-height:1.42;margin-top:3px">${safe}</div>`;
  }
  if (section === "employment" && /\s+-\s+/.test(safe)) {
    return `<div style="line-height:1.42;padding:1px 0 3px;border-bottom:1px dotted ${colors.border}">${emphasizeCompanies(safe, style, palette, options.entityHighlights, options.emphasisVariant)}</div>`;
  }
  if (section === "availability" && /^Time Zone\s*:/i.test(safe)) {
    return `<div style="font-weight:700;line-height:1.42;padding:4px 0;color:${accent}">${safe}</div>`;
  }
  if (isAvailabilityLine(raw)) {
    return `<div style="line-height:1.42;padding:2px 5px;border-left:3px solid ${colors.border}">${emphasizeAvailabilityTimes(safe)}</div>`;
  }
  if (isUnavailableAvailabilityLine(raw)) {
    return `<div style="line-height:1.42;padding:2px 5px;color:#68727a">${safe}</div>`;
  }
  if (/^Book Now$/i.test(safe)) {
    return `<div style="margin:4px 0">${renderBookNow(bookNowUrl, palette)}</div>`;
  }
  if (/^This specialist is based in\b/i.test(safe)) {
    return `<div style="line-height:1.42;color:#68727a">${safe}</div>`;
  }
  if (/^Hourly Fee\s*:/i.test(safe)) {
    return `<div style="line-height:1.42;font-weight:700;color:${keyColor}">${safe}</div>`;
  }
  if (/^[-•]\s*Current/i.test(safe)) {
    const bg = style === "minimal" ? "transparent" : colors.soft;
    return `<div style="background:${bg};padding:1px 3px;line-height:1.4">${emphasizeCompanies(safe, style, palette, options.entityHighlights, options.emphasisVariant)}</div>`;
  }
  if (/^\d{1,2}月\d{1,2}日|^\d{1,2}\/\d{1,2}|^\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(safe)) {
    return `<div style="font-weight:600;line-height:1.42">${safe}</div>`;
  }
  const body = section === "body"
    ? formatIntroduction(safe, palette, options.introTreatment, options.entityHighlights, style, options.emphasisVariant)
    : style === "minimal"
      ? safe
      : emphasizeCompanies(safe, style, palette, options.entityHighlights, options.emphasisVariant);
  const bodyCss = style === "classic"
    ? "line-height:1.5"
    : style === "list"
      ? "line-height:1.38;color:#3b4650"
      : style === "minimal"
        ? "line-height:1.45;color:#33404a"
        : "line-height:1.48";
  return `<div style="${bodyCss}">${body}</div>`;
}

function formatText(
  text: string,
  requestedStyle: StyleId,
  palette: PaletteId,
  options: FormatOptions,
  richLinks: RichLink[],
) {
  const style = requestedStyle === "smart" ? detectStyle(text) : requestedStyle;
  const lines = text.split(/\r?\n/);
  const expertCount = lines.filter((line) => EXPERT_LINE_RE.test(line.trim())).length;
  let section: ProfileSection = "body";
  let qaFlow: QaRole = null;
  let groupOpen = false;
  let groupMode: "list" | "profile" | null = null;
  let groupHasExpert = false;
  let previousLineWasBlank = false;
  const skippedLines = new Set<number>();
  const usedLinks = new Set<number>();
  const parts: string[] = [];

  function nextNonBlankIndexFrom(index: number) {
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      if (lines[cursor].trim()) return cursor;
    }
    return -1;
  }

  function isAngleTitleAt(index: number) {
    const candidate = lines[index]?.trim() ?? "";
    const nextIndex = nextNonBlankIndexFrom(index);
    return /[:：]\s*$/.test(candidate)
      && nextIndex >= 0
      && EXPERT_LINE_RE.test(lines[nextIndex].trim());
  }

  function closeGroup() {
    if (!groupOpen) return;
    parts.push("</div>");
    groupOpen = false;
    groupMode = null;
    groupHasExpert = false;
  }

  function openGroup(mode: "list" | "profile", title?: string) {
    const borderWidth = mode === "profile" && style !== "minimal" ? "2px" : "1px";
    const groupBorder = style === "classic"
      ? PALETTES[palette].accent
      : style === "minimal"
        ? "#9aa5ad"
        : PALETTES[palette].border;
    const groupBackground = style === "list" ? "#fbfcfd" : "#ffffff";
    parts.push(
      `<div style="box-sizing:border-box;border:${borderWidth} solid ${groupBorder};border-radius:${style === "minimal" ? "0" : "5px"};margin:${mode === "profile" ? "6px 0" : "4px 0"};padding:${mode === "profile" ? "7px 9px" : "4px 6px"};background:${groupBackground}">`,
    );
    if (title) {
      const titleColor = options.blackAngleTitles ? "#171717" : PALETTES[palette].accent;
      parts.push(
        `<div style="font-weight:800;color:${titleColor};padding:1px 1px 3px;border-bottom:1px solid ${PALETTES[palette].border}">${escapeHtml(title)}</div>`,
      );
    }
    groupOpen = true;
    groupMode = mode;
    groupHasExpert = false;
  }

  function consumeNextBookNow() {
    const index = richLinks.findIndex((link, linkIndex) => (
      !usedLinks.has(linkIndex) && /^Book\s*Now$/i.test(link.label)
    ));
    if (index < 0) return undefined;
    usedLinks.add(index);
    return richLinks[index].href;
  }

  function consumeLinksForLine(rawLine: string) {
    let searchable = rawLine.replace(/\s+/g, " ");
    const matches: RichLink[] = [];
    richLinks.forEach((link, linkIndex) => {
      if (usedLinks.has(linkIndex)) return;
      const label = link.label.replace(/\s+/g, " ").trim();
      if (!label) return;
      const position = searchable.indexOf(label);
      if (position < 0) return;
      usedLinks.add(linkIndex);
      matches.push(link);
      searchable = `${searchable.slice(0, position)}${" ".repeat(label.length)}${searchable.slice(position + label.length)}`;
    });
    return matches;
  }

  for (let index = 0; index < lines.length; index += 1) {
    if (skippedLines.has(index)) continue;
    const line = lines[index];
    const trimmed = line.trim();
    const nextNonBlankIndex = nextNonBlankIndexFrom(index);
    const nextNonBlank = nextNonBlankIndex >= 0 ? lines[nextNonBlankIndex].trim() : "";
    const isAngleTitle = isAngleTitleAt(index);
    const isExpertLine = EXPERT_LINE_RE.test(trimmed);

    if (!trimmed) {
      if (previousLineWasBlank) continue;
      previousLineWasBlank = true;
    } else {
      previousLineWasBlank = false;
    }

    if (isExpertLine) {
      section = "body";
      qaFlow = null;
    }

    if (options.angleGroups && isAngleTitle) {
      closeGroup();
      let nextAngleIndex = lines.length;
      for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        if (isAngleTitleAt(cursor)) {
          nextAngleIndex = cursor;
          break;
        }
      }
      const expertsInAngle = lines
        .slice(index + 1, nextAngleIndex)
        .filter((candidate) => EXPERT_LINE_RE.test(candidate.trim()))
        .length;
      const angleLines = lines.slice(index + 1, nextAngleIndex);
      const expertOffsets = angleLines
        .map((candidate, offset) => EXPERT_LINE_RE.test(candidate.trim()) ? offset : -1)
        .filter((offset) => offset >= 0);
      const firstExpertOffset = expertOffsets[0] ?? -1;
      const secondExpertOffset = expertOffsets[1] ?? angleLines.length;
      const firstExpertHasProfileBody = firstExpertOffset >= 0 && angleLines
        .slice(firstExpertOffset + 1, secondExpertOffset)
        .some((candidate) => {
          const value = candidate.trim();
          return Boolean(value) && !/^Book Now$/i.test(value);
        });
      const mode = options.fullProfileCards && (expertsInAngle === 1 || firstExpertHasProfileBody)
        ? "profile"
        : "list";
      openGroup(mode, line);
      continue;
    }

    if (groupMode === "profile" && isExpertLine && groupHasExpert) {
      closeGroup();
      openGroup("profile");
    }

    if (!groupOpen && options.fullProfileCards && isExpertLine) {
      openGroup("profile");
    }

    if (
      groupMode === "list"
      && trimmed
      && !isExpertLine
      && !/^Book Now$/i.test(trimmed)
    ) {
      closeGroup();
    }

    if (!trimmed && groupMode === "list") {
      continue;
    }

    if (groupOpen && isExpertLine) {
      const inlineBookNow = /\s+Book Now\s*$/i.test(trimmed);
      const followingBookNow = /^Book Now$/i.test(nextNonBlank);
      const expertLine = inlineBookNow ? line.replace(/\s+Book Now\s*$/i, "") : line;
      let bookNowUrl: string | undefined;

      if (inlineBookNow || followingBookNow) {
        bookNowUrl = consumeNextBookNow();
      }
      if (followingBookNow && nextNonBlankIndex >= 0) {
        skippedLines.add(nextNonBlankIndex);
      }
      const expertLinks = consumeLinksForLine(expertLine);

      const expertHtml = formatLine(
        expertLine,
        style,
        palette,
        section,
        options,
        expertCount,
        null,
        false,
        true,
        undefined,
        expertLinks,
      );
      const expertRowStyle = options.expertCards
        ? `width:100%;border-collapse:collapse;border:1px dotted ${PALETTES[palette].border};margin:5px 0`
        : `width:100%;border-collapse:collapse;border-bottom:1px dotted ${PALETTES[palette].border}`;
      parts.push(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${expertRowStyle}"><tr>` +
        `<td style="padding:0;vertical-align:middle">${expertHtml}</td>` +
        (inlineBookNow || followingBookNow
          ? `<td style="width:1%;padding:4px 5px 4px 9px;vertical-align:middle;text-align:right">${renderBookNow(bookNowUrl, palette)}</td>`
          : "") +
        "</tr></table>",
      );
      groupHasExpert = true;
      continue;
    }

    if (isScreenedHeading(trimmed)) {
      section = "qa";
      qaFlow = null;
    }
    if (isEmploymentHeading(trimmed)) {
      section = "employment";
      qaFlow = null;
    }
    if (isAvailabilityHeading(trimmed)) {
      section = "availability";
      qaFlow = null;
    }
    if (isAvailabilityLine(trimmed) || isUnavailableAvailabilityLine(trimmed)) {
      section = "availability";
      qaFlow = null;
    }
    if (/^Book Now$/i.test(trimmed)) {
      section = "meta";
      qaFlow = null;
    }

    const explicitQuestion = isQuestionStart(trimmed, nextNonBlank);
    const explicitAnswer = ANSWER_PREFIX_RE.test(trimmed);
    const arrowAnswer = ARROW_ANSWER_RE.test(trimmed);
    let qaRole: QaRole = null;
    let qaStart = false;

    if (!trimmed) {
      const answerFollows =
        ANSWER_PREFIX_RE.test(nextNonBlank) || ARROW_ANSWER_RE.test(nextNonBlank);
      if (qaFlow === "question" && !answerFollows) {
        qaFlow = null;
      }
      if (qaFlow) {
        continue;
      }
    } else if (explicitQuestion) {
      section = "qa";
      qaFlow = "question";
      qaRole = "question";
      qaStart = true;
    } else if (explicitAnswer || arrowAnswer) {
      section = "qa";
      qaFlow = "answer";
      qaRole = "answer";
      qaStart = true;
    } else if (section === "qa" && qaFlow) {
      qaRole = qaFlow;
    }

    const nextStartsNewSection =
      nextNonBlankIndex < 0
      || QUESTION_PREFIX_RE.test(nextNonBlank)
      || isScreenedHeading(nextNonBlank)
      || isEmploymentHeading(nextNonBlank)
      || isAvailabilityHeading(nextNonBlank)
      || isAvailabilityLine(nextNonBlank)
      || isUnavailableAvailabilityLine(nextNonBlank)
      || EXPERT_LINE_RE.test(nextNonBlank)
      || /^Book Now$/i.test(nextNonBlank);
    const qaEnd = qaRole === "answer" && nextStartsNewSection;

    let bookNowUrl: string | undefined;
    if (/^Book Now$/i.test(trimmed)) {
      bookNowUrl = consumeNextBookNow();
    }
    const lineLinks = /^Book Now$/i.test(trimmed) ? [] : consumeLinksForLine(trimmed);
    const rendered = formatLine(
      line,
      style,
      palette,
      section,
      options,
      expertCount,
      qaRole,
      qaStart,
      false,
      bookNowUrl,
      lineLinks,
      qaEnd,
    );

    parts.push(rendered);
  }
  closeGroup();
  const content = parts.join("");
  return content
    ? `<div style="font-family:Arial,'Noto Sans JP',sans-serif;font-size:12px;line-height:1.45;color:#171717">${content}</div>`
    : "";
}

export default function Home() {
  const [source, setSource] = useState("");
  const [richLinks, setRichLinks] = useState<RichLink[]>([]);
  const [copied, setCopied] = useState(false);
  const [style, setStyle] = useState<StyleId>("smart");
  const [lang, setLang] = useState<Lang>("ja");
  const [appearanceHistory, setAppearanceHistory] = useState<Appearance[]>([
    { palette: "tb", emphasisVariant: "color" },
  ]);
  const [appearanceIndex, setAppearanceIndex] = useState(0);
  const [introTreatment, setIntroTreatment] = useState<IntroTreatmentId>("none");
  const [entityHighlights, setEntityHighlights] = useState(false);
  const [randomLabel, setRandomLabel] = useState("");
  const sourceInputRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const previewScrollTopRef = useRef(0);
  const t = UI[lang];
  const { palette, emphasisVariant } = appearanceHistory[appearanceIndex];
  const effectiveStyle = style === "smart" ? detectStyle(source) : style;
  const sourceExpertCount = source
    .split(/\r?\n/)
    .filter((line) => EXPERT_LINE_RE.test(line.trim()))
    .length;
  const compactExpertLayout = effectiveStyle === "list";
  const plainTextLayout = effectiveStyle === "minimal" && sourceExpertCount === 0;
  const expertCards = !plainTextLayout;
  const angleGroups = !plainTextLayout;
  const fullProfileCards = !compactExpertLayout && !plainTextLayout;
  const blackAngleTitles = true;
  const formatOptions = useMemo(
    () => ({ introTreatment, entityHighlights, expertCards, angleGroups, fullProfileCards, blackAngleTitles, emphasisVariant }),
    [introTreatment, entityHighlights, expertCards, angleGroups, fullProfileCards, blackAngleTitles, emphasisVariant],
  );
  const html = useMemo(
    () => formatText(source, style, palette, formatOptions, richLinks),
    [source, style, palette, formatOptions, richLinks],
  );
  const selectedStyleIndex = STYLE_IDS.indexOf(style);
  const paletteIds = Object.keys(PALETTES) as PaletteId[];

  useEffect(() => {
    let restoreTimer: number | undefined;
    try {
      const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      const savedEntityHighlights =
        window.localStorage.getItem(ENTITY_HIGHLIGHT_STORAGE_KEY) === "true";
      restoreTimer = window.setTimeout(() => {
        if (savedLanguage === "zh" || savedLanguage === "ja" || savedLanguage === "en") {
          setLang(savedLanguage);
        }
        setEntityHighlights(savedEntityHighlights);
      }, 0);
    } catch {
      // Keep Japanese as the default when browser storage is unavailable.
    }
    return () => {
      if (restoreTimer !== undefined) window.clearTimeout(restoreTimer);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : lang;
  }, [lang]);

  useLayoutEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    const maximum = Math.max(0, preview.scrollHeight - preview.clientHeight);
    preview.scrollTop = Math.min(previewScrollTopRef.current, maximum);
  }, [html]);

  function changeLanguage(nextLanguage: Lang) {
    setLang(nextLanguage);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    } catch {
      // Language switching still works for the current visit.
    }
  }

  function changeEntityHighlights(enabled: boolean) {
    setEntityHighlights(enabled);
    try {
      window.localStorage.setItem(ENTITY_HIGHLIGHT_STORAGE_KEY, String(enabled));
    } catch {
      // The choice still works for the current visit.
    }
  }

  function applyStylePreset(nextStyle: StyleId) {
    setStyle(nextStyle);
  }

  function randomizeStyle() {
    const colorChoices = paletteIds.filter((item) => item !== palette);
    const emphasisChoices = EMPHASIS_VARIANTS.filter((item) => item !== emphasisVariant);
    const nextPalette = colorChoices[Math.floor(Math.random() * colorChoices.length)];
    const nextEmphasis = emphasisChoices[Math.floor(Math.random() * emphasisChoices.length)];
    const nextAppearance = { palette: nextPalette, emphasisVariant: nextEmphasis };
    setAppearanceHistory((current) => [
      ...current.slice(0, appearanceIndex + 1),
      nextAppearance,
    ]);
    setAppearanceIndex((current) => current + 1);
    setRandomLabel(`${t.palettes[paletteIds.indexOf(nextPalette)]} · ${t.emphasisStyles[EMPHASIS_VARIANTS.indexOf(nextEmphasis)]}`);
    window.setTimeout(() => setRandomLabel(""), 1600);
  }

  function previousAppearance() {
    setAppearanceIndex((current) => Math.max(0, current - 1));
  }

  function nextAppearance() {
    setAppearanceIndex((current) => Math.min(appearanceHistory.length - 1, current + 1));
  }

  function syncSourceFromEditor() {
    const editor = sourceInputRef.current;
    if (!editor) return;
    setSource(editor.innerText.replaceAll("\u00a0", " "));
    const links = Array.from(editor.querySelectorAll("a"))
      .map((anchor) => ({
        label: (anchor.textContent ?? "").replace(/\s+/g, " ").trim(),
        href: anchor.getAttribute("href") ?? "",
      }))
      .filter((link) => link.label && Boolean(safeLink(link.href)));
    setRichLinks(links);
  }

  function handleSourcePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const clipboardHtml = event.clipboardData.getData("text/html");
    const clipboardText = event.clipboardData.getData("text/plain");
    const insertHtml = clipboardHtml
      ? sanitizePastedContent(clipboardHtml)
      : escapeHtml(clipboardText).replace(/\r?\n/g, "<br>");
    document.execCommand("insertHTML", false, insertHtml);
    window.setTimeout(() => {
      syncSourceFromEditor();
    }, 0);
  }

  function clearSource() {
    if (sourceInputRef.current) sourceInputRef.current.innerHTML = "";
    setSource("");
    setRichLinks([]);
  }

  async function copyRichText() {
    const element = previewRef.current;
    if (!element) return;
    const rich = element.innerHTML;
    const plain = element.innerText;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([rich], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" }),
        }),
      ]);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.execCommand("copy");
      selection?.removeAllRanges();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <main>
      <header className="topbar">
        <div className="brand"><span className="brandMark" aria-hidden="true" /><span>BBK Bunken</span></div>
        <div className="topActions">
          <div className="languageSwitch" aria-label="Interface language">
            {(["zh", "ja", "en"] as Lang[]).map((item) => (
              <button key={item} className={lang === item ? "active" : ""} onClick={() => changeLanguage(item)}>
                {item === "zh" ? "中文" : item === "ja" ? "日本語" : "English"}
              </button>
            ))}
          </div>
          <div className="headerHint">{t.headerHint}</div>
        </div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">EMAIL FORMAT ASSISTANT</p>
          <h1>{t.title}</h1>
          <p className="subtitle">{t.subtitle}</p>
        </div>
        <div className="steps">
          <span><b>1</b> {t.paste}</span><i />
          <span><b>2</b> {t.format}</span><i />
          <span><b>3</b> {t.copyStep}</span>
        </div>
      </section>

      <section className="workspace">
        <div className="panel">
          <div className="panelHead">
            <div><span className="number">01</span><b>{t.source}</b></div>
            <div className="sourceActions">
              {richLinks.length > 0 && <span className="linkBadge">↗ {richLinks.length} {t.linksKept}</span>}
              <button className="textButton" onClick={clearSource}>{t.clear}</button>
            </div>
          </div>
          <div
            ref={sourceInputRef}
            className="sourceEditor"
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label={t.source}
            data-placeholder={t.placeholder}
            onInput={syncSourceFromEditor}
            onPaste={handleSourcePaste}
            onClick={(event) => {
              const anchor = (event.target as HTMLElement).closest("a");
              if (!anchor) return;
              event.preventDefault();
              window.open(anchor.href, "_blank", "noopener,noreferrer");
            }}
          />
          <div className="tip">{t.tip}</div>
        </div>

        <div className="arrow" aria-hidden="true">→</div>

        <div className="panel previewPanel">
          <div className="panelHead">
            <div><span className="number">02</span><b>{t.result}</b></div>
            <div className="resultActions">
              <span className="live"><i /> {t.current}：{t.styles[selectedStyleIndex]}</span>
              <button className="topCopyButton" onClick={copyRichText}>
                <span>{copied ? "✓" : "⧉"}</span>{copied ? t.copied : t.copy}
              </button>
            </div>
          </div>
          <div className="styleBar">
            <div className="modeControl">
              <span className="optionLabel">{t.formatMode}</span>
              <div className="styleTabs" role="group" aria-label={t.formatMode}>
                {VISIBLE_STYLE_IDS.map((item) => {
                  const index = STYLE_IDS.indexOf(item);
                  return (
                    <button
                      key={item}
                      className={style === item ? "active" : ""}
                      onClick={() => applyStylePreset(item)}
                      title={t.notes[index]}
                    >
                      {t.styles[index]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="appearanceActions">
              <button
                className="historyButton"
                onClick={previousAppearance}
                disabled={appearanceIndex === 0}
                aria-label={t.previous}
              >
                ← {t.previous}
              </button>
              <button className="randomButton" onClick={randomizeStyle}>
                <span>✦</span>{randomLabel ? `${t.changed}：${randomLabel}` : t.random}
              </button>
              <button
                className="historyButton"
                onClick={nextAppearance}
                disabled={appearanceIndex >= appearanceHistory.length - 1}
                aria-label={t.next}
              >
                {t.next} →
              </button>
            </div>
          </div>
          <div className="optionBar" aria-label={t.options}>
            <div className="introTreatment" role="group" aria-label={t.introLabel}>
              <span>{t.introLabel}</span>
              {INTRO_TREATMENTS.map((item, index) => (
                <button
                  key={item}
                  className={introTreatment === item ? "active" : ""}
                  onClick={() => setIntroTreatment(item)}
                >
                  {t.introTreatments[index]}
                </button>
              ))}
            </div>
            <label><input type="checkbox" checked={entityHighlights} onChange={(event) => changeEntityHighlights(event.target.checked)} /><span>{t.entityHighlight}</span></label>
          </div>
          <div
            ref={previewRef}
            className={`preview style-${effectiveStyle}`}
            onScroll={(event) => {
              previewScrollTopRef.current = event.currentTarget.scrollTop;
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </section>

      <footer>
        <span>{t.foot1}</span>
        <span>{t.foot2}</span>
      </footer>
    </main>
  );
}
