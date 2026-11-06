(function () {
  'use strict';
  // BBK tools GA4: automatic page analytics plus predefined, non-content events.
  // Never read or transmit expert profiles, email text, filenames, or search queries.
  var MEASUREMENT_ID = 'G-H7XSR2EKTS';
  var EVENTS = { mail_copy: true, profile_parse: true, excel_export: true, tool_switch: true };
  var tool = location.pathname.indexOf('/expert-profile-excel/') >= 0 ? 'expert_excel' : 'bbk_bunken';
  var pageName = tool === 'expert_excel' ? 'Expert Profile Excel Tool' : 'BBK Bunken';
  var safePageLocation = location.origin + location.pathname;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', MEASUREMENT_ID, {
    send_page_view: false,
    page_location: safePageLocation,
    page_referrer: '',
    page_title: pageName,
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });

  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(MEASUREMENT_ID);
  document.head.appendChild(script);

  window.gtag('event', 'page_view', {
    page_title: pageName,
    page_location: safePageLocation,
    page_referrer: '',
    tool: tool
  });

  function track(name) {
    if (!EVENTS[name]) return;
    window.gtag('event', name, {
      tool: tool,
      page_location: safePageLocation,
      page_referrer: '',
      transport_type: 'beacon'
    });
  }

  document.addEventListener('bbk:analytics', function (event) {
    track(event && event.detail && event.detail.name);
  });
  document.addEventListener('click', function (event) {
    var element = event.target;
    var link = element && element.closest && element.closest('a.buddyPortal, a.excelBuddyPortal');
    if (link) track('tool_switch');
  }, true);
})();