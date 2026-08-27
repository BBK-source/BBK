const HTML_TOKEN_OPEN = "\uE000";
const HTML_TOKEN_CLOSE = "\uE001";
const MARK_TOKEN_OPEN = "\uE100";
const MARK_TOKEN_CLOSE = "\uE101";

const KNOWN_COMPANIES = [
  "Applied Materials", "Tokyo Electron", "Lam Research", "GlobalFoundries",
  "Taiwan Semiconductor Manufacturing Company", "SK hynix", "SK Hynix",
  "Samsung Electronics", "Samsung Semiconductor", "Micron Technology",
  "Intel Foundry", "Intel", "TSMC", "ASE Technology", "ASE", "Amkor",
  "JCET", "SPIL", "PTI", "ChipMOS", "Renesas", "Kioxia", "Advantest",
  "ASML", "KLA", "SCREEN", "DISCO", "ACCETECH", "ACCRETECH", "ASMPT",
  "BESI", "BE Semiconductor Industries", "Hanmi Semiconductor", "Hanmi",
  "TOWA", "Fasford", "Shinkawa", "APIC Yamada", "SEMES", "K&amp;S", "K&S",
  "Qualcomm", "Broadcom", "NVIDIA", "AMD", "MediaTek", "Foxconn",
  "Hon Hai", "Pegatron", "Quanta", "Wistron", "Inventec", "SMIC",
  "Apple", "Google Cloud", "Google", "Microsoft", "Amazon Web Services",
  "Amazon", "AWS", "Oracle", "OpenAI", "Anthropic", "Meta", "IBM",
  "Salesforce", "SAP", "Palantir", "SoftBank", "NTT DATA", "NTT",
  "Tencent Games", "Tencent", "NetEase Games", "NetEase", "Alibaba Cloud",
  "Alibaba", "ByteDance", "Baidu", "Huawei", "Xiaomi", "Bilibili",
  "miHoYo", "HoYoverse", "Nexon", "NCSoft", "Krafton", "Pearl Abyss",
  "Bandai Namco", "Nintendo", "Sega", "Capcom", "Konami", "Square Enix",
  "Riot Games", "Epic Games", "Ubisoft", "Activision Blizzard", "Electronic Arts",
  "Siemens Energy", "Siemens", "Schneider Electric", "Johnson Controls",
  "Mitsubishi Electric", "Mitsubishi Heavy Industries", "Hitachi", "Fujitsu",
  "Panasonic", "Sony", "Denso", "Toyota", "Honda", "Bosch", "BYD", "CATL",
  "Bloom Energy", "Ceres Power", "Ceres", "Sunfire", "Topsoe", "Höganäs",
  "Equinix", "Digital Realty", "MC Digital Realty", "CBRE", "Azbil", "JERA",
  "Unitree Robotics", "Unitree", "DeepSeek", "SiliconFlow", "DataCanvas",
  "Infinigence", "AutoDL", "Proya Cosmetics", "Proya", "Nivea", "Shiseido",
  "L’Oréal", "L'Oreal", "Estée Lauder", "Unicharm", "Kao", "P&G",
  "BCG", "Boston Consulting Group", "McKinsey", "Bain", "Deloitte", "PwC",
  "東京エレクトロン", "アドバンテスト", "キオクシア", "ルネサス",
  "ソニーセミコンダクタソリューションズ", "ソニー", "パナソニック",
  "三菱電機", "三菱重工業", "日立製作所", "富士通", "デンソー", "トヨタ",
  "日本特殊陶業", "東芝エネルギーシステムズ", "東芝", "シュナイダーエレクトリック",
  "ジョンソンコントロールズ", "アズビル", "新菱冷熱", "ジャパンマテリアル",
  "大成建設", "大林組", "オルガノ", "アルバック", "芝浦メカトロニクス",
  "ファスフォード", "キーエンス", "ミスミ", "ベネッセ", "リクルート",
  "腾讯游戏", "腾讯", "网易游戏", "网易", "阿里巴巴", "阿里云", "字节跳动",
  "华为", "百度", "小米", "比亚迪", "宁德时代", "台积电", "中芯国际",
  "长电科技", "通富微电", "华天科技", "立讯精密", "生益科技", "安集科技",
  "鼎龙股份", "江化微", "华海诚科", "德邦科技", "宇树科技", "宇树机器人",
  "硅基流动", "寒武纪", "地平线", "蔚来", "理想汽车", "小鹏汽车",
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const KNOWN_COMPANY_RE = new RegExp(
  `(?<![A-Za-z0-9])(?:${KNOWN_COMPANIES
    .slice()
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|")})(?![A-Za-z0-9])`,
  "giu",
);

const NON_COMPANY_EMPLOYMENT_TARGET =
  /^(?:AI|EU|UK|US|USA|APAC|EMEA|GPU|HBM|OEM|OSAT|IDM|R&D|QA|Current|Former|Present|Global|International)$/i;

function token(index, open, close) {
  return `${open}${index}${close}`;
}

function restoreTokens(text, values, open, close) {
  const pattern = new RegExp(`${open}(\\d+)${close}`, "g");
  return text.replace(pattern, (_, index) => values[Number(index)] ?? "");
}

function normalizeCompanyValue(value) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

function customCompanyPattern(companies) {
  const values = companies
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;"))
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp);
  if (values.length === 0) return null;
  return new RegExp(`(?<![A-Za-z0-9])(?:${values.join("|")})(?![A-Za-z0-9])`, "giu");
}

