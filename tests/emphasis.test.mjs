import assert from "node:assert/strict";
import test from "node:test";

import { emphasizeCompanyNamesText } from "../app/emphasis.js";

function highlightedNames(value) {
  return Array.from(
    emphasizeCompanyNamesText(value, "#e83b2e").matchAll(/<span\s+style="[^"]+">(.*?)<\/span>/g),
    (match) => match[1],
  );
}

test("recognizes common semiconductor brands and short names", () => {
  const names = highlightedNames("Former Director at TSMC | Former Manager at SK hynix | Current role at Tokyo Electron");
  assert.deepEqual(names, ["TSMC", "SK hynix", "Tokyo Electron"]);
});

test("recognizes international legal company suffixes", () => {
  const names = highlightedNames("Proya Cosmetics Co., Ltd., Siemens Energy AG and Example Manufacturing GmbH");
  assert.deepEqual(names, ["Proya Cosmetics Co., Ltd", "Siemens Energy AG", "Example Manufacturing GmbH"]);
});

test("recognizes Japanese legal prefixes and Japanese company short names", () => {
  const names = highlightedNames("株式会社キーエンス、東京エレクトロン、アドバンテスト");
  assert.deepEqual(names, ["株式会社キーエンス", "東京エレクトロン", "アドバンテスト"]);
});

test("recognizes Chinese company and technology brand names", () => {
  const names = highlightedNames("曾任职于腾讯、字节跳动、宇树科技和中芯国际");
  assert.deepEqual(names, ["腾讯", "字节跳动", "宇树科技", "中芯国际"]);
});

test("does not classify roles and common industry abbreviations as companies", () => {
  const names = highlightedNames("Former Director and Manager discuss AI, EU, US and GPU demand");
  assert.deepEqual(names, []);
});

test("keeps existing link markup intact while highlighting company names", () => {
  const html = emphasizeCompanyNamesText('<a href="https://example.com/expert">TSMC</a>', "#e83b2e");
  assert.match(html, /<a href="https:\/\/example\.com\/expert"><span[^>]*>TSMC<\/span><\/a>/);
});
