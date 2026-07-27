const EN_WEEKDAY =
  "(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Tues|Wed|Thu|Thur|Thurs|Fri|Sat|Sun)";
const JA_WEEKDAY = "(?:月|火|水|木|金|土|日)(?:曜日)?";
const ZH_WEEKDAY = "(?:(?:星期|周|週)[一二三四五六日天])";
const WEEKDAY_START_RE = new RegExp(
  `^(?:${EN_WEEKDAY}\\b|${JA_WEEKDAY}(?:曜)?|${ZH_WEEKDAY})`,
  "i",
);
const DATE_WITH_WEEKDAY_RE = new RegExp(
  `^(?:\\d{1,2}[/-]\\d{1,2}|\\d{1,2}月\\d{1,2}日|\\d{4}[/-]\\d{1,2}[/-]\\d{1,2}).{0,12}(?:${EN_WEEKDAY}|${JA_WEEKDAY}|${ZH_WEEKDAY})`,
  "i",
);

const TIME_TOKEN_SOURCE =
  "(?:(?:上午|下午|早上|晚上|午前|午後)\\s*)?(?:[01]?\\d|2[0-3])[:：]\\d{2}(?:\\s*(?:AM|PM|am|pm))?";
const TIME_TOKEN_RE = new RegExp(TIME_TOKEN_SOURCE, "g");
const TIME_RANGE_RE = new RegExp(
  `${TIME_TOKEN_SOURCE}\\s*(?:-|–|—|~|〜|～|to|至|到)\\s*${TIME_TOKEN_SOURCE}`,
  "i",
);

export function isAvailabilityLine(line) {
  const value = line.trim();
  if (!value || !TIME_RANGE_RE.test(value)) return false;
  return WEEKDAY_START_RE.test(value) || DATE_WITH_WEEKDAY_RE.test(value);
}

export function isUnavailableAvailabilityLine(line) {
  return /^(?:This\s+(?:specialist|expert)\s+has\s+not\s+yet\s+provided\s+(?:any\s+)?availability|No\s+availability\s+(?:has\s+been\s+)?provided|まだ(?:面談可能時間|対応可能時間|アベイラビリティ).*(?:未提供|ありません|ない)|(?:尚未|暂未|暫未).*(?:提供|确认|確認).*(?:可访谈时间|可訪談時間|可用时间|可用時間|时间|時間))[\s.。]*$/i.test(
    line.trim(),
  );
}

export function emphasizeAvailabilityTimes(html) {
  return html.replace(
    TIME_TOKEN_RE,
    (time) => `<strong style="font-weight:800">${time}</strong>`,
  );
}
