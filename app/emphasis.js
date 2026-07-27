const HTML_TOKEN_OPEN = "\uE000";
const HTML_TOKEN_CLOSE = "\uE001";
const MARK_TOKEN_OPEN = "\uE100";
const MARK_TOKEN_CLOSE = "\uE101";

function token(index, open, close) {
  return `${open}${index}${close}`;
}

function restoreTokens(text, values, open, close) {
  const pattern = new RegExp(`${open}(\\d+)${close}`, "g");
  return text.replace(pattern, (_, index) => values[Number(index)] ?? "");
}

function applyEmphasis(html, color, scope, includeEntities = true, decoration = {}) {
  const htmlTags = [];
  const marks = [];
  let output = html.replace(/<[^>]+>/g, (tag) => {
    const index = htmlTags.push(tag) - 1;
    return token(index, HTML_TOKEN_OPEN, HTML_TOKEN_CLOSE);
  });

  const mark = (value, weight = 700) => {
    const resolvedColor = decoration.color ?? color;
    const resolvedWeight = decoration.weight ?? weight;
    const background = decoration.background
      ? `;background:${decoration.background};padding:0 2px;border-radius:2px`
      : "";
    const underline = decoration.underline
      ? `;text-decoration:underline;text-decoration-color:${resolvedColor};text-underline-offset:2px`
      : "";
    const index = marks.push(
      `<span style="color:${resolvedColor};font-weight:${resolvedWeight}${background}${underline}">${value}</span>`,
    ) - 1;
    return token(index, MARK_TOKEN_OPEN, MARK_TOKEN_CLOSE);
  };

  const markMatch = (pattern, weight = 700) => {
    output = output.replace(pattern, (value) => mark(value, weight));
  };

  if (includeEntities) {
    // English company names with a legal or descriptive suffix.
    markMatch(
      /\b[A-Z][A-Za-z0-9&'’.\-]*(?:\s+[A-Z][A-Za-z0-9&'’.\-]*){0,5}\s+(?:Inc\.?|Corp(?:oration)?\.?|LLC|PLC|Limited|Ltd\.?|Holdings?|Group|Technolog(?:y|ies)|Systems?|Motors?|Bank|Airlines?|Industries|Solutions|Partners)\b/g,
    );

    // English brand names in Japanese prose and comma-separated company lists.
    markMatch(
      /\b[A-Z][A-Za-z0-9&'’.\-]{1,}(?:\s+[A-Z][A-Za-z0-9&'’.\-]{1,}){0,3}(?=\s*(?:にて|では|において|へ転職|へ入社))/g,
    );
    markMatch(
      /\b[A-Z][A-Za-z0-9&'’.\-]{2,}(?=\s*(?:、|，|,\s*[A-Z]|等(?:にて|で)|など(?:にて|で)))/g,
    );

    // English companies following an employment or relationship preposition.
    output = output.replace(
      /\b(at|from|with|within|for)\s+([A-Z][A-Za-z0-9&'’.\-]*(?:\s+[A-Z][A-Za-z0-9&'’.\-]*){0,5})(?=\s*(?:[,(;]|$|にて|では|で))/g,
      (_, prefix, company) => `${prefix} ${mark(company)}`,
    );

    // Chinese companies, including names in prose and company lists.
    output = output.replace(
      /(曾任职于|现任职于|任职于|就职于|来自|在|于)([\u3400-\u9fffA-Za-z0-9（）()]{2,40}?(?:股份有限公司|有限责任公司|有限公司|控股集团|集团公司))/g,
      (_, prefix, company) => `${prefix}${mark(company)}`,
    );
    output = output.replace(
      /(^|[\s，。；、;：（(])([\u3400-\u9fffA-Za-z0-9（）()]{2,40}?(?:股份有限公司|有限责任公司|有限公司|控股集团|集团公司))/g,
      (_, prefix, company) => `${prefix}${mark(company)}`,
    );
    output = output.replace(
      /(曾任职于|现任职于|任职于|就职于|来自|在|于)([\u3400-\u9fff]{2,24}?(?:集团|控股|科技股份|科技|技术|电子|汽车|银行|证券|保险|能源|医药))(?![\u3400-\u9fff（）()]{0,16}(?:股份有限公司|有限责任公司|有限公司|集团公司))/g,
      (_, prefix, company) => `${prefix}${mark(company)}`,
    );
    output = output.replace(
      /(^|[\s，。；、;：（(])([\u3400-\u9fff]{2,24}?(?:集团|控股|科技股份|科技|技术|电子|汽车|银行|证券|保险|能源|医药))(?![\u3400-\u9fff（）()]{0,16}(?:股份有限公司|有限责任公司|有限公司|集团公司))/g,
      (_, prefix, company) => `${prefix}${mark(company)}`,
    );

    // Japanese companies with common corporate suffixes.
    output = output.replace(
      /(^|[、。；;（(]\s*|より|から|現在|元|前)([\u3400-\u9fffァ-ヶー]{2,24}?(?:株式会社|自動車|電機|製作所|グループ|工業|製鋼所|銀行|証券|保険|航空|鉄道|商事|化学|システムズ|テクノロジーズ))/g,
      (_, prefix, company) => `${prefix}${mark(company)}`,
    );

    // Employment status and seniority work in profile headers, introductions and Q&A.
    markMatch(
      /\b(?:Global Head of Procurement|Chief [A-Za-z&/\- ]{2,35} Officer|Executive Vice President|Senior Vice President|Vice President|Managing Director|General Manager|Project Manager|Senior Director|Director|Manager|Head of [A-Za-z&/\- ]{2,35}|Consultant|Engineer|Current|Former|Present|CEO|CFO|COO|CTO|EVP|SVP|VP)\b/gi,
    );
    markMatch(
      /(?:代表取締役|取締役|執行役員|本部長|部長|課長|責任者|プロジェクトマネージャー|マネージャー|ディレクター|コンサルタント|エンジニア|現職|現任|元職)/g,
    );
    markMatch(
      /(?:董事长|首席执行官|首席财务官|总裁|副总裁|总经理|副总经理|总监|负责人|项目经理|经理|主管|顾问|工程师|现任|曾任|前任)/g,
    );
  }

  if (scope === "intro" || scope === "qa") {
    // Dates, tenure and experience quantities across Chinese, Japanese and English.
    markMatch(
      /(?:\b(?:19|20)\d{2}(?:[/-]\d{1,2})?\b(?:年)?|\b\d{1,2}\+?\s*(?:years?|yrs?)\b|\d{1,2}\+?\s*年(?:以上|超)?)/gi,
    );
  }

  if (scope === "intro") {
    // Cross-industry responsibility, capability and achievement language.
    markMatch(
      /\b(?:directly involved in|responsible for|in charge of|extensive experience|deep expertise|broad knowledge|leads?|leading|led|manages?|managing|managed|oversees?|overseeing|oversaw|heads?|headed|directs?|directed|develops?|developing|developed|designs?|designed|implements?|implemented|launches?|launched|builds?|built|establishes?|established|evaluates?|evaluated|selects?|selected|procures?|procured|negotiates?|negotiated|optimizes?|optimized|reduces?|reduced|improves?|improved|expands?|expanded|delivers?|delivered|achieves?|achieved|supports?|supported|advises?|advised|partners?|partnered|collaborates?|collaborated|drives?|driving)\b/gi,
    );
    markMatch(
      /\b(?:business growth|sales operations|international markets|market expansion|customer acquisition|supply chain(?:s)?|cost reduction|product development|project delivery|team leadership|commercial strategy|go-to-market strategy)\b/gi,
    );
    markMatch(
      /(?:直接統括|統括|主導|共同開発|技術評価|材料・部品選定|量産技術|サプライチェーンの最適化|コスト削減|売上拡大|顧客獲得|提案・販売戦略|見積・提案|契約交渉|組織構築|業務改善|海外展開|新規事業|市場分析|事業戦略|販売戦略|パートナー営業|OEM営業|戦略アカウント営業|幅広い知見|深い知見|豊富な経験|長年担当|直接関与|携わった|携わっている|担当した|担当している|推進した|推進している|策定した|策定している|構築した|構築している|連携した|連携している)/g,
    );
    markMatch(
      /(?:直接参与|负责|主导|统筹|推动|制定|搭建|开发|设计|评估|采购|选型|谈判|实施|优化|降本|增长|交付|销售策略|业务拓展|供应链优化|团队建设|项目管理|客户开发|市场分析|丰富经验|深入了解|广泛经验|多年经验)/g,
    );
  }

  if (scope === "qa") {
    // Keep Q&A selective: highlight concrete scale and measurable experience.
    markMatch(
      /(?:\b\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?\s*(?:%|x|times?|projects?|cases?|markets?|countries?)\b|\d+(?:\s*[-–]\s*\d+)?\s*(?:回|件|社|カ国|名|亿元|万元|次|个|家))/gi,
    );
  }

  output = restoreTokens(output, marks, MARK_TOKEN_OPEN, MARK_TOKEN_CLOSE);
  return restoreTokens(output, htmlTags, HTML_TOKEN_OPEN, HTML_TOKEN_CLOSE);
}

export function emphasizeCompaniesText(html, color, enabled = true, decoration = {}) {
  return enabled ? applyEmphasis(html, color, "companies", true, decoration) : html;
}

export function emphasizeIntroText(html, color, includeEntities = true, decoration = {}) {
  return applyEmphasis(html, color, "intro", includeEntities, decoration);
}

export function emphasizeQaText(html, color, includeEntities = true, decoration = {}) {
  return applyEmphasis(html, color, "qa", includeEntities, decoration);
}
