(function () {
  'use strict';
  // Both BBK tools share this small feedback interface.
  // Likes -> GA4 anonymous aggregate event. Free-text comments -> never GA4.
  // Configure a Google Form respondent URL before accepting written feedback.
  var FORM_URL = '';
  var tool = location.pathname.indexOf('/expert-profile-excel/') >= 0 ? 'expert_excel' : 'bbk_bunken';
  var language = tool === 'expert_excel' ? 'ja' :
    (new URLSearchParams(location.search).get('lang') || document.documentElement.lang || 'zh').slice(0, 2);
  var words = {
    zh: { like:'喜欢！',liked:'已点赞',comment:'提建议',header:'给小狗一点反馈 🐶',category:'意见类型',body:'你的意见或改进建议',placeholder:'哪里好用？哪里可以改进？欢迎告诉我们～',copy:'复制建议',form:'打开表单发送',copied:'建议已复制。请粘贴到你希望发送的地方。',fail:'无法自动复制，请手动选中并复制。',pending:'文字建议尚未接入收集表单，目前仅可复制，不会自动发送。',empty:'先写一点建议吧！',note:'请不要填写客户、专家或其他机密资料。',close:'关闭',label:['功能建议','遇到问题','界面体验','其他'] },
    ja: { like:'いいね！',liked:'いいね済み',comment:'ご意見',header:'ワンちゃんにフィードバック 🐶',category:'ご意見の種類',body:'改善案・コメント',placeholder:'使いやすい点や、改善してほしい点を教えてください。',copy:'コメントをコピー',form:'フォームから送信',copied:'コメントをコピーしました。送信先へ貼り付けてください。',fail:'コピーできませんでした。手動でコピーしてください。',pending:'ご意見の送信先は準備中です。現在はコピーのみ可能で、送信はされません。',empty:'ご意見を入力してください。',note:'顧客情報・専門家情報・機密情報は入力しないでください。',close:'閉じる',label:['機能の提案','不具合','デザイン','その他'] },
    en: { like:'Like!',liked:'Liked',comment:'Feedback',header:'Tell our dog what you think 🐶',category:'Feedback type',body:'Suggestions or comments',placeholder:'What works well? What could improve?',copy:'Copy feedback',form:'Open feedback form',copied:'Copied. Paste your feedback into the form or your message.',fail:'Please select and copy the text manually.',pending:'Written feedback collection has not been connected yet. Copying does not send your comment.',empty:'Write a comment first.',note:'Do not include confidential client or expert information.',close:'Close',label:['Feature idea','Bug report','Design / usability','Other'] },
    ko: { like:'좋아요!',liked:'좋아요 완료',comment:'의견 보내기',header:'강아지에게 피드백을 🐶',category:'의견 종류',body:'의견 또는 개선 제안',placeholder:'좋은 점이나 개선할 점을 알려주세요.',copy:'의견 복사',form:'폼에서 보내기',copied:'의견을 복사했습니다. 원하는 곳에 붙여 넣으세요.',fail:'수동으로 복사해 주세요.',pending:'의견 수집 폼을 준비 중입니다. 현재는 복사만 가능하며 전송되지 않습니다.',empty:'의견을 입력해 주세요.',note:'고객·전문가 관련 기밀 정보를 입력하지 마세요.',close:'닫기',label:['기능 제안','오류','UI / 디자인','기타'] }
  };
  var t = words[language] || words.en;
  var categories = ['idea','bug','ui','other'];
  var localKey = 'bbk_feedback_liked_'+tool;
  var liked = false;
  try { liked = localStorage.getItem(localKey) === '1'; } catch (err) {}
  function track(name) {
    document.dispatchEvent(new CustomEvent('bbk:analytics', { detail: { name: name } }));
  }
  function el(tag, cls, text) {
    var x = document.createElement(tag);
    if(cls)x.className=cls;
    if(text!==undefined)x.textContent=text;
    return x;
  }
  function make() {
    if (document.getElementById('bbk-feedback-dock')) return true;
    var dog = document.querySelector('.topbar .brandMark img') || document.querySelector('header img.mascot');
    if(!dog) return false;
    var style = el('style');
    style.textContent = [
      '.bbkFbDock{position:absolute;z-index:120;display:flex;gap:6px;align-items:center;font-family:Arial,"Yu Gothic","Hiragino Kaku Gothic ProN",sans-serif}',
      '.bbkFbMini{height:40px;min-width:42px;border:1px solid #d9e0e8;background:#fff;border-radius:25px;padding:6px 10px;box-shadow:0 4px 12px rgba(22,34,50,.13);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .15s,box-shadow .15s}',
      '.bbkFbMini:hover{transform:translateY(-2px) rotate(-4deg);box-shadow:0 7px 17px rgba(22,34,50,.19)}',
      '.bbkFbMini[aria-pressed=true]{background:#fff1d8;border-color:#f1cd89}',
      '.bbkFbMini:focus-visible,.bbkFbPanel button:focus-visible,.bbkFbPanel textarea:focus-visible,.bbkFbPanel select:focus-visible{outline:3px solid #82aed1;outline-offset:2px}',
      '.bbkFbPanel{display:none;position:absolute;z-index:130;top:49px;left:0;width:min(340px,calc(100vw - 22px));padding:15px;background:#fff;border:1px solid #d6e0e8;border-radius:15px;box-shadow:0 12px 35px rgba(24,36,55,.20);color:#253347;font-size:12px;line-height:1.5}',
      '.bbkFbPanel.open{display:block}',
      '.bbkFbTitle{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:14px;font-weight:750;margin-bottom:10px}',
      '.bbkFbClose{border:0;background:transparent;font-size:18px;cursor:pointer;color:#728091}',
      '.bbkFbPanel label{display:block;font-size:11px;font-weight:700;color:#536176;margin:8px 0 5px}',
      '.bbkFbPanel select,.bbkFbPanel textarea{box-sizing:border-box;width:100%;font:inherit;border:1px solid #cbd3de;background:#fff;color:#253347;border-radius:8px;padding:9px;min-height:auto}',
      '.bbkFbPanel textarea{height:110px;line-height:1.45;resize:vertical}',
      '.bbkFbPanel .bbkFbAction{display:block;margin-top:10px;width:100%;padding:10px;border:0;background:#24364c;color:#fff;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700}',
      '.bbkFbPanel .bbkFbSmall{font-size:10px;line-height:1.5;color:#68788b;margin-top:8px}',
      '.bbkFbStatus{color:#246b54;font-size:11px;min-height:16px;margin-top:7px}',
      '@media (max-width:580px){.bbkFbMini{height:36px;min-width:36px;padding:5px 8px;font-size:16px}.bbkFbPanel{top:43px}}',
      '@media (prefers-reduced-motion:reduce){.bbkFbMini{transition:none}.bbkFbMini:hover{transform:none}}'
    ].join('');
    document.head.appendChild(style);
    var dock=el('div','bbkFbDock');dock.id='bbk-feedback-dock';
    var like=el('button','bbkFbMini','👍');like.type='button';like.title=liked?t.liked:t.like;
    like.setAttribute('aria-label',liked?t.liked:t.like);like.setAttribute('aria-pressed',liked?'true':'false');
    var feedback=el('button','bbkFbMini','💬');feedback.type='button';feedback.title=t.comment;
    feedback.setAttribute('aria-label',t.comment);feedback.setAttribute('aria-expanded','false');
    var panel=el('section','bbkFbPanel');panel.setAttribute('aria-label',t.header);
    var heading=el('div','bbkFbTitle'),headline=el('span','',t.header),close=el('button','bbkFbClose','×');
    close.type='button';close.setAttribute('aria-label',t.close);heading.append(headline,close);
    var typeLabel=el('label','',t.category),select=el('select');
    categories.forEach(function(k,i){var o=el('option','',t.label[i]);o.value=k;select.appendChild(o)});
    var messageLabel=el('label','',t.body),textarea=el('textarea');
    textarea.maxLength=1200;textarea.placeholder=t.placeholder;
    var send=el('button','bbkFbAction',FORM_URL?t.form:t.copy);send.type='button';
    var status=el('div','bbkFbStatus');
    var pending=el('div','bbkFbSmall',FORM_URL?'':t.pending);
    var note=el('div','bbkFbSmall',t.note);
    panel.append(heading,typeLabel,select,messageLabel,textarea,send,status,pending,note);
    dock.append(like,feedback,panel);
    document.body.appendChild(dock);
    function place(){
      var r=dog.getBoundingClientRect(),offsetX=window.scrollX||0,offsetY=window.scrollY||0;
      var start=r.left+offsetX+Math.max(0,r.width-105);
      dock.style.left=Math.max(8,Math.min(start,document.documentElement.scrollWidth-110))+'px';
      dock.style.top=(r.top+offsetY+Math.max(0,r.height-38))+'px';
    }
    place();window.addEventListener('resize',place);window.addEventListener('load',place);
    like.addEventListener('click',function(){
      if(liked)return;
      liked=true;
      try{localStorage.setItem(localKey,'1')}catch(e){}
      like.setAttribute('aria-pressed','true');like.setAttribute('aria-label',t.liked);like.title=t.liked;
      track('feedback_like');
      like.textContent='💛';
    });
    if(liked)like.textContent='💛';
    function hide(){panel.classList.remove('open');feedback.setAttribute('aria-expanded','false')}
    feedback.addEventListener('click',function(){
      var open=!panel.classList.contains('open');
      panel.classList.toggle('open',open);feedback.setAttribute('aria-expanded',open?'true':'false');
      if(open){track('feedback_open');textarea.focus();}
    });
    close.addEventListener('click',hide);
    document.addEventListener('keydown',function(event){if(event.key==='Escape')hide()});
    document.addEventListener('click',function(event){
      if(!dock.contains(event.target))hide();
    });
    send.addEventListener('click',async function(){
      var comment=textarea.value.trim();
      if(!comment){status.textContent=t.empty;return}
      var draft='BBK Tools Feedback\nTool: '+(tool==='expert_excel'?'Expert Profile Excel':'BBK Bunken')+'\nCategory: '+select.value+'\n\n'+comment;
      try{
        if(!navigator.clipboard||!navigator.clipboard.writeText)throw Error('clipboard');
        await navigator.clipboard.writeText(draft);
        track('feedback_copy');status.textContent=t.copied;
      }catch(err){
        textarea.focus();textarea.select();status.textContent=t.fail;
      }
      if(FORM_URL){
        track('feedback_form_open');
        window.open(FORM_URL,'_blank','noopener,noreferrer');
      }
    });
    return true;
  }
  if(!make()){
    var observer=new MutationObserver(function(){if(make())observer.disconnect()});
    observer.observe(document.documentElement,{childList:true,subtree:true});
    document.addEventListener('DOMContentLoaded',make,{once:true});
  }
})();