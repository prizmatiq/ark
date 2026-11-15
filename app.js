'use strict';
const $=id=>document.getElementById(id),STORAGE='ark_v3',DAY=86400000;
const localDate=d=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
const today=localDate(new Date());
const plusDays=(str,n)=>new Date(Date.parse(str+'T12:00:00Z')+n*DAY).toISOString().slice(0,10);
const cash=x=>Math.min(1e12,Math.max(0,Math.round(Number(x)||0)));
const number=x=>Math.round(Number(x)||0).toLocaleString('en-US').replaceAll(',',' ');
const money=x=>number(x)+' ₽';
const esc=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const validDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&x>='2000-01-01'&&x<='2100-12-31'&&!isNaN(Date.parse(x+'T12:00:00Z'))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
const monthlyFields=[['rent','Rent'],['utilities','Utilities'],['food','Food'],['comms','Phone & internet'],['metro','Public transport'],['taxi','Taxi'],['creditMonthly','Required payments'],['monthlyOther','Other recurring expenses']];
const defaults=()=>({sprintName:'',sprintGoal:0,saved:0,wage:0,start:today,end:plusDays(today,29),pattern:'alternate',includeRecurring:false,recurring:Object.fromEntries(monthlyFields.map(([k])=>[k,0])),expenses:[],confirmed:[],calMonth:today.slice(0,7)});
function normalize(raw){
 const d=defaults();if(!raw||typeof raw!=='object'||Array.isArray(raw))return d;
 d.sprintName=String(raw.sprintName||'').slice(0,160);
 for(const k of ['sprintGoal','saved','wage'])d[k]=cash(raw[k]);
 if(raw.wage===undefined)d.wage=cash(raw.scenario==='cautious'?raw.cautious:raw.saratov);
 for(const k of ['start','end'])if(validDate(raw[k]))d[k]=raw[k];
 d.pattern=['alternate','three','daily'].includes(raw.pattern)?raw.pattern:'alternate';d.includeRecurring=raw.includeRecurring===true;
 for(const [k] of monthlyFields)d.recurring[k]=cash(raw.recurring?.[k]??raw[k]);
 if(Array.isArray(raw.expenses))d.expenses=raw.expenses.filter(x=>x&&typeof x==='object').slice(0,200).map(x=>({name:String(x.name||'').slice(0,160),amount:cash(x.amount)}));
 else if(cash(raw.sprintCosts)>0)d.expenses=[{name:'Other sprint expenses',amount:cash(raw.sprintCosts)}];
 // Legacy purchase wishlists are not automatically treated as sprint expenses.
 d.confirmed=Array.isArray(raw.confirmed)?[...new Set(raw.confirmed.filter(validDate))]:[];
 d.calMonth=validDate(raw.calMonth+'-01')?raw.calMonth:d.start.slice(0,7);return d;
}
let state;try{state=normalize(JSON.parse(localStorage.getItem(STORAGE)||localStorage.getItem('ark_v2')||localStorage.getItem('ark_v1')||'{}'))}catch{state=defaults()}
function save(){try{localStorage.setItem(STORAGE,JSON.stringify(state));$('storageStatus').textContent='Saved on this device. No account or cloud sync.'}catch{$('storageStatus').textContent='Local saving is unavailable. Export JSON to keep your plan.'}}
function calculate(s=state){
 const valid=validDate(s.start)&&validDate(s.end)&&s.end>=s.start,days=valid?Math.round((Date.parse(s.end)-Date.parse(s.start))/DAY)+1:0;
 const error=!valid?'Choose valid start and end dates. The end must not precede the start.':days>3660?'Choose a sprint of no more than 10 years.':'';
 const shifts=[],confirmed=new Set(s.confirmed);let factor=0;
 if(!error)for(let i=0;i<days;i++){
  const date=plusDays(s.start,i),dt=new Date(date+'T12:00:00Z');
  const scheduled=s.pattern==='daily'||(s.pattern==='three'?[1,3,5].includes(dt.getUTCDay()):i%2===0);
  if(scheduled||confirmed.has(date))shifts.push({date,confirmed:confirmed.has(date)});
  factor+=1/new Date(Date.UTC(dt.getUTCFullYear(),dt.getUTCMonth()+1,0)).getUTCDate();
 }
 const monthly=Object.values(s.recurring).reduce((a,b)=>a+cash(b),0),recurring=!error&&s.includeRecurring?Math.round(monthly*factor):0,oneTime=s.expenses.reduce((a,b)=>a+cash(b.amount),0);
 const costs=recurring+oneTime,gross=shifts.length*s.wage,net=gross-costs,forecast=s.saved+net,confirmedCount=shifts.filter(x=>x.confirmed).length;
 const required=s.wage>0?Math.ceil(Math.max(0,s.sprintGoal-s.saved+costs)/s.wage):null;
 return {valid:!error,error,days,shifts,monthly,recurring,oneTime,costs,gross,net,forecast,confirmedCount,confirmedGross:confirmedCount*s.wage,required};
}
function stepper(key,label,value){
 const id='money-'+key.replaceAll('.','-');
 return '<div class="field"><label for="'+id+'">'+esc(label)+'</label><div class="stepper"><button type="button" data-step="'+key+'" data-direction="-1" aria-label="Decrease '+esc(label)+' by 1 000 rubles">−</button><div class="money-input"><input id="'+id+'" type="text" inputmode="numeric" autocomplete="off" data-money="'+key+'" aria-label="'+esc(label)+' in rubles" value="'+number(value)+'"><span class="currency" aria-hidden="true"> ₽</span></div><button type="button" data-step="'+key+'" data-direction="1" aria-label="Increase '+esc(label)+' by 1 000 rubles">+</button></div></div>';
}
function getAmount(key){const [a,b,c]=key.split('.');return a==='recurring'?state.recurring[b]:a==='expenses'?state.expenses[+b]?.[c]:state[a]}
function setAmount(key,value){const [a,b,c]=key.split('.');if(a==='recurring')state.recurring[b]=cash(value);else if(a==='expenses'&&state.expenses[+b])state.expenses[+b][c]=cash(value);else if(a!=='expenses')state[a]=cash(value)}
function buildFields(){
 $('sprintNumbers').innerHTML=[['sprintGoal','Target savings'],['saved','Already saved'],['wage','Take-home pay per shift']].map(([k,l])=>stepper(k,l,state[k])).join('');
 $('recurringFields').innerHTML=monthlyFields.map(([k,l])=>stepper('recurring.'+k,l+' / month',state.recurring[k])).join('');
 document.querySelectorAll('[data-k]').forEach(el=>{if(el.type==='checkbox')el.checked=state[el.dataset.k];else el.value=state[el.dataset.k]});buildExpenses();
}
function buildExpenses(){$('expenses').innerHTML=state.expenses.map((e,i)=>'<div class="expense-item"><label class="field" for="expense-name-'+i+'">Expense name<input class="expense-name" id="expense-name-'+i+'" data-name="'+i+'" maxlength="160" placeholder="e.g. Equipment" value="'+esc(e.name)+'"></label>'+stepper('expenses.'+i+'.amount','Amount',e.amount)+'<button class="btn remove" data-remove="'+i+'" aria-label="Remove expense '+(i+1)+'">Remove expense</button></div>').join('')}
const row=(a,b)=>'<div class="row"><span>'+a+'</span><strong>'+b+'</strong></div>';
function render(){
 const p=calculate();
 document.querySelectorAll('[data-money]').forEach(el=>{if(el!==document.activeElement)el.value=number(getAmount(el.dataset.money))});
 document.querySelectorAll('[data-step]').forEach(el=>{el.disabled=el.dataset.direction==='-1'&&getAmount(el.dataset.step)<=0});
 $('recurringSummary').textContent=state.includeRecurring?'Included · '+money(p.recurring)+' for this sprint':'Not included · expand to configure';
 $('recurringTotal').textContent=money(p.monthly)+' / month · '+(state.includeRecurring?money(p.recurring)+' deducted for this sprint':'not deducted');
 $('expenseTotal').textContent='One-time total: '+money(p.oneTime);
 $('validation').hidden=p.valid;$('validation').textContent=p.error;
 const cards=[['Planned income',p.gross,p.shifts.length+' shifts · '+p.confirmedCount+' confirmed'],['Total expenses',p.costs,'Recurring + one-time expenses'],['Net sprint income',p.net,'Planned income minus expenses'],['Forecast savings',p.forecast,'Already saved + net sprint income']];
 $('summaryCards').innerHTML=cards.map(([label,value,note])=>'<div class="metric"><div class="metric-label">'+label+'</div><div class="metric-value">'+(p.valid?money(value):'—')+'</div><p class="note">'+note+'</p></div>').join('');
 $('summaryRows').innerHTML=row('Target savings',money(state.sprintGoal))+row('Already saved',money(state.saved))+row('Recurring expenses for sprint',p.valid?money(p.recurring):'—')+row('One-time expenses',money(p.oneTime))+row('Confirmed shift income (forecast)',p.valid?money(p.confirmedGross):'—')+row('Shifts needed to meet target',p.valid&&state.sprintGoal>0&&p.required!==null?String(p.required):'—')+row('Forecast vs target',p.valid&&state.sprintGoal>0?(p.forecast>=state.sprintGoal?'+':'')+money(p.forecast-state.sprintGoal):'—');
 const progress=state.sprintGoal>0?Math.min(100,state.saved/state.sprintGoal*100):0;
 $('progress').setAttribute('aria-valuenow',String(Math.round(progress)));$('progress').firstElementChild.style.width=progress+'%';
 $('goalStatus').textContent=!p.valid?p.error:state.sprintGoal<=0?'Set a target to assess the plan.':state.wage<=0&&p.forecast<state.sprintGoal?'Set your take-home pay per shift to assess the plan.':p.forecast>=state.sprintGoal?'The forecast covers your target. Progress above reflects actual savings only.':'The forecast falls short by '+money(state.sprintGoal-p.forecast)+'. Adjust the dates, income or expenses.';
 renderCalendar(p);$('copyMarkdown').disabled=!p.valid;$('downloadMarkdown').disabled=!p.valid;save();
}
function renderCalendar(p){
 const [y,m]=state.calMonth.split('-').map(Number),first=new Date(Date.UTC(y,m-1,1)),count=new Date(Date.UTC(y,m,0)).getUTCDate(),lead=(first.getUTCDay()+6)%7;
 $('monthName').textContent=first.toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'});
 const shifts=new Map(p.shifts.map(x=>[x.date,x]));let html=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>'<div class="dow">'+d+'</div>').join('');
 for(let i=0;i<lead;i++)html+='<div aria-hidden="true"></div>';
 for(let d=1;d<=count;d++){
  const date=state.calMonth+'-'+String(d).padStart(2,'0'),shift=shifts.get(date),confirmed=shift?.confirmed;
  const classes='day'+(shift?' shift':'')+(confirmed?' confirmed':'')+(date===today?' today':'');
  html+=shift?'<button class="'+classes+'" data-date="'+date+'" aria-pressed="'+confirmed+'" aria-label="'+date+', '+(confirmed?'confirmed':'planned')+' shift. Click to '+(confirmed?'unconfirm':'confirm')+'">'+d+'<span>'+(confirmed?'✓':'Shift')+'</span></button>':'<div class="'+classes+'">'+d+'</div>';
 }
 $('calendar').innerHTML=html;
 const outside=state.confirmed.filter(d=>d<state.start||d>state.end).length;
 $('calendarStatus').textContent=p.confirmedCount+' of '+p.shifts.length+' shifts confirmed.'+(outside?' '+outside+' confirmations outside this sprint are saved but excluded.':'');
}
function toggleShift(date){if(!calculate().shifts.some(x=>x.date===date))return;state.confirmed=state.confirmed.includes(date)?state.confirmed.filter(x=>x!==date):[...state.confirmed,date];render();document.querySelector('[data-date="'+date+'"]')?.focus()}
document.addEventListener('input',e=>{
 const el=e.target;
 if(el.dataset.money){setAmount(el.dataset.money,el.value.replace(/[^\d]/g,''));render()}
 else if(el.dataset.name!==undefined){state.expenses[+el.dataset.name].name=el.value;save()}
 else if(el.dataset.k&&el.type!=='checkbox'&&el.tagName!=='SELECT'){state[el.dataset.k]=el.value;if(el.dataset.k==='start'&&validDate(el.value))state.calMonth=el.value.slice(0,7);render()}
});
document.addEventListener('change',e=>{const el=e.target;if(el.dataset.k&&(el.type==='checkbox'||el.tagName==='SELECT')){state[el.dataset.k]=el.type==='checkbox'?el.checked:el.value;render()}});
document.addEventListener('focusout',e=>{if(e.target.dataset.money)e.target.value=number(getAmount(e.target.dataset.money))});
document.addEventListener('keydown',e=>{if(e.target.dataset.money&&['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();setAmount(e.target.dataset.money,getAmount(e.target.dataset.money)+(e.key==='ArrowUp'?1000:-1000));e.target.value=number(getAmount(e.target.dataset.money));render()}});
document.addEventListener('click',e=>{
 const el=e.target.closest('button');if(!el)return;
 if(el.dataset.step){setAmount(el.dataset.step,getAmount(el.dataset.step)+Number(el.dataset.direction)*1000);render()}
 else if(el.dataset.remove!==undefined){state.expenses.splice(+el.dataset.remove,1);buildExpenses();render();$('addExpense').focus()}
 else if(el.dataset.date)toggleShift(el.dataset.date);
});
$('addExpense').onclick=()=>{if(state.expenses.length>=200)return;state.expenses.push({name:'',amount:0});buildExpenses();render();$('expense-name-'+(state.expenses.length-1)).focus()};
function changeMonth(delta){const [y,m]=state.calMonth.split('-').map(Number),d=new Date(Date.UTC(y,m-1+delta,1)),next=d.toISOString().slice(0,7);if(validDate(next+'-01')){state.calMonth=next;render()}}
$('prevMonth').onclick=()=>changeMonth(-1);$('nextMonth').onclick=()=>changeMonth(1);
const mdText=x=>String(x).replace(/[\r\n]+/g,' ').replace(/[\\*_[\]<>|#]/g,'\\$&');
function markdown(){
 const p=calculate();if(!p.valid)throw Error(p.error);
 return ['# '+mdText(state.sprintName.trim()||'Sprint plan'),'','## Inputs','',
 '- Period: '+state.start+' to '+state.end+' ('+p.days+' days, inclusive)','- Currency: RUB (₽)',
 '- Target savings: '+money(state.sprintGoal),'- Already saved: '+money(state.saved),'- Take-home pay per shift: '+money(state.wage),
 '- Schedule: '+({alternate:'Every other day',three:'Monday / Wednesday / Friday',daily:'Every day'}[state.pattern]),'',
 '## Recurring expenses','','- Deduct from sprint: '+(state.includeRecurring?'Yes':'No'),
 ...monthlyFields.map(([k,l])=>'- '+l+': '+money(state.recurring[k])+' / month'),
 '- Monthly total: '+money(p.monthly),'- Prorated amount deducted: '+money(p.recurring),'',
 '## One-time expenses','',...(state.expenses.length?state.expenses.map((x,i)=>'- '+mdText(x.name.trim()||'Expense '+(i+1))+': '+money(x.amount)):['- None']),'- One-time total: '+money(p.oneTime),'',
 '## Summary','','- Total shifts: '+p.shifts.length,'- Confirmed shifts: '+p.confirmedCount,
 '- Planned income (all shifts): '+money(p.gross),'- Confirmed shift income (included in planned income): '+money(p.confirmedGross),
 '- Total expenses: '+money(p.costs),'- Net sprint income: '+money(p.net),'- Forecast savings: '+money(p.forecast),
 '- Shifts needed to meet target: '+(state.sprintGoal>0&&p.required!==null?p.required:'Not calculated'),
 '- Forecast vs target: '+(state.sprintGoal>0?money(p.forecast-state.sprintGoal):'Target not set'),'',
 '## Shift calendar','',...(p.shifts.length?p.shifts.map(x=>'- '+x.date+' — '+(x.confirmed?'Confirmed':'Planned')):['- No shifts in this period']),'',
 '## Assumptions','','- Dates are inclusive. Monthly expenses are prorated by actual calendar days in each month.',
 '- One-time expenses are deducted once. Already saved is added once.',
 '- Confirmed shifts are a subset of planned income, not extra income or received payments.',
 '- Confirmed dates inside the sprint stay included when the schedule changes.',
 '- Confirmations outside the period are excluded from this calculation.',
 '- Progress reflects actual savings only. Verify completed shifts, received pay and actual expenses separately.',''].join('\n');
}
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
$('copyMarkdown').onclick=async()=>{try{const text=markdown();try{await navigator.clipboard.writeText(text);$('exportStatus').textContent='Markdown copied.';$('copyFallback').hidden=true}catch{$('copyFallback').value=text;$('copyFallback').hidden=false;$('copyFallback').focus();$('copyFallback').select();$('exportStatus').textContent='Clipboard unavailable. Copy the selected text below or download .md.'}}catch(err){$('exportStatus').textContent=err.message}};
$('downloadMarkdown').onclick=()=>{try{download(markdown(),'ark-sprint-'+state.start+'.md','text/markdown;charset=utf-8');$('exportStatus').textContent='Markdown download prepared.'}catch(err){$('exportStatus').textContent=err.message}};
$('export').onclick=()=>{download(JSON.stringify({version:3,exportedAt:new Date().toISOString(),data:state},null,2),'ark-sprint.json','application/json');$('exportStatus').textContent='JSON backup prepared.'};
$('import').onclick=()=>$('file').click();
$('file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>2e6)throw Error('The file is too large.');const raw=JSON.parse(await file.text()),data=raw.data||raw;if(!data||typeof data!=='object'||Array.isArray(data)||!('start' in data)||!('end' in data))throw Error('This is not an ARK plan.');state=normalize(data);buildFields();render();$('exportStatus').textContent='Plan imported, including saved confirmations.'}catch(err){$('exportStatus').textContent='Import failed: '+err.message}finally{e.target.value=''}};
$('reset').onclick=()=>{if(confirm('Clear the current plan on this device? Export JSON first if you want to keep it.')){state=defaults();buildFields();$('recurringPanel').open=false;$('copyFallback').hidden=true;render();$('exportStatus').textContent='Plan reset.'}};
let installPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e});
$('install').onclick=async()=>{if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null}else $('appStatus').textContent='On Android, open this page in Chrome and choose “Install app” or “Add to Home screen” from the browser menu.'};
window.addEventListener('appinstalled',()=>{$('install').hidden=true;$('appStatus').textContent='ARK installed.'});
if(window.matchMedia('(display-mode: standalone)').matches)$('install').hidden=true;
if('serviceWorker' in navigator){
 let refreshing=false;
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(refreshing)return;refreshing=true;window.location.reload()});
 navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).then(reg=>{
  function offerUpdate(){if(reg.waiting){$('update').hidden=false;$('update').onclick=()=>{save();reg.waiting.postMessage({type:'SKIP_WAITING'})}}}
  offerUpdate();reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)offerUpdate()})});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')reg.update().catch(()=>{})});
 }).catch(()=>{$('appStatus').textContent='Offline setup is unavailable. The calculator still works online.'});
}
buildFields();render();
