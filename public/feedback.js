(function () {
  'use strict';
  // BBK Tools: one simple thumbs-up button per tool, without a comment form.
  // The like is recorded as an anonymous GA4 feedback_like event only.
  var tool = location.pathname.indexOf('/expert-profile-excel/') >= 0 ? 'expert_excel' : 'bbk_bunken';
  var language = tool === 'expert_excel' ? 'ja' :
    (new URLSearchParams(location.search).get('lang') || document.documentElement.lang || 'zh').slice(0, 2);
  var words = {
    zh: ['给小狗点个赞', '已点赞！谢谢 💛'],
    ja: ['いいね！', 'いいね済み 💛'],
    en: ['Like this tool', 'Liked, thank you! 💛'],
    ko: ['좋아요!', '좋아요 완료 💛']
  };
  var labels = words[language] || words.en;
  var localKey = 'bbk_feedback_liked_' + tool;
  var liked = false;
  try { liked = localStorage.getItem(localKey) === '1'; } catch (error) {}

  function render() {
    if (document.getElementById('bbk-feedback-like')) return true;
    var mascot = document.querySelector('.topbar .brandMark img') ||
                 document.querySelector('header img.mascot');
    if (!mascot || !document.body) return false;

    var style = document.createElement('style');
    style.textContent =
      '.bbkLike{position:absolute;z-index:120;display:flex;align-items:center;justify-content:center;' +
      'height:43px;width:47px;border:1px solid #e8d8be;border-radius:25px;' +
      'background:#fff9ee;box-shadow:0 4px 13px rgba(22,34,50,.13);' +
      'cursor:pointer;font-size:22px;transition:transform .15s,box-shadow .15s;}' +
      '.bbkLike:hover{transform:translateY(-2px) rotate(-5deg);box-shadow:0 7px 17px rgba(22,34,50,.18)}' +
      '.bbkLike:focus-visible{outline:3px solid #82aed1;outline-offset:2px}' +
      '.bbkLike[aria-pressed=true]{background:#fff1d8;border-color:#f1cd89}' +
      '@media(max-width:580px){.bbkLike{height:36px;width:39px;font-size:19px}}' +
      '@media(prefers-reduced-motion:reduce){.bbkLike{transition:none}.bbkLike:hover{transform:none}}';
    document.head.appendChild(style);

    var button = document.createElement('button');
    button.id = 'bbk-feedback-like';
    button.className = 'bbkLike';
    button.type = 'button';
    button.textContent = liked ? '💛' : '👍';
    button.setAttribute('aria-label', liked ? labels[1] : labels[0]);
    button.setAttribute('title', liked ? labels[1] : labels[0]);
    button.setAttribute('aria-pressed', liked ? 'true' : 'false');
    document.body.appendChild(button);

    function position() {
      var rect = mascot.getBoundingClientRect();
      var buttonWidth = button.getBoundingClientRect().width || 47;
      var left = rect.right + window.scrollX - buttonWidth * .35;
      button.style.left = Math.max(8, Math.min(left, document.documentElement.scrollWidth - buttonWidth - 8)) + 'px';
      button.style.top = Math.max(8, rect.bottom + window.scrollY - 52) + 'px';
    }
    position();
    window.addEventListener('resize', position);
    window.addEventListener('load', position);
    button.addEventListener('click', function () {
      if (liked) return;
      liked = true;
      try { localStorage.setItem(localKey, '1'); } catch (error) {}
      button.textContent = '💛';
      button.setAttribute('aria-pressed', 'true');
      button.setAttribute('aria-label', labels[1]);
      button.setAttribute('title', labels[1]);
      document.dispatchEvent(new CustomEvent('bbk:analytics', { detail: { name: 'feedback_like' } }));
    });
    return true;
  }

  if (!render()) {
    var observer = new MutationObserver(function () {
      if (render()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', render, { once: true });
  }
})();