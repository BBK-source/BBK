"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ClipboardEvent, PointerEvent as ReactPointerEvent } from "react";
import {
  emphasizeCompanyNamesText,
  emphasizeCompaniesText,
  emphasizeQaText,
} from "./emphasis.js";
import {
  ANSWER_PREFIX_RE,
  ARROW_ANSWER_RE,
  EXPERT_LINE_RE,
  QUESTION_PREFIX_RE,
  isAvailabilityHeading,
  isEmploymentHeading,
  isQaTopicHeading,
  isQuestionStart,
  isScreenedHeading,
  normalizeCopiedText,
} from "./structure.js";
import { applyIntroTreatment } from "./intro-treatment.js";
import {
  emphasizeAvailabilityTimes,
  isAvailabilityLine,
  isTimeZoneLine,
  isUnavailableAvailabilityLine,
  normalizeAvailabilityTimes,
} from "./availability.js";
import {
  AVAILABILITY_SUMMARY_END,
  buildAvailabilitySummary,
  countExpertsWithAvailability,
  reorderAvailabilityLines,
} from "./profile-order.js";

type StyleId = "smart" | "classic" | "list" | "qa" | "minimal";
type Lang = "zh" | "ja" | "en" | "ko";
type PaletteId = "tb" | "ocean" | "forest" | "plum" | "amber" | "slate";
type EmphasisVariantId = "color" | "marker" | "colorMarker" | "strong" | "underline";
type IntroTreatmentId = "none" | "color" | "bold" | "marker";
type AboveLinksSectionId = "availability" | "intro";
type Appearance = { palette: PaletteId; emphasisVariant: EmphasisVariantId };
type EditorPaletteKind = "text" | "highlight";
type FormatOptions = {
  introTreatment: IntroTreatmentId;
  entityHighlights: boolean;
  expertCards: boolean;
  angleGroups: boolean;
  fullProfileCards: boolean;
  blackAngleTitles: boolean;
  emphasisVariant: EmphasisVariantId;
  aboveLinksSection: AboveLinksSectionId;
  standaloneAvailability: boolean;
};
type RichLink = { label: string; href: string };