function applyEmphasis(
  html,
  color,
  scope,
  includeEntities = true,
  decoration = {},
  includeRoles = true,
  customCompanies = [],
  blockedCompanies = [],
) {
  const htmlTags = [];
  const marks = [];
  const blockedCompanySet = new Set(blockedCompanies.map(normalizeCompanyValue).filter(Boolean));
  let output = html.replace(/<[^>]+>/g, (tag) => {
    const index = htmlTags.push(tag) - 1;
    return token(index, HTML_TOKEN_OPEN, HTML_TOKEN_CLOSE);
  });

  const mark = (value, weight = 700) => {
    const blocked = blockedCompanySet.has(normalizeCompanyValue(value));
    const resolvedColor = decoration.color ?? color;
    const resolvedWeight = decoration.weight ?? weight;
    const background = decoration.background
      ? `;background:${decoration.background};padding:0 2px;border-radius:2px`
      : "";
    const underline = decoration.underline
      ? `;text-decoration:underline;text-decoration-color:${resolvedColor};text-underline-offset:2px`
      : "";
    const index = marks.push(blocked
      ? value
      : `<span style="color:${resolvedColor};font-weight:${resolvedWeight}${background}${underline}">${value}</span>`) - 1;
    return token(index, MARK_TOKEN_OPEN, MARK_TOKEN_CLOSE);
  };

  const markMatch = (pattern, weight = 700) => {
    output = output.replace(pattern, (value) => mark(value, weight));
  };

  if (includeEntities) {
    // Personal corrections run first. Tokens protect both learned companies and
    // explicit false positives from being reprocessed by the broader rules.
    const personalCompanyRe = customCompanyPattern(customCompanies);
    if (personalCompanyRe) markMatch(personalCompanyRe);

    // English and European legal names, including Co., Ltd., GmbH, AG and Pte Ltd.
    markMatch(
      /\b[A-Z][A-Za-z0-9&'’.\-]*(?:\s+(?:&|of|[A-Z][A-Za-z0-9&'’.\-]*)){0,6}(?:,\s*|\s+)(?:Co\.,?\s*(?:Ltd\.?|Limited)|Co\.?\s+Ltd\.?|Incorporated|Inc\.?|Corporation|Corp\.?|L\.L\.C\.?|LLC|P\.L\.C\.?|PLC|Limited|Ltd\.?|GmbH(?:\s*&\s*Co\.?\s*KG)?|AG|SE|KG|B\.V\.?|BV|N\.V\.?|NV|S\.A\.S\.?|SAS|S\.p\.A\.?|S\.A\.?|Pte\.?\s*Ltd\.?|K\.K\.?|Holdings?|Group|Technolog(?:y|ies)|Systems?|Motors?|Bank|Airlines?|Industries|Solutions|Partners|Semiconductors?|Electronics|Electric|Energy|Materials|Pharmaceuticals|Robotics|Capital|Ventures|Consulting)\b/g,
    );

    // Japanese corporate prefixes are otherwise easy to miss because the
    // legal designator comes before the actual company name.
    markMatch(
      /(?:株式会社|有限会社|合同会社|（株）|\(株\)|㈱)[\u3400-\u9fffァ-ヶーA-Za-z0-9・&.]{2,32}/g,
    );

    // Established short names and brands across semiconductor, technology,
    // energy, industrial, gaming and consumer sectors.
    markMatch(KNOWN_COMPANY_RE);

    // English brand names in Japanese prose and comma-separated company lists.
    markMatch(
      /\b[A-Z][A-Za-z0-9&'’.\-]{1,}(?:\s+[A-Z][A-Za-z0-9&'’.\-]{1,}){0,3}(?=\s*(?:にて|では|において|へ転職|へ入社))/g,
    );
    markMatch(
      /\b[A-Z][A-Za-z0-9&'’.\-]{2,}(?=\s*(?:、|，|,\s*[A-Z]|等(?:にて|で)|など(?:にて|で)))/g,
    );

    // English companies following an employment or relationship preposition.
    output = output.replace(
      /\b(at|from|with|within|for|joined)\s+([A-Z][A-Za-z0-9&'’.\-]*(?:\s+(?:&|of|[A-Z][A-Za-z0-9&'’.\-]*)){0,5})(?=\s*(?:[,(;|]|$|にて|では|で))/g,
      (value, prefix, company) => {
        if (NON_COMPANY_EMPLOYMENT_TARGET.test(company)) return value;
        if (/\b(?:Director|Manager|Officer|Engineer|Consultant|President|Advisor|Analyst|Assistant|Specialist|Executive)\b/i.test(company)) {
          return value;
        }
        return `${prefix} ${mark(company)}`;
      },
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

    // Japanese companies with common corporate and industry suffixes.
    output = output.replace(
      /(^|[、。；;（(]\s*|より|から|現在|元|前)([\u3400-\u9fffァ-ヶー]{2,28}?(?:株式会社|自動車|電機|製作所|グループ|工業|製鋼所|銀行|証券|保険|航空|鉄道|商事|化学|システムズ|テクノロジーズ|半導体|エレクトロニクス|エナジー|ソリューションズ|製薬|製鉄|ホールディングス|ファシリティーズ|不動産|建設|化粧品|ロボティクス))/g,
      (_, prefix, company) => `${prefix}${mark(company)}`,
    );

    if (includeRoles) {
      // Employment status and seniority work in introductions and Q&A.
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

export function emphasizeCompaniesText(html, color, enabled = true, decoration = {}, customCompanies = [], blockedCompanies = []) {
  return enabled
    ? applyEmphasis(html, color, "companies", true, decoration, true, customCompanies, blockedCompanies)
    : html;
}

export function emphasizeCompanyNamesText(html, color, enabled = true, decoration = {}, customCompanies = [], blockedCompanies = []) {
  return enabled
    ? applyEmphasis(html, color, "companies", true, decoration, false, customCompanies, blockedCompanies)
    : html;
}

export function emphasizeIntroText(html, color, includeEntities = true, decoration = {}, customCompanies = [], blockedCompanies = []) {
  return applyEmphasis(html, color, "intro", includeEntities, decoration, true, customCompanies, blockedCompanies);
}

export function emphasizeQaText(html, color, includeEntities = true, decoration = {}, customCompanies = [], blockedCompanies = []) {
  return applyEmphasis(html, color, "qa", includeEntities, decoration, true, customCompanies, blockedCompanies);
}
