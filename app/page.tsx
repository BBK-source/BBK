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
    cameoOne: "哎呀妈呀，这玩意儿老好使了！",
    cameoTwo: "以后可不用手动折腾了！",
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
    cameoOne: "これ、めっちゃ便利やん！",
    cameoTwo: "もう手作業で整えんでええな",
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
    cameoOne: "Yo, this thing’s fire!",
    cameoTwo: "No more hand-formatting, fam.",
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
        <div className="sponsorWall" aria-hidden="true">
          <div className="sponsorPoster sponsorPosterSapporo"><img src="data:image/webp;base64,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" alt="" /></div>
          <div className="sponsorPoster sponsorPosterYebisu"><img src="data:image/webp;base64,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" alt="" /></div>
          <div className="sponsorPoster sponsorPosterOrion"><img src="data:image/webp;base64,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" alt="" /></div>
          <div className="sponsorPoster sponsorPosterKirin"><img src="data:image/webp;base64,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" alt="" /></div>
          <span className="sponsorWallLabel">UNOFFICIAL AFTER-WORK SPONSORS</span>
        </div>
        <div className="heroCopy">
          <p className="eyebrow">EMAIL FORMAT ASSISTANT</p>
          <h1>{t.title}</h1>
          <p className="subtitle">{t.subtitle}</p>
        </div>
        <div className="heroAside">
          <div className="teamCameo" aria-hidden="true">
            <span className="cameoBubble cameoBubbleOne">{t.cameoOne}</span>
            <span className="cameoBubble cameoBubbleTwo">{t.cameoTwo}</span>
            <img src="/BBK/bbk-team-cameo.png" alt="" />
          </div>
          <div className="steps">
            <span><b>1</b> {t.paste}</span><i />
            <span><b>2</b> {t.format}</span><i />
            <span><b>3</b> {t.copyStep}</span>
          </div>
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
