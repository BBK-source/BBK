(function () {
  'use strict';
  // Only anonymous, predefined usage events. No profile, email or search text is read.
  var MEASUREMENT_ID = 'G-H7XSR2EKTS';
  var CONSENT_KEY = 'bbk_tools_analytics_consent_v1';
  var EVENTS = { mail_copy: true, profile_parse: true, excel_export: true, tool_switch: true };
  var tool = location.pathname.indexOf('/expert-profile-excel/') >= 0 ? 'expert_excel' : 'bbk_bunken';
  var language = tool === 'expert_excel' ? 'ja' : (new URLSearchParams(location.search).get('lang') || document.documentElement.lang || 'zh').slice(0, 2);
  var labels = {
    zh: { message: '允许匿名使用统计吗？仅记录页面访问、邮件复制、Profile 解析、Excel 下载和工具切换。不会上传专家资料或邮件内容。', allow: '允许统计', reject: '不允许', settings: '统计设置', title: '使用统计' },
    ja: { message: '匿名の利用状況を記録してもよろしいですか？閲覧・コピー・解析・Excel出力・画面切替のみを集計し、専門家情報やメール本文は送信しません。', allow: '許可する', reject: '許可しない', settings: 'アクセス解析設定', title: 'アクセス解析' },
    en: { message: 'Allow anonymous usage analytics? We count page visits and tool actions only; expert profiles and email text are never sent.', allow: 'Allow', reject: 'Decline', settings: 'Analytics settings', title: 'Usage analytics' },
    ko: { message: '익명 사용 통계를 허용하시겠어요? 방문 및 도구 사용 횟수만 기록하며 전문가 정보와 이메일 내용은 전송하지 않습니다.', allow: '허용', reject: '거부', settings: '통계 설정', title: '사용 통계' }
  };
  var copy = labels[language] || labels.en;
  var choice = '';
  var started = false;
  var sentPageView = false;
  function readChoice() {
    try { return localStorage.getItem(CONSENT_KEY) || ''; } catch (err) { return ''; }
  }
  function saveChoice(value) {
    choice = value;
    try { localStorage.setItem(CONSENT_KEY, value); } catch (err) {}
  }
  function start() {
    if (started || choice !== 'yes') return;
    started = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    // Collect only deliberate events with sanitized page details; disable ad signals.
    window.gtag('config', MEASUREMENT_ID, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(MEASUREMENT_ID);
    document.head.appendChild(script);
    if (!sentPageView) {
      sentPageView = true;
      window.gtag('event', 'page_view', {
        page_title: tool === 'expert_excel' ? 'Expert Profile Excel Tool' : 'BBK Bunken',
        page_location: location.origin + location.pathname,
        page_referrer: '',
        tool: tool
      });
    }
  }
  function track(name) {
    if (!EVENTS[name] || choice !== 'yes') return;
    start();
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, {
        tool: tool,
        transport_type: 'beacon'
      });
    }
  }
  document.addEventListener('bbk:analytics', function (event) {
    var name = event && event.detail && event.detail.name;
    track(name);
  });
  document.addEventListener('click', function (event) {
    var element = event.target;
    var link = element && element.closest && element.closest('a.buddyPortal, a.excelBuddyPortal');
    if (link) track('tool_switch');
  }, true);
  function renderConsent() {
    if (!document.body) return;
    var style = document.createElement('style');
    style.textContent = [
      '#bbkAnalyticsBanner{position:fixed;z-index:100000;bottom:18px;left:50%;transform:translateX(-50%);width:min(660px,calc(100vw - 24px));background:#fff;border:1px solid #dce2e8;border-radius:15px;box-shadow:0 12px 42px rgba(25,38,56,.19);padding:16px 18px;font:13px/1.6 Arial,"Noto Sans JP",sans-serif;color:#25364a}',
      '#bbkAnalyticsBanner strong{display:block;font-size:14px;margin-bottom:4px}',
      '#bbkAnalyticsBanner p{margin:0 0 12px;color:#455769}',
      '#bbkAnalyticsBanner .bbkAnalyticsActions{display:flex;gap:8px;justify-content:flex-end}',
      '#bbkAnalyticsBanner button,#bbkAnalyticsSettings{cursor:pointer;border-radius:8px;font:600 12px Arial,"Noto Sans JP",sans-serif}',
      '#bbkAnalyticsBanner button{border:1px solid #c8d1dc;background:#fff;color:#354861;padding:9px 13px}',
      '#bbkAnalyticsBanner button.bbkAnalyticsAllow{background:#24364c;border-color:#24364c;color:#fff}',
      '#bbkAnalyticsSettings{position:fixed;z-index:99999;bottom:12px;left:12px;padding:6px 9px;border:1px solid #dee3ea;background:rgba(255,255,255,.95);color:#64748b;font-size:10px;box-shadow:0 2px 8px rgba(0,0,0,.05)}',
      '@media(max-width:520px){#bbkAnalyticsBanner{bottom:10px;padding:13px}#bbkAnalyticsBanner .bbkAnalyticsActions{justify-content:stretch}#bbkAnalyticsBanner button{flex:1}}'
    ].join('');
    document.head.appendChild(style);
    var settings = document.createElement('button');
    settings.id = 'bbkAnalyticsSettings';
    settings.type = 'button';
    settings.textContent = copy.settings;
    document.body.appendChild(settings);
    var banner = document.createElement('div');
    banner.id = 'bbkAnalyticsBanner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', copy.title);
    var title = document.createElement('strong');
    title.textContent = copy.title;
    var message = document.createElement('p');
    message.textContent = copy.message;
    var actions = document.createElement('div');
    actions.className = 'bbkAnalyticsActions';
    var reject = document.createElement('button');
    reject.type = 'button';
    reject.textContent = copy.reject;
    var allow = document.createElement('button');
    allow.type = 'button';
    allow.className = 'bbkAnalyticsAllow';
    allow.textContent = copy.allow;
    actions.appendChild(reject);
    actions.appendChild(allow);
    banner.appendChild(title);
    banner.appendChild(message);
    banner.appendChild(actions);
    document.body.appendChild(banner);
    function hide() { banner.style.display = 'none'; }
    settings.addEventListener('click', function () { banner.style.display = 'block'; });
    reject.addEventListener('click', function () {
      saveChoice('no');
      hide();
      // If consent is withdrawn on this page, do not emit any further events.
      if (typeof window.gtag === 'function') window.gtag('consent', 'update', { analytics_storage: 'denied' });
    });
    allow.addEventListener('click', function () {
      saveChoice('yes');
      hide();
      if (started && typeof window.gtag === 'function') window.gtag('consent', 'update', { analytics_storage: 'granted' });
      start();
    });
    if (choice === 'yes') { hide(); start(); }
    else if (choice === 'no') hide();
  }
  choice = readChoice();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderConsent);
  else renderConsent();
})();