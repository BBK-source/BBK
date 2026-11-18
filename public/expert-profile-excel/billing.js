(function(){
'use strict';
const columns=['候補者No','プロジェクト名/コード','ご実施日','エキスパート名','企業名','職位','所要時間','請求金額'];
const projectDefault='4分野におけるスキル標準整備 / 10044081.1.2';
let charges=[],billingActive=false;
function chargeDate(raw){
 const m=String(raw).match(/^(\d{4})[-\/](\d\d)[-\/](\d\d)(?:[ T]\d\d:\d\d(?::\d\d)?)?/);
 if(!m)return '';
 const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));
 return d.getUTCFullYear()===+m[1]&&d.getUTCMonth()===+m[2]-1&&d.getUTCDate()===+m[3]?m[1]+'-'+m[2]+'-'+m[3]:'';
}
function nameFromDesc(text){
 const m=String(text).match(/\b(?:consultation|interview|call)\s+with\s+(.+)$/i)||String(text).match(/\bwith\s+(.+)$/i);
 return m?m[1].replace(/\s*\([^)]*\)\s*$/,'').trim():'';
}
function parseCharges(text){
 const raw=String(text||'').replace(/<br\s*\/?>/gi,'\n');
 const currency=(raw.match(/\bCurrency\s*[:：]\s*([A-Z]{3})/i)||[])[1]||'USD',out=[],seen=new Set();
 for(const src of raw.split(/\r?\n/)){
  const line=src.trim();if(!/^\|?\s*\d{4}[-\/]\d\d[-\/]\d\d/.test(line))continue;
  let part=line.includes('|')?line.split('|').map(s=>s.trim()).filter(Boolean):
           line.includes('\t')?line.split(/\t+/).map(s=>s.trim()).filter(Boolean):null;
  if(!part){
   const m=line.match(/^(\d{4}[-\/]\d\d[-\/]\d\d(?:\s+\d\d:\d\d(?::\d\d)?)?)\s+(.+?)\s+(\d+(?:\.\d+)?\s*h)\s+((?:[A-Z]{3}\s*)?[\d,]+(?:\.\d+)?\s*(?:[A-Z]{3})?)$/i);
   part=m?[m[1],m[2],m[3],m[4]]:[];
  }
  if(part.length<4)continue;
  const day=chargeDate(part[0]),dur=part[2].match(/(\d+(?:\.\d+)?)\s*h/i),amt=part[3].replace(/,/g,'').match(/(\d+(?:\.\d+)?)/);
  if(!day||!dur||!amt)continue;
  const duration=+dur[1],price=+amt[1];
  if(duration<=0||!Number.isFinite(price))continue;
  const key=[day,part[1],duration,price].join('|');
  if(seen.has(key))continue;seen.add(key);
  out.push({date:day,description:part[1],duration,price,currency:((part[3].match(/\b(USD|EUR|GBP|JPY|CNY|HKD)\b/i)||[])[1]||currency).toUpperCase(),name:nameFromDesc(part[1]),selected:'',company:null,role:null});
 }
 return out;
}
function normalizedName(s){return String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');}
function expertName(e){return String(e.name||'').replace(/^#(?:\d+\.\d+[A-Za-z]*)?\s*[-–—]\s*/,'').split(/\s+[-–—]\s+(?=Former|Current|✅|Screened)/i)[0].trim();}
function expertNo(e){return (String(e.name||'').match(/^(#\d+\.\d+[A-Za-z]*)\s*[-–—]/i)||[])[1]||'';}
function careerRowsFromHistory(history){
 // Handle both normalized records and markdown table rows split by <br>.
 const lines=String(history||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const records=[];
 function companyRole(text){
  const parts=text.split(/\s*\|\s*-\s*\|\s*|\s*｜\s*/).map(x=>x.trim()).filter(Boolean);
  if(parts.length>=2)return {company:parts[0],role:parts.slice(1).join('｜')};
  const dashed=text.split(/\s+[-–—]\s+/);
  if(dashed.length>=2)return {company:dashed[0].trim(),role:dashed.slice(1).join(' - ').trim()};
  return null;
 }
 for(let i=0;i<lines.length;i++){
  const line=lines[i];
  let range='',detail='';
  const normalized=line.match(/^(\d{4}\.\d{1,2}～(?:現在|\d{4}\.\d{1,2}))\s*[｜|]\s*(.+)$/);
  if(normalized){range=normalized[1];detail=normalized[2];}
  else{
   const cleaned=line.replace(/\s*\|\s*-\s*\|\s*/g,' - ');
   const date=careerDateRange(cleaned);
   if(!date)continue;
   range=date.date;detail=date.detail;
   if(!detail&&i+1<lines.length){
    const next=lines[i+1];
    if(!careerDateRange(next.replace(/\s*\|\s*-\s*\|\s*/g,' - '))){
     detail=next;i++;
    }
   }
  }
  const fields=companyRole(detail);
  if(fields&&fields.company&&fields.role)
   records.push({range,company:fields.company,role:fields.role});
 }
 return records.sort((a,b)=>{
  const value=x=>{const m=x.range.match(/^(\d{4})\.(\d{1,2})/);return m?+m[1]*12+(+m[2]):0};
  return value(a)-value(b);
 });
}
function expertCompanyRole(e){
 const history=careerRowsFromHistory(e.history);
 if(history.length){
  return {
   company:history.map(r=>r.company+'（'+r.range+'）').join('\n'),
   role:history.map(r=>r.role+'（'+r.range+'）').join('\n')
  };
 }
 const first=String(e.raw||'').split(/\r?\n/).find(x=>/\b(?:Former|Current)\b.+\bat\b/i.test(x))||'';
 const m=first.match(/\b(?:Former|Current)\s+(.+?)\s+at\s+(.+?)(?=\s*\(\d\d\/\d{4}\b|$)/i);
 if(m)return {company:m[2].replace(/\*+/g,'').trim(),role:m[1].replace(/[*✅✔]/g,'').trim()};
 return {company:'',role:''};
}
function matched(c,list){
 const key=normalizedName(c.selected||c.name);
 const matches=list.filter(e=>normalizedName(expertName(e))===key);
 return matches.length===1?matches[0]:null;
}
function toRow(c,list){
 const e=matched(c,list);if(!e)return null;const cr=expertCompanyRole(e);
 return {number:expertNo(e),project:projectDefault,date:c.date,name:expertName(e),
 company:c.company===null?cr.company:c.company,role:c.role===null?cr.role:c.role,
 duration:c.duration,price:c.price,currency:c.currency};
}
function excelDate(day){
 const a=day.split('-').map(Number);
 return Math.round((Date.UTC(a[0],a[1]-1,a[2])-Date.UTC(1899,11,30))/86400000);
}
function billingWorksheet(rows){
 const widths=[14,38,19,25,52,60,16,18];
 let s='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
 +'<dimension ref="A1:H'+(rows.length+1)+'"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
 +'<sheetFormatPr defaultRowHeight="17"/><cols>';
 widths.forEach((w,i)=>s+='<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>');
 s+='</cols><sheetData>';
 const stringCell=(col,row,value,style)=>'<c r="'+col+row+'" s="'+style+'" t="inlineStr"><is><t xml:space="preserve">'+xmlEscape(checkXmlText(value||''))+'</t></is></c>';
 s+='<row r="1" ht="30" customHeight="1">';
 columns.forEach((name,i)=>s+=stringCell(columnName(i),1,name,1));
 s+='</row>';
 rows.forEach((r,i)=>{
  const n=i+2;
  const lines=Math.max(String(r.company||'').split('\n').length,String(r.role||'').split('\n').length);
  const ht=Math.min(390,Math.max(44,lines*29));
  s+='<row r="'+n+'" ht="'+ht+'" customHeight="1">';
  [['A',r.number],['B',r.project]].forEach(([col,value])=>s+=stringCell(col,n,value,2));
  s+='<c r="C'+n+'" s="3"><v>'+excelDate(r.date)+'</v></c>';
  [['D',r.name],['E',r.company],['F',r.role]].forEach(([col,value])=>s+=stringCell(col,n,value,2));
  s+='<c r="G'+n+'" s="4"><v>'+r.duration+'</v></c>';
  s+=r.currency==='USD'?'<c r="H'+n+'" s="5"><v>'+r.price+'</v></c>':stringCell('H',n,r.price.toFixed(2)+' '+r.currency,2);
  s+='</row>';
 });
 return s+'</sheetData><autoFilter ref="A1:H'+(rows.length+1)+'"/><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>';
}
function billingFiles(rows){
 const files=xlsxFiles([],['インタビュー実施・請求一覧']);
 files.find(x=>x[0]==='xl/worksheets/sheet1.xml')[1]=billingWorksheet(rows);
 const style=files.find(x=>x[0]==='xl/styles.xml');
 style[1]=style[1].replace('<fonts count="2">','<numFmts count="3"><numFmt numFmtId="164" formatCode="yyyy/mm/dd"/><numFmt numFmtId="165" formatCode="0.0&quot; h&quot;"/><numFmt numFmtId="166" formatCode="#,##0.00&quot; USD&quot;"/></numFmts><fonts count="2">')
 .replace('<cellXfs count="3">','<cellXfs count="6">')
 .replace('</cellXfs>','<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>');
 return files;
}
function node(tag,props,content){const el=document.createElement(tag);Object.entries(props||{}).forEach(([k,v])=>el.setAttribute(k,v));if(content!==undefined)el.textContent=String(content);return el;}
const main=document.querySelector('main.wrap');
const bar=main&&main.querySelector('.modebar');
const normalMain=main&&main.querySelector('section.two');
const listPanel=main&&Array.from(main.querySelectorAll('section.panel')).find(x=>x.querySelector('#rows'));
const footer=main&&Array.from(main.children).find(x=>x.classList&&x.classList.contains('fine'));
if(!main||!bar||!normalMain||!listPanel||!footer)return;
const tabs=node('div',{class:'billingNav'});
const tabExperts=node('button',{class:'btn primary',type:'button','aria-pressed':'true'},'エキスパート一覧');
const tabBills=node('button',{class:'btn',type:'button','aria-pressed':'false'},'インタビュー実施・請求管理');
tabs.append(tabExperts,tabBills);bar.insertAdjacentElement('afterend',tabs);
const panel=node('section',{class:'panel billingPanel'});
panel.style.display='none';
panel.innerHTML='<h2>インタビュー実施・請求管理</h2>'
+'<p class="fine">① Expert Profileを貼り付け　② Charge明細を貼り付け　③ 氏名を照合してExcel出力</p>'
+'<div class="billingGrid"><div><label for="billingProfiles">① エキスパートProfile</label>'
+'<textarea id="billingProfiles" placeholder="#4.1 - Katsumi Masumoto - ✅ Former...&#10;Employment History: ..."></textarea>'
+'<div class="controls"><button class="btn" id="billingAddProfiles">Profileを解析して追加</button></div></div>'
+'<div><label for="billingCharges">② Charge明細</label>'
+'<textarea id="billingCharges" placeholder="Charge Date | Description | Duration | Price&#10;2026-11-11 11:37:38 | 30min consultation with Katsumi Masumoto | 0.5 h | 885.00 USD"></textarea>'
+'<div class="controls"><button class="btn" id="billingParseCharges">Chargeを解析・照合</button><button class="btn small" id="billingClearCharges">明細をクリア</button></div></div></div>'
+'<div class="controls" style="margin-top:12px"><label for="billingProject" style="margin:0">プロジェクト名/コード（固定）</label><input id="billingProject" class="input" style="max-width:420px" value="4分野におけるスキル標準整備 / 10044081.1.2" readonly></div>'
+'<div class="row" style="justify-content:space-between;margin-top:18px"><h2>照合結果</h2><span id="billingSummary" class="fine"></span></div>'
+'<div class="tablewrap"><table class="billingTable"><thead><tr><th>エキスパート</th><th>Charge Date</th><th>Description</th><th>Duration</th><th>Price</th><th>企業名</th><th>職位</th><th>照合</th></tr></thead><tbody id="billingRows"></tbody></table></div>'
+'<div class="controls"><button class="btn primary" id="billingDownload" disabled>顧客向けExcelをダウンロード (.xlsx)</button><span id="billingStatus" class="fine"></span></div>'
+'<p class="fine">Charge Date＝ご実施日。企業・職位はProfileの全職歴を年月付きで反映（編集可）。所要時間・請求金額はCharge明細を使用。Total行は含めません。</p>';
tabs.insertAdjacentElement('afterend',panel);
const style=node('style');
style.textContent='.billingNav{display:flex;gap:8px;flex-wrap:wrap;margin:-3px 0 16px}.billingGrid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.billingPanel textarea{min-height:185px;font-size:12px}.billingTable{min-width:1040px}.billingTable td,.billingTable th{padding:8px;font-size:12px;vertical-align:top}.billingTable select{min-width:165px}.billingTable textarea{min-width:270px;max-width:420px;min-height:125px;font-size:11px;line-height:1.6;resize:vertical;white-space:pre-wrap}@media(max-width:760px){.billingGrid{grid-template-columns:1fr}}';
document.head.append(style);
const $=id=>document.getElementById(id),profileInput=$('billingProfiles'),chargeInput=$('billingCharges'),rowsNode=$('billingRows'),summary=$('billingSummary'),notice=$('billingStatus'),downloadButton=$('billingDownload');
function display(){
 const special=mode==='special';tabs.style.display=special?'flex':'none';
 if(!special)billingActive=false;
 const hide=special&&billingActive;
 normalMain.style.display=hide?'none':'';
 listPanel.style.display=hide?'none':'';
 footer.style.display=hide?'none':'';
 panel.style.display=hide?'block':'none';
 tabExperts.classList.toggle('primary',!billingActive);
 tabBills.classList.toggle('primary',billingActive);
 tabExperts.setAttribute('aria-pressed',String(!billingActive));
 tabBills.setAttribute('aria-pressed',String(billingActive));
 if(hide)render();
}
function render(){
 const mapped=charges.map(c=>toRow(c,entries));
 const count=mapped.filter(Boolean).length;
 summary.textContent='Profile '+entries.length+'名 ／ Charge '+charges.length+'件 ／ 照合 '+count+'件';
 rowsNode.replaceChildren();
 charges.forEach((c,i)=>{
  const tr=node('tr');
  function cell(v){const td=node('td');if(v instanceof HTMLElement)td.append(v);else td.textContent=String(v??'');tr.append(td);return td;}
  const e=matched(c,entries);
  const select=node('select',{'aria-label':'エキスパートを選択'});
  select.append(node('option',{value:''},'— 選択 —'));
  entries.forEach(x=>select.append(node('option',{value:expertName(x)},expertName(x))));
  if(e)select.value=expertName(e);
  select.onchange=()=>{c.selected=select.value;c.company=null;c.role=null;render()};
  cell(select);cell(c.date);cell(c.description);cell(c.duration+' h');cell(c.price.toFixed(2)+' '+c.currency);
  const company=node('textarea',{placeholder:'企業名・年月（編集可）',rows:'4'});company.value=mapped[i]?mapped[i].company:'';
  company.oninput=()=>{c.company=company.value};cell(company);
  const role=node('textarea',{placeholder:'職位・年月（編集可）',rows:'4'});role.value=mapped[i]?mapped[i].role:'';
  role.oninput=()=>{c.role=role.value};cell(role);
  cell(mapped[i]?'照合済み':'未照合');rowsNode.append(tr);
 });
 downloadButton.disabled=!charges.length||count!==charges.length;
}
tabExperts.onclick=()=>{billingActive=false;display()};
tabBills.onclick=()=>{billingActive=true;display()};
$('modeGeneral').addEventListener('click',()=>{charges=[];display()});
$('modeSpecial').addEventListener('click',display);
$('reset').addEventListener('click',()=>{charges=[];render()});
$('billingAddProfiles').onclick=()=>{
 const str=profileInput.value.trim();
 if(!str){notice.textContent='Profileを貼り付けてください。';return}
 const parsed=parseProfiles(str);
 if(!parsed.length){notice.textContent='Profileを認識できませんでした。';return}
 parsed.forEach(e=>{const i=entries.findIndex(x=>normalizedName(expertName(x))===normalizedName(expertName(e)));if(i>=0)entries[i]=e;else entries.push(e)});
 profileInput.value='';renderAll();render();notice.textContent=parsed.length+'名のProfileを追加しました。';
};
$('billingParseCharges').onclick=()=>{charges=parseCharges(chargeInput.value);render();notice.textContent=charges.length?charges.length+'件のChargeを解析しました。':'Charge明細を読み取れませんでした。';};
$('billingClearCharges').onclick=()=>{charges=[];chargeInput.value='';render();notice.textContent='';};
downloadButton.onclick=()=>{
 const rows=charges.map(c=>toRow(c,entries));
 if(!rows.length||rows.some(r=>!r)){notice.textContent='未照合のエキスパートを選択してください。';return}
 try{const now=new Date(),pad=n=>String(n).padStart(2,'0');
  const filename='BCG_インタビュー実施請求一覧_'+now.getFullYear()+pad(now.getMonth()+1)+pad(now.getDate())+'.xlsx';
  download(zipStore(billingFiles(rows)),filename,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  notice.textContent=rows.length+'件のExcelを出力しました。';
  window.dispatchEvent(new CustomEvent('bbk:analytics',{detail:{name:'excel_export'}}));
 }catch(e){console.error(e);notice.textContent='Excel出力エラー：'+e.message}
};
display();
})();