const STYLE_IDS: StyleId[] = ["smart", "classic", "list", "qa", "minimal"];
const VISIBLE_STYLE_IDS: StyleId[] = ["smart", "list", "qa"];
const LANGUAGES: Lang[] = ["zh", "ja", "en", "ko"];
const LANGUAGE_LABELS: Record<Lang, string> = {
  zh: "中文",
  ja: "日本語",
  en: "English",
  ko: "한국어",
};
const LANGUAGE_STORAGE_KEY = "bbk-bunken-language";
const ENTITY_HIGHLIGHT_STORAGE_KEY = "bbk-bunken-entity-highlights";
const PROFILE_FRAMES_STORAGE_KEY = "bbk-bunken-profile-frames";
const EXPERT_ID_RE = /^(?:[-•]\s*)?(?:(Recommended(?:\s+Expert)?|Recommendation|推荐|推薦|推奨|추천)\s*[:：]?\s*)?((?:#(?:[A-Z][A-Z0-9]*|\d+)(?:[.-]\d+)*|[A-Z][A-Z0-9]*(?:[.-]\d+)+))/i;
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
const ABOVE_LINKS_SECTIONS: AboveLinksSectionId[] = ["availability", "intro"];
const TEXT_COLOR_CHOICES = [
  "#171717", "#434343", "#666666", "#999999", "#b7b7b7", "#ffffff",
  "#980000", "#e83b2e", "#c34f32", "#f29900", "#9a6a22", "#6a4b17",
  "#274e13", "#47745a", "#00875a", "#287c91", "#1769aa", "#365f78",
  "#1c4587", "#3c78d8", "#674ea7", "#7b5b8e", "#b84562", "#a61c55",
];
const HIGHLIGHT_COLOR_CHOICES = [
  "#fff2bf", "#fff0d0", "#fde2d7", "#fbe4eb", "#f5e8f0", "#eadcff",
  "#dce9ff", "#d8eefb", "#e2f5f7", "#daf5e8", "#eef3d6", "#e9eef1",
  "#ffe599", "#f9cb9c", "#f4cccc", "#ead1dc", "#d9d2e9", "#c9daf8",
  "#cfe2f3", "#d0e0e3", "#b6d7a8", "#d9ead3", "#eeeeee", "#ffffff",
];

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
    notes: ["按内容自动选择结构，默认每位专家完整分框", "整份专家资料以重点卡片呈现", "同一 Angle 下压缩成名单", "问题与回答使用分层色块", "去掉彩色强调与外框"],
    palettes: ["TB 经典", "海洋蓝", "森林绿", "梅紫", "暖琥珀", "商务灰"],
    emphasisStyles: ["彩色粗体", "荧光笔", "彩色荧光", "黑色重粗", "彩色下划线"],
    options: "简易设置", introLabel: "介绍文", introTreatments: ["无", "标色", "加粗", "荧光"], profileFrames: "专家资料加框", entityHighlight: "自动标记公司／职位",
    aboveLinksLabel: "项目链接上方", aboveLinksOptions: ["Availability", "介绍文"], aboveLinksHint: "自动带专家 Title", standaloneAvailability: "时间清单", availabilityListTitle: "独立 Availability 清单", availabilityListHint: "只包含专家 Title 和时间，可单独复制。", includeAvailabilityInEmail: "同时加入邮件正文", copyAvailabilityList: "复制时间清单", close: "关闭",
    manualEdit: "手动调整", bold: "加粗／取消加粗", normal: "恢复常规", underline: "下划线", textColor: "文字颜色", highlightColor: "背景颜色", customColor: "自选颜色", removeHighlight: "去除背景", clearFormatting: "清除格式", undo: "撤销", redo: "重做", editHint: "选中文字后调整",
    previous: "上一个", next: "下一个",
    linksKept: "已保留链接",
    checkOk: "识别正常", checkEmpty: "粘贴后自动检查结构", angleCount: "Angle", expertCount: "专家", qaCount: "Q&A", linkCount: "链接", availabilityCount: "Availability", missingAnswers: "个问题缺少回答", extraAnswers: "个回答缺少问题", unrecognizedExperts: "位疑似专家未识别", missingBookLinks: "个 Book Now 缺少链接", missingAvailability: "位专家缺少 Availability",
    copyLanguageLink: "复制当前语言链接", languageLinkCopied: "语言链接已复制",
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
    notes: ["内容に合わせて構成を選び、専門家ごとに全体を枠で表示", "一名ずつ全体を重点カードで表示", "同じAngle内をコンパクトな一覧に整理", "質問と回答を色付きカードで分ける", "色の強調と外枠を省いた簡潔表示"],
    palettes: ["TBクラシック", "オーシャン", "フォレスト", "プラム", "アンバー", "ビジネスグレー"],
    emphasisStyles: ["カラー太字", "マーカー", "カラー＋マーカー", "黒の太字", "カラー下線"],
    options: "簡単設定", introLabel: "紹介文", introTreatments: ["なし", "カラー", "太字", "マーカー"], profileFrames: "専門家ごとに枠を付ける", entityHighlight: "会社・役職を自動強調",
    aboveLinksLabel: "プロジェクトリンクの上", aboveLinksOptions: ["Availability", "紹介文"], aboveLinksHint: "専門家Titleも自動表示", standaloneAvailability: "時間一覧", availabilityListTitle: "Availability 時間一覧", availabilityListHint: "専門家Titleと時間のみ。個別にコピーできます。", includeAvailabilityInEmail: "メール本文にも追加", copyAvailabilityList: "時間一覧をコピー", close: "閉じる",
    manualEdit: "手動調整", bold: "太字／太字を解除", normal: "通常の太さ", underline: "下線", textColor: "文字色", highlightColor: "背景色", customColor: "色を選択", removeHighlight: "背景色を解除", clearFormatting: "書式をクリア", undo: "元に戻す", redo: "やり直す", editHint: "文字を選んで調整",
    previous: "前へ", next: "次へ",
    linksKept: "リンクを保持",
    checkOk: "認識は正常です", checkEmpty: "貼り付け後に構成を自動チェック", angleCount: "Angle", expertCount: "専門家", qaCount: "Q&A", linkCount: "リンク", availabilityCount: "Availability", missingAnswers: "件の質問に回答がありません", extraAnswers: "件の回答に質問がありません", unrecognizedExperts: "名の専門家候補を認識できていません", missingBookLinks: "件のBook Nowにリンクがありません", missingAvailability: "名の専門家にAvailabilityがありません",
    copyLanguageLink: "現在の言語リンクをコピー", languageLinkCopied: "言語リンクをコピーしました",
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
    notes: ["Automatically selects the structure and frames each full expert profile", "Frames each full expert profile as a feature card", "Compresses experts under each angle into a list", "Separates questions and answers into colored cards", "Removes colored emphasis and outer frames"],
    palettes: ["TB classic", "Ocean", "Forest", "Plum", "Amber", "Business gray"],
    emphasisStyles: ["Color bold", "Highlighter", "Color + highlight", "Strong black", "Color underline"],
    options: "Simple settings", introLabel: "Introduction", introTreatments: ["None", "Color", "Bold", "Highlight"], profileFrames: "Frame each expert", entityHighlight: "Auto-highlight companies & roles",
    aboveLinksLabel: "Above project links", aboveLinksOptions: ["Availability", "Introduction"], aboveLinksHint: "Expert title included", standaloneAvailability: "Time list", availabilityListTitle: "Standalone availability list", availabilityListHint: "Expert titles and times only, ready to copy separately.", includeAvailabilityInEmail: "Also include in email", copyAvailabilityList: "Copy time list", close: "Close",
    manualEdit: "Edit", bold: "Bold / unbold", normal: "Regular weight", underline: "Underline", textColor: "Text color", highlightColor: "Highlight color", customColor: "Custom color", removeHighlight: "Remove highlight", clearFormatting: "Clear formatting", undo: "Undo", redo: "Redo", editHint: "Select text to edit",
    previous: "Previous", next: "Next",
    linksKept: "links preserved",
    checkOk: "Recognition looks good", checkEmpty: "Structure check starts after you paste", angleCount: "Angles", expertCount: "Experts", qaCount: "Q&A", linkCount: "Links", availabilityCount: "Availability", missingAnswers: "questions have no answer", extraAnswers: "answers have no question", unrecognizedExperts: "possible experts were not recognized", missingBookLinks: "Book Now items have no link", missingAvailability: "experts have no availability",
    copyLanguageLink: "Copy current-language link", languageLinkCopied: "Language link copied",
    cameoOne: "Yo, this thing’s fire!",
    cameoTwo: "No more hand-formatting, fam.",
  },
  ko: {
    headerHint: "내용을 붙여넣고 자동으로 정리한 뒤 Gmail로 복사",
    title: "이제 이메일 서식을 일일이 손보지 마세요.",
    subtitle: "전문가 제목, 주요 경력, Q&A, 날짜를 자동으로 인식해 깔끔한 레이아웃과 색상을 적용합니다.",
    paste: "붙여넣기", format: "자동 정리", copyStep: "Gmail로 복사",
    source: "원문 붙여넣기", clear: "지우기", placeholder: "보낼 이메일 내용을 여기에 붙여넣으세요…",
    tip: "서식이 있는 텍스트 입력란입니다. 원본 시스템에서 바로 붙여넣으면 링크, 표, 기존 테두리를 유지한 채 Gmail로 복사할 수 있습니다.",
    result: "자동 정리 결과", current: "현재", formatMode: "레이아웃", random: "다른 색상", changed: "변경됨",
    copied: "복사 완료, Gmail에 붙여넣을 수 있어요", copy: "서식 포함 복사",
    foot1: "레이아웃과 구성은 유지되며, 랜덤 버튼은 강조 색상, 형광펜, 굵기만 바꿉니다.",
    foot2: "모든 내용은 현재 브라우저에서만 처리되며 업로드되지 않습니다.",
    styles: ["자동", "강조 카드", "전문가 목록", "Q&A", "심플"],
    notes: ["내용에 맞게 구조를 선택하고 전문가별 전체 내용을 테두리로 구분", "전문가별 전체 내용을 강조 카드로 표시", "같은 Angle의 전문가를 간결한 목록으로 정리", "질문과 답변을 색상 카드로 구분", "색상 강조와 바깥 테두리를 뺀 간결한 표시"],
    palettes: ["TB 클래식", "오션", "포레스트", "플럼", "앰버", "비즈니스 그레이"],
    emphasisStyles: ["색상 굵게", "형광펜", "색상＋형광펜", "검정 굵게", "색상 밑줄"],
    options: "간단 설정", introLabel: "소개문", introTreatments: ["없음", "색상", "굵게", "형광펜"], profileFrames: "전문가별 테두리", entityHighlight: "회사／직책 자동 강조",
    aboveLinksLabel: "프로젝트 링크 위", aboveLinksOptions: ["Availability", "소개문"], aboveLinksHint: "전문가 Title 자동 포함", standaloneAvailability: "시간 목록", availabilityListTitle: "별도 Availability 목록", availabilityListHint: "전문가 Title과 시간만 별도로 복사할 수 있습니다.", includeAvailabilityInEmail: "이메일 본문에도 추가", copyAvailabilityList: "시간 목록 복사", close: "닫기",
    manualEdit: "직접 수정", bold: "굵게／굵게 해제", normal: "기본 굵기", underline: "밑줄", textColor: "글자 색", highlightColor: "배경 색", customColor: "색상 선택", removeHighlight: "배경 색 제거", clearFormatting: "서식 지우기", undo: "실행 취소", redo: "다시 실행", editHint: "텍스트를 선택해 수정",
    previous: "이전", next: "다음",
    linksKept: "개 링크 유지",
    checkOk: "인식 결과 정상", checkEmpty: "붙여넣으면 구조를 자동 점검합니다", angleCount: "Angle", expertCount: "전문가", qaCount: "Q&A", linkCount: "링크", availabilityCount: "Availability", missingAnswers: "개 질문에 답변이 없습니다", extraAnswers: "개 답변에 질문이 없습니다", unrecognizedExperts: "명의 전문가 후보를 인식하지 못했습니다", missingBookLinks: "개 Book Now에 링크가 없습니다", missingAvailability: "명의 전문가에게 Availability가 없습니다",
    copyLanguageLink: "현재 언어 링크 복사", languageLinkCopied: "언어 링크 복사 완료",
    cameoOne: "와, 이거 완전 물건 아이가!",
    cameoTwo: "이제 손으로 안 해도 되겠네!",
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

function normalizeLinkLabel(value: string) {
  return value.replace(/\s+/g, " ").trim();
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

function prepareRichHtmlForGmail(element: HTMLElement) {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.removeAttribute("class");

  clone.querySelectorAll<HTMLElement>("*").forEach((node) => {
    node.removeAttribute("class");
    node.removeAttribute("contenteditable");
    node.style.removeProperty("line-height");

    if (node.style.position === "absolute") {
      node.style.removeProperty("position");
      node.style.removeProperty("left");
      node.style.removeProperty("right");
      node.style.removeProperty("top");
      node.style.removeProperty("bottom");
      if ((node.textContent ?? "").trim() === "•") {
        node.style.marginRight = "5px";
      }
    } else if (node.style.position === "relative") {
      node.style.removeProperty("position");
    }

    if (!(node.textContent ?? "").trim() && node.querySelector("br")) {
      node.style.removeProperty("height");
      node.style.removeProperty("min-height");
    }
  });

  // Gmail uses an empty block's inherited style for newly typed text. Remove
  // invisible wrappers so typing after a paste returns to Gmail's body style.
  Array.from(clone.querySelectorAll<HTMLElement>("div, p, td, table"))
    .reverse()
    .forEach((node) => {
      const visibleText = (node.textContent ?? "").replace(/\u200b/g, "").trim();
      const hasMeaningfulContent = Boolean(
        visibleText || node.querySelector("a, img, hr, table:not(:empty)"),
      );
      if (!hasMeaningfulContent) node.remove();
    });

  return clone.innerHTML;
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

function emphasizeCompanies(
  text: string,
  style: StyleId,
  palette: PaletteId,
  enabled = true,
  variant: EmphasisVariantId = "color",
) {
  if (style === "minimal") return text;
  return emphasizeCompaniesText(
    text,
    PALETTES[palette].key,
    enabled,
    emphasisDecoration(palette, variant),
  );
}

function emphasizeExpertTitleCompanies(
  text: string,
  style: StyleId,
  palette: PaletteId,
  enabled = true,
  variant: EmphasisVariantId = "color",
) {
  if (style === "minimal") return text;
  return emphasizeCompanyNamesText(
    text,
    PALETTES[palette].key,
    enabled,
    emphasisDecoration(palette, variant),
  );
}

function emphasizeQa(
  text: string,
  style: StyleId,
  palette: PaletteId,
  includeEntities: boolean,
  variant: EmphasisVariantId,
) {
  if (style === "minimal") return text;
  return emphasizeQaText(
    text,
    PALETTES[palette].key,
    includeEntities,
    emphasisDecoration(palette, variant),
  );
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
  const normalizedText = normalizeCopiedText(text);
  const lines = normalizedText.split(/\r?\n/);
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
  if (normalizedText.length < 700) return "minimal";
  return "classic";
}

function nextNonBlankLineIndex(lines: string[], index: number) {
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    if (lines[cursor].trim()) return cursor;
  }
  return -1;
}

function isAngleTitleLine(lines: string[], index: number) {
  const candidate = lines[index]?.trim() ?? "";
  const nextIndex = nextNonBlankLineIndex(lines, index);
  return /[:：]\s*$/.test(candidate)
    && nextIndex >= 0
    && EXPERT_LINE_RE.test(lines[nextIndex].trim());
}

type StructureCheck = {
  angles: number;
  experts: number;
  questions: number;
  answers: number;
  qaPairs: number;
  links: number;
  availabilityProfiles: number;
  missingAvailability: number;
  missingAnswers: number;
  extraAnswers: number;
  unrecognizedExperts: number;
  missingBookLinks: number;
};

function analyzeSource(text: string, richLinks: RichLink[]): StructureCheck {
  const normalizedText = normalizeCopiedText(text);
  const lines = normalizedText.split(/\r?\n/);
  const experts = lines.filter((line) => EXPERT_LINE_RE.test(line.trim())).length;
  const availabilityCoverage = countExpertsWithAvailability(normalizedText);
  const angles = lines.filter((_, index) => isAngleTitleLine(lines, index)).length;
  const questions = lines.filter((line, index) => {
    const trimmed = line.trim();
    const nextIndex = nextNonBlankLineIndex(lines, index);
    const nextLine = nextIndex >= 0 ? lines[nextIndex].trim() : "";
    return isQuestionStart(trimmed, nextLine);
  }).length;
  const answers = lines.filter((line) => {
    const trimmed = line.trim();
    return ANSWER_PREFIX_RE.test(trimmed) || ARROW_ANSWER_RE.test(trimmed);
  }).length;
  const bookNowItems = normalizedText.match(/\bBook\s*Now\b/gi)?.length ?? 0;
  const bookNowLinks = richLinks.filter((link) => /^Book\s*Now$/i.test(link.label)).length;
  const angleCandidates = lines.filter((line) => (
    /^(?:Angle\b|角度\b|アングル\b|앵글\b).*[:：]\s*$/i.test(line.trim())
  )).length;

  return {
    angles,
    experts,
    questions,
    answers,
    qaPairs: Math.min(questions, answers),
    links: richLinks.length,
    availabilityProfiles: availabilityCoverage.withAvailability,
    missingAvailability: Math.max(0, experts - availabilityCoverage.withAvailability),
    missingAnswers: Math.max(0, questions - answers),
    extraAnswers: Math.max(0, answers - questions),
    unrecognizedExperts: Math.max(0, bookNowItems - experts),
    missingBookLinks: Math.max(0, bookNowItems - bookNowLinks),
    ...(angleCandidates > 0 && experts === 0
      ? { unrecognizedExperts: Math.max(1, bookNowItems) }
      : {}),
  };
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
    const fullPrefix = idMatch?.[0] ?? "";
    const recommendation = idMatch?.[1] ?? "";
    const id = idMatch?.[2] ?? "";
    const rest = safe.slice(fullPrefix.length);
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
    const recommendationHtml = recommendation
      ? `<span style="color:${keyColor};font-weight:800">${recommendation}</span> `
      : "";
    return `<div style="${listCss}">${bullet}${recommendationHtml}<span style="color:${accent}">${id}</span>${expertRest}</div>`;
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
  if (section === "qa" && !qaRole && /^(?:[·•▪◦]\s*)/.test(raw.trim())) {
    return `<div style="font-weight:800;margin-top:8px;padding:4px 0 2px;border-bottom:1px solid ${colors.border};color:${accent}">${safe}</div>`;
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
  if (section === "availability" && isTimeZoneLine(raw)) {
    return `<div style="font-weight:700;line-height:1.42;padding:4px 0;color:${accent}">${safe}</div>`;
  }
  if (isAvailabilityLine(raw)) {
    const normalized = escapeHtml(normalizeAvailabilityTimes(raw));
    return `<div style="line-height:1.42;padding:2px 5px;border-left:3px solid ${colors.border}">${emphasizeAvailabilityTimes(normalized)}</div>`;
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
  const normalizedText = normalizeCopiedText(text);
  const sourceLines = normalizedText.split(/\r?\n/);
  const lines: string[] = reorderAvailabilityLines(
    normalizedText,
    options.standaloneAvailability ? "availability" : options.aboveLinksSection,
    options.standaloneAvailability,
  ).split(/\r?\n/);
  const expertCount = sourceLines.filter((line) => EXPERT_LINE_RE.test(line.trim())).length;
  let section: ProfileSection = "body";
  let qaFlow: QaRole = null;
  let groupOpen = false;
  let groupMode: "list" | "profile" | null = null;
  let groupHasExpert = false;
  let previousLineWasBlank = false;
  const skippedLines = new Set<number>();
  const usedLinks = new Set<number>();
  const parts: string[] = [];

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
    const nextNonBlankIndex = nextNonBlankLineIndex(lines, index);
    const nextNonBlank = nextNonBlankIndex >= 0 ? lines[nextNonBlankIndex].trim() : "";
    const isAngleTitle = isAngleTitleLine(lines, index);
    const isExpertLine = EXPERT_LINE_RE.test(trimmed);

    if (trimmed === AVAILABILITY_SUMMARY_END) {
      closeGroup();
      section = "body";
      qaFlow = null;
      previousLineWasBlank = false;
      continue;
    }

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

    if (
      section === "availability"
      && trimmed
      && index > 0
      && !lines[index - 1].trim()
      && !isAvailabilityHeading(trimmed)
      && !isAvailabilityLine(trimmed)
      && !isUnavailableAvailabilityLine(trimmed)
      && !isTimeZoneLine(trimmed)
    ) {
      section = "body";
    }

    if (options.angleGroups && isAngleTitle) {
      closeGroup();
      let nextAngleIndex = lines.length;
      for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        if (isAngleTitleLine(lines, cursor)) {
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
    if (isAvailabilityLine(trimmed) || isUnavailableAvailabilityLine(trimmed) || isTimeZoneLine(trimmed)) {
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

    if (isQaTopicHeading(trimmed, nextNonBlank)) {
      section = "qa";
      qaFlow = null;
    }

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
      || isTimeZoneLine(nextNonBlank)
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
    ? `<div style="font-family:Arial,'Noto Sans JP','Noto Sans KR',sans-serif;font-size:12px;line-height:1.45;color:#171717">${content}</div>`
    : "";
}

export default function Home() {
  const [source, setSource] = useState("");
  const [richLinks, setRichLinks] = useState<RichLink[]>([]);
  const [copied, setCopied] = useState(false);
  const [languageLinkCopied, setLanguageLinkCopied] = useState(false);
  const [style, setStyle] = useState<StyleId>("smart");
  const [lang, setLang] = useState<Lang>("ja");
  const [appearanceHistory, setAppearanceHistory] = useState<Appearance[]>([
    { palette: "tb", emphasisVariant: "color" },
  ]);
  const [appearanceIndex, setAppearanceIndex] = useState(0);
  const [introTreatment, setIntroTreatment] = useState<IntroTreatmentId>("none");
  const [aboveLinksSection, setAboveLinksSection] = useState<AboveLinksSectionId>("availability");
  const [standaloneAvailability, setStandaloneAvailability] = useState(false);
  const [availabilityListOpen, setAvailabilityListOpen] = useState(false);
  const [availabilityListCopied, setAvailabilityListCopied] = useState(false);
  const [profileFrames, setProfileFrames] = useState(true);
  const [entityHighlights, setEntityHighlights] = useState(false);
  const [randomLabel, setRandomLabel] = useState("");
  const [activeEditorPalette, setActiveEditorPalette] = useState<EditorPaletteKind | null>(null);
  const [editorTextColor, setEditorTextColor] = useState("#171717");
  const [editorHighlightColor, setEditorHighlightColor] = useState("#fff2bf");
  const [editorHistoryState, setEditorHistoryState] = useState({ canUndo: false, canRedo: false });
  const sourceInputRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const availabilityListRef = useRef<HTMLDivElement>(null);
  const editorToolbarRef = useRef<HTMLDivElement>(null);
  const previewSelectionRef = useRef<Range | null>(null);
  const toolbarSelectionLockRef = useRef(false);
  const selectionRestoreFrameRef = useRef<number | null>(null);
  const editorHistoryRef = useRef<{ entries: string[]; index: number }>({ entries: [], index: -1 });
  const previewScrollTopRef = useRef(0);
  const t = UI[lang];
  const { palette, emphasisVariant } = appearanceHistory[appearanceIndex];
  const effectiveStyle = style === "smart" ? detectStyle(source) : style;
  const sourceExpertCount = (source
    ? normalizeCopiedText(source).split(/\r?\n/)
    : [])
    .filter((line) => EXPERT_LINE_RE.test(line.trim()))
    .length;
  const compactExpertLayout = style === "list";
  const plainTextLayout = effectiveStyle === "minimal" && sourceExpertCount === 0;
  const expertCards = profileFrames && !plainTextLayout;
  const angleGroups = profileFrames && !plainTextLayout;
  const fullProfileCards = profileFrames && !compactExpertLayout && !plainTextLayout;
  const blackAngleTitles = true;
  const formatOptions = useMemo(
    () => ({ introTreatment, entityHighlights, expertCards, angleGroups, fullProfileCards, blackAngleTitles, emphasisVariant, aboveLinksSection, standaloneAvailability }),
    [introTreatment, entityHighlights, expertCards, angleGroups, fullProfileCards, blackAngleTitles, emphasisVariant, aboveLinksSection, standaloneAvailability],
  );
  const html = useMemo(
    () => formatText(source, style, palette, formatOptions, richLinks),
    [source, style, palette, formatOptions, richLinks],
  );
  const availabilitySummary = useMemo(() => buildAvailabilitySummary(normalizeCopiedText(source)), [source]);
  const availabilitySummaryHtml = useMemo(
    () => formatText(
      availabilitySummary,
      "classic",
      palette,
      {
        ...formatOptions,
        aboveLinksSection: "availability",
        standaloneAvailability: false,
        angleGroups: false,
        expertCards: true,
        fullProfileCards: true,
      },
      [],
    ),
    [availabilitySummary, palette, formatOptions],
  );
  const selectedStyleIndex = STYLE_IDS.indexOf(style);
  const paletteIds = Object.keys(PALETTES) as PaletteId[];
  const structureCheck = useMemo(() => analyzeSource(source, richLinks), [source, richLinks]);
  const structureIssues = [
    structureCheck.missingAnswers > 0 ? `${structureCheck.missingAnswers} ${t.missingAnswers}` : "",
    structureCheck.extraAnswers > 0 ? `${structureCheck.extraAnswers} ${t.extraAnswers}` : "",
    structureCheck.unrecognizedExperts > 0 ? `${structureCheck.unrecognizedExperts} ${t.unrecognizedExperts}` : "",
    structureCheck.missingBookLinks > 0 ? `${structureCheck.missingBookLinks} ${t.missingBookLinks}` : "",
    structureCheck.missingAvailability > 0 ? `${structureCheck.missingAvailability} ${t.missingAvailability}` : "",
  ].filter(Boolean);

  useEffect(() => {
    let requestedLanguage: string | null = null;
    let savedLanguage: string | null = null;
    let savedEntityHighlights = false;
    let savedProfileFrames: string | null = null;
    try {
      requestedLanguage = new URL(window.location.href).searchParams.get("lang");
    } catch {
      // Keep the default language when the address cannot be read.
    }
    try {
      savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      savedEntityHighlights = window.localStorage.getItem(ENTITY_HIGHLIGHT_STORAGE_KEY) === "true";
      savedProfileFrames = window.localStorage.getItem(PROFILE_FRAMES_STORAGE_KEY);
    } catch {
      // Saved preferences are optional.
    }
    const restoreTimer = window.setTimeout(() => {
      const initialLanguage = requestedLanguage && LANGUAGES.includes(requestedLanguage as Lang)
        ? requestedLanguage
        : savedLanguage;
      if (initialLanguage && LANGUAGES.includes(initialLanguage as Lang)) {
        setLang(initialLanguage as Lang);
      }
      if (savedProfileFrames !== null) {
        setProfileFrames(savedProfileFrames !== "false");
      }
      setEntityHighlights(savedEntityHighlights);
    }, 0);
    return () => {
      window.clearTimeout(restoreTimer);
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
    previewSelectionRef.current = null;
    editorHistoryRef.current = { entries: [preview.innerHTML], index: 0 };
    setEditorHistoryState((current) => (
      current.canUndo || current.canRedo ? { canUndo: false, canRedo: false } : current
    ));
  }, [html]);

  useEffect(() => {
    if (!activeEditorPalette) return;
    function closeEditorPalette(event: PointerEvent) {
      if (!editorToolbarRef.current?.contains(event.target as Node)) {
        setActiveEditorPalette(null);
      }
    }
    document.addEventListener("pointerdown", closeEditorPalette);
    return () => document.removeEventListener("pointerdown", closeEditorPalette);
  }, [activeEditorPalette]);

  useEffect(() => {
    function trackPreviewSelection() {
      if (toolbarSelectionLockRef.current) return;
      const preview = previewRef.current;
      const selection = window.getSelection();
      if (!preview || !selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      if (
        preview.contains(range.startContainer)
        && preview.contains(range.endContainer)
      ) {
        previewSelectionRef.current = range.cloneRange();
      }
    }

    document.addEventListener("selectionchange", trackPreviewSelection);
    return () => {
      document.removeEventListener("selectionchange", trackPreviewSelection);
      if (selectionRestoreFrameRef.current !== null) {
        window.cancelAnimationFrame(selectionRestoreFrameRef.current);
      }
    };
  }, []);

  function changeLanguage(nextLanguage: Lang) {
    setLang(nextLanguage);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    } catch {
      // Language switching still works for the current visit.
    }
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("lang", nextLanguage);
      window.history.replaceState({}, "", url);
    } catch {
      // The selected language still applies even if the address cannot change.
    }
  }

  async function copyLanguageLink() {
    const url = new URL(window.location.href);
    url.searchParams.set("lang", lang);
    try {
      await navigator.clipboard.writeText(url.toString());
    } catch {
      const field = document.createElement("textarea");
      field.value = url.toString();
      field.style.position = "fixed";
      field.style.left = "-10000px";
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    setLanguageLinkCopied(true);
    window.setTimeout(() => setLanguageLinkCopied(false), 1600);
  }

  function changeEntityHighlights(enabled: boolean) {
    setEntityHighlights(enabled);
    try {
      window.localStorage.setItem(ENTITY_HIGHLIGHT_STORAGE_KEY, String(enabled));
    } catch {
      // The choice still works for the current visit.
    }
  }

  function changeProfileFrames(enabled: boolean) {
    setProfileFrames(enabled);
    try {
      window.localStorage.setItem(PROFILE_FRAMES_STORAGE_KEY, String(enabled));
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
    const links = Array.from(editor.querySelectorAll("a"))
      .map((anchor) => {
        const label = normalizeLinkLabel(anchor.innerText || anchor.textContent || "");
        if (label && anchor.textContent !== label) {
          // Some source tables hard-wrap a link with <br> or nested blocks (for
          // example "Book\nNow"). Flatten only the anchor contents so the text
          // parser and the original URL continue to describe the same item.
          anchor.textContent = label;
        }
        return {
          label,
          href: anchor.getAttribute("href") ?? "",
        };
      })
      .filter((link) => link.label && Boolean(safeLink(link.href)));
    setSource(normalizeCopiedText(editor.innerText.replaceAll("\u00a0", " ")));
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

  function rememberPreviewSelection() {
    const preview = previewRef.current;
    const selection = window.getSelection();
    if (!preview || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (
      preview.contains(range.startContainer)
      && preview.contains(range.endContainer)
    ) {
      previewSelectionRef.current = range.cloneRange();
    }
  }

  function restorePreviewSelection() {
    const preview = previewRef.current;
    const savedRange = previewSelectionRef.current;
    const selection = window.getSelection();
    if (
      !preview
      || !savedRange
      || !selection
      || !preview.contains(savedRange.startContainer)
      || !preview.contains(savedRange.endContainer)
    ) {
      return false;
    }
    const range = savedRange.cloneRange();
    if (document.activeElement !== preview) preview.focus({ preventScroll: true });
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }

  function preservePreviewSelection(event: ReactPointerEvent<HTMLDivElement>) {
    rememberPreviewSelection();
    toolbarSelectionLockRef.current = true;
    const target = event.target as HTMLElement;
    if (!target.closest('input[type="color"]')) event.preventDefault();
  }

  function releasePreviewSelection() {
    if (selectionRestoreFrameRef.current !== null) {
      window.cancelAnimationFrame(selectionRestoreFrameRef.current);
    }
    selectionRestoreFrameRef.current = window.requestAnimationFrame(() => {
      restorePreviewSelection();
      toolbarSelectionLockRef.current = false;
      selectionRestoreFrameRef.current = null;
    });
  }

  function recordPreviewHistory() {
    const preview = previewRef.current;
    if (!preview) return;
    const history = editorHistoryRef.current;
    const snapshot = preview.innerHTML;
    if (history.entries[history.index] === snapshot) return;
    const entries = [...history.entries.slice(0, history.index + 1), snapshot].slice(-60);
    editorHistoryRef.current = { entries, index: entries.length - 1 };
    setEditorHistoryState({ canUndo: entries.length > 1, canRedo: false });
  }

  function applyPreviewFormatting(command: string, value?: string, kind?: EditorPaletteKind) {
    if (!restorePreviewSelection()) return;
    document.execCommand("styleWithCSS", false, "true");

    if (command === "regular") {
      document.execCommand("removeFormat", false);
      if (document.queryCommandState("bold")) document.execCommand("bold", false);
    } else if (command === "highlight") {
      if (!document.execCommand("hiliteColor", false, value)) {
        document.execCommand("backColor", false, value);
      }
    } else {
      document.execCommand(command, false, value);
    }

    if (kind === "text" && value) setEditorTextColor(value);
    if (kind === "highlight" && value && value !== "transparent") setEditorHighlightColor(value);
    rememberPreviewSelection();
    recordPreviewHistory();
    releasePreviewSelection();
  }

  function stepPreviewHistory(direction: -1 | 1) {
    const preview = previewRef.current;
    const history = editorHistoryRef.current;
    const nextIndex = history.index + direction;
    if (!preview || nextIndex < 0 || nextIndex >= history.entries.length) return;
    const scrollTop = preview.scrollTop;
    preview.innerHTML = history.entries[nextIndex];
    preview.scrollTop = scrollTop;
    previewSelectionRef.current = null;
    editorHistoryRef.current = { ...history, index: nextIndex };
    setEditorHistoryState({
      canUndo: nextIndex > 0,
      canRedo: nextIndex < history.entries.length - 1,
    });
  }

  async function copyRichText() {
    const element = previewRef.current;
    if (!element) return;
    const rich = prepareRichHtmlForGmail(element);
    const richDocument = `<!doctype html><html><head><meta charset="utf-8"></head><body>${rich}</body></html>`;
    const plain = element.innerText;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([richDocument], { type: "text/html;charset=utf-8" }),
          "text/plain": new Blob([plain], { type: "text/plain;charset=utf-8" }),
        }),
      ]);
    } catch {
      const transfer = document.createElement("div");
      transfer.setAttribute("aria-hidden", "true");
      transfer.style.position = "fixed";
      transfer.style.left = "-10000px";
      transfer.style.top = "0";
      transfer.innerHTML = rich;
      document.body.appendChild(transfer);
      const range = document.createRange();
      range.selectNodeContents(transfer);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.execCommand("copy");
      selection?.removeAllRanges();
      transfer.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function copyAvailabilityList() {
    const element = availabilityListRef.current;
    if (!element) return;
    const rich = prepareRichHtmlForGmail(element);
    const richDocument = `<!doctype html><html><head><meta charset="utf-8"></head><body>${rich}</body></html>`;
    const plain = element.innerText;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([richDocument], { type: "text/html;charset=utf-8" }),
          "text/plain": new Blob([plain], { type: "text/plain;charset=utf-8" }),
        }),
      ]);
    } catch {
      const transfer = document.createElement("div");
      transfer.style.position = "fixed";
      transfer.style.left = "-10000px";
      transfer.innerHTML = rich;
      document.body.appendChild(transfer);
      const range = document.createRange();
      range.selectNodeContents(transfer);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.execCommand("copy");
      selection?.removeAllRanges();
      transfer.remove();
    }
    setAvailabilityListCopied(true);
    window.setTimeout(() => setAvailabilityListCopied(false), 1600);
  }

  return (
    <main>
      <header className="topbar">
        <div className="brand"><span className="brandMark" aria-hidden="true" /><span>BBK Bunken</span></div>
        <div className="topActions">
          <div className="languageSwitch" aria-label="Interface language">
            {LANGUAGES.map((item) => (
              <button key={item} className={lang === item ? "active" : ""} onClick={() => changeLanguage(item)}>
                {LANGUAGE_LABELS[item]}
              </button>
            ))}
          </div>
          <button
            className={`languageLinkButton${languageLinkCopied ? " copied" : ""}`}
            onClick={copyLanguageLink}
            title={languageLinkCopied ? t.languageLinkCopied : t.copyLanguageLink}
            aria-label={languageLinkCopied ? t.languageLinkCopied : t.copyLanguageLink}
          >{languageLinkCopied ? "✓" : "↗"}</button>
          <div className="headerHint">{t.headerHint}</div>
        </div>
      </header>

      <section className="hero">
        <div className="sponsorWall" aria-hidden="true">
          <div className="sponsorPoster sponsorPosterSapporo"><img src="/sponsor-sapporo.webp" alt="" /></div>
          <div className="sponsorPoster sponsorPosterYebisu"><img src="/sponsor-yebisu.webp" alt="" /></div>
          <div className="sponsorPoster sponsorPosterOrion"><img src="/sponsor-orion.webp" alt="" /></div>
          <div className="sponsorPoster sponsorPosterKirin"><img src="/sponsor-kirin.webp" alt="" /></div>
        </div>
        <div className="heroCopy">
          <h1>{t.title}</h1>
          <p className="subtitle">{t.subtitle}</p>
        </div>
      </section>

      <section className="workspace">
        <div className="panel">
          <div className="panelHead">
            <div><span className="number">01</span><b>{t.source}</b></div>
            <div className="sourceActions">
              <div className="panelCameo" aria-hidden="true">
                <span className="cameoBubble cameoBubbleOne">{t.cameoOne}</span>
                <img src="/bbk-team-cameo.png" alt="" />
                <span className="cameoBubble cameoBubbleTwo">{t.cameoTwo}</span>
              </div>
            </div>
          </div>
          <div className="sourceUtilityBar">
            <div className="sourceDiagnostics" aria-live="polite">
              {!source ? (
                <span className="diagnosticEmpty">○ {t.checkEmpty}</span>
              ) : (
                <>
                  <span className="diagnosticChip">{t.angleCount} <b>{structureCheck.angles}</b></span>
                  <span className="diagnosticChip">{t.expertCount} <b>{structureCheck.experts}</b></span>
                  <span className="diagnosticChip">{t.qaCount} <b>{structureCheck.qaPairs}</b></span>
                  <span className="diagnosticChip">{t.linkCount} <b>{structureCheck.links}</b></span>
                  <span className="diagnosticChip">{t.availabilityCount} <b>{structureCheck.availabilityProfiles}/{structureCheck.experts}</b></span>
                  <span
                    className={`diagnosticState${structureIssues.length ? " warning" : " ok"}`}
                    title={structureIssues.join(" · ")}
                  >
                    {structureIssues.length ? `⚠ ${structureIssues.join(" · ")}` : `✓ ${t.checkOk}`}
                  </span>
                </>
              )}
            </div>
            <button
              className="clearButton"
              onClick={clearSource}
              disabled={!source && richLinks.length === 0}
            >
              <span aria-hidden="true">×</span>{t.clear}
            </button>
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
          <div className="projectLeadBar">
            <div className="projectLeadLabel">
              <span>{t.aboveLinksLabel}</span>
              <small>{t.aboveLinksHint}</small>
            </div>
            <div className="projectLeadSegments" role="radiogroup" aria-label={t.aboveLinksLabel}>
              {ABOVE_LINKS_SECTIONS.map((item, index) => (
                <button
                  key={item}
                  type="button"
                  role="radio"
                  aria-checked={aboveLinksSection === item}
                  className={aboveLinksSection === item ? "active" : ""}
                  onClick={() => setAboveLinksSection(item)}
                >
                  {t.aboveLinksOptions[index]}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="standaloneAvailabilityButton"
              disabled={!availabilitySummary}
              onClick={() => setAvailabilityListOpen(true)}
            >{t.standaloneAvailability}</button>
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
            <label className="frameOption"><input type="checkbox" checked={profileFrames} onChange={(event) => changeProfileFrames(event.target.checked)} /><span>{t.profileFrames}</span></label>
            <label><input type="checkbox" checked={entityHighlights} onChange={(event) => changeEntityHighlights(event.target.checked)} /><span>{t.entityHighlight}</span></label>
          </div>
          <div
            className="manualToolbar"
            ref={editorToolbarRef}
            aria-label={t.manualEdit}
            onPointerDownCapture={preservePreviewSelection}
            onPointerUpCapture={releasePreviewSelection}
            onPointerCancel={releasePreviewSelection}
          >
            <span className="optionLabel manualToolbarLabel">{t.manualEdit}</span>
            <button
              className="editorTool editorBold"
              disabled={!source}
              title={t.bold}
              aria-label={t.bold}
              onClick={() => applyPreviewFormatting("bold")}
            >B</button>
            <button
              className="editorTool editorRegular"
              disabled={!source}
              title={t.normal}
              aria-label={t.normal}
              onClick={() => applyPreviewFormatting("regular")}
            >Aa</button>
            <button
              className="editorTool editorUnderline"
              disabled={!source}
              title={t.underline}
              aria-label={t.underline}
              onClick={() => applyPreviewFormatting("underline")}
            >U</button>
            <span className="editorDivider" aria-hidden="true" />
            <button
              className={`editorTool editorColorTool${activeEditorPalette === "text" ? " active" : ""}`}
              disabled={!source}
              title={t.textColor}
              aria-label={t.textColor}
              onClick={() => {
                setActiveEditorPalette((current) => current === "text" ? null : "text");
              }}
            >
              <span className="editorColorLetter">A</span>
              <span className="editorColorLine" style={{ background: editorTextColor }} />
            </button>
            <button
              className={`editorTool editorHighlightTool${activeEditorPalette === "highlight" ? " active" : ""}`}
              disabled={!source}
              title={t.highlightColor}
              aria-label={t.highlightColor}
              onClick={() => {
                setActiveEditorPalette((current) => current === "highlight" ? null : "highlight");
              }}
            >
              <span style={{ background: editorHighlightColor }}>A</span>
            </button>
            <button
              className="editorTool editorClearFormat"
              disabled={!source}
              title={t.clearFormatting}
              aria-label={t.clearFormatting}
              onClick={() => applyPreviewFormatting("removeFormat")}
            >T×</button>
            <span className="editorDivider" aria-hidden="true" />
            <button
              className="editorTool editorHistoryButton"
              disabled={!editorHistoryState.canUndo}
              title={t.undo}
              aria-label={t.undo}
              onClick={() => stepPreviewHistory(-1)}
            >↶</button>
            <button
              className="editorTool editorHistoryButton"
              disabled={!editorHistoryState.canRedo}
              title={t.redo}
              aria-label={t.redo}
              onClick={() => stepPreviewHistory(1)}
            >↷</button>
            <span className="editorHint">{t.editHint}</span>

            {activeEditorPalette && (
              <div className="editorPalette" role="dialog" aria-label={t.textColor}>
                <div className="editorPaletteSection">
                  <div className="editorPaletteHeading">
                    <span>{t.textColor}</span>
                    <label className="customColorPicker" title={t.customColor}>
                      <span>＋</span>
                      <input
                        type="color"
                        value={editorTextColor}
                        aria-label={`${t.textColor} ${t.customColor}`}
                        onChange={(event) => applyPreviewFormatting("foreColor", event.target.value, "text")}
                      />
                    </label>
                  </div>
                  <div className="editorColorGrid">
                    {TEXT_COLOR_CHOICES.map((color) => (
                      <button
                        key={`text-${color}`}
                        className={`colorSwatch${editorTextColor === color ? " selected" : ""}`}
                        style={{ background: color }}
                        title={color}
                        aria-label={`${t.textColor} ${color}`}
                        onClick={() => applyPreviewFormatting("foreColor", color, "text")}
                      />
                    ))}
                  </div>
                </div>
                <div className="editorPaletteSection">
                  <div className="editorPaletteHeading">
                    <span>{t.highlightColor}</span>
                    <label className="customColorPicker" title={t.customColor}>
                      <span>＋</span>
                      <input
                        type="color"
                        value={editorHighlightColor}
                        aria-label={`${t.highlightColor} ${t.customColor}`}
                        onChange={(event) => applyPreviewFormatting("highlight", event.target.value, "highlight")}
                      />
                    </label>
                  </div>
                  <div className="editorColorGrid">
                    {HIGHLIGHT_COLOR_CHOICES.map((color) => (
                      <button
                        key={`highlight-${color}`}
                        className={`colorSwatch${editorHighlightColor === color ? " selected" : ""}`}
                        style={{ background: color }}
                        title={color}
                        aria-label={`${t.highlightColor} ${color}`}
                        onClick={() => applyPreviewFormatting("highlight", color, "highlight")}
                      />
                    ))}
                  </div>
                  <button
                    className="removeHighlightButton"
                    onClick={() => applyPreviewFormatting("highlight", "transparent", "highlight")}
                  >{t.removeHighlight}</button>
                </div>
              </div>
            )}
          </div>
          <div
            ref={previewRef}
            className={`preview style-${effectiveStyle}`}
            role="region"
            aria-label={t.result}
            onScroll={(event) => {
              previewScrollTopRef.current = event.currentTarget.scrollTop;
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </section>

      {availabilityListOpen && (
        <div className="availabilityModalBackdrop" role="presentation" onMouseDown={() => setAvailabilityListOpen(false)}>
          <section
            className="availabilityModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="availability-list-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="availabilityModalHead">
              <div>
                <h2 id="availability-list-title">{t.availabilityListTitle}</h2>
                <p>{t.availabilityListHint}</p>
              </div>
              <button type="button" className="availabilityModalClose" onClick={() => setAvailabilityListOpen(false)} aria-label={t.close}>×</button>
            </div>
            <div
              ref={availabilityListRef}
              className="availabilityListPreview"
              contentEditable
              suppressContentEditableWarning
              dangerouslySetInnerHTML={{ __html: availabilitySummaryHtml }}
            />
            <div className="availabilityModalActions">
              <label className="includeAvailabilityOption">
                <input
                  type="checkbox"
                  checked={standaloneAvailability}
                  onChange={(event) => {
                    setStandaloneAvailability(event.target.checked);
                    if (event.target.checked) setAboveLinksSection("availability");
                  }}
                />
                <span>{t.includeAvailabilityInEmail}</span>
              </label>
              <button type="button" className="availabilityCopyButton" onClick={copyAvailabilityList}>
                {availabilityListCopied ? t.copied : t.copyAvailabilityList}
              </button>
            </div>
          </section>
        </div>
      )}

      <footer>
        <span>{t.foot1}</span>
        <span>{t.foot2}</span>
      </footer>
    </main>
  );
}
