import './styles.css';
import {
  PAPER_CSS, BLANK, EX_FRESHER, EX_PRO, NEW, TYPES, TEMPLATES, MODES, TABS, LAYERS,
  clone, h, uid, lines, list, normalise, jdTerms, has, normDate,
  analyse, analyseText, sheetHTML, texDoc, exportHTML, tailorData
} from './engine.js';
import { docxText } from './docx.js';

document.getElementById('paper-css').textContent = PAPER_CSS;

/* ---------- app state ---------- */
let store, state=null, route='home', editTab='details', pvTab='preview', pages=1, lastA=null, prevScore=null, curScore=null, checkedAt='';
let sample=null, downloads=null, pendingDel=null, ro=null;
const sugg={};
let homeMsg='';
const VS={chk:{text:'',jd:'',report:null,busy:false,msg:'',meta:''},tl:{source:'saved',vid:'',text:'',jd:'',role:'',company:'',busy:false,msg:''}};
const KEY='ai-resume-studio-v2';
const $=id=>document.getElementById(id);
const cur=()=>store.versions.find(v=>v.id===store.currentId)||null;
const byId=id=>store.versions.find(v=>v.id===id)||null;
const get=p=>p.split('.').reduce((o,k)=>o==null?undefined:o[k],state);
function set(p,v){const ks=p.split('.');const last=ks.pop();ks.reduce((o,k)=>o[k],state)[last]=v;}
function newVersion(mode,label,data,parentId,flags){
  const v=Object.assign({id:uid(),label,mode,parentId:parentId||null,example:false,extracted:false,dismissed:[],updated:Date.now(),data:normalise(data)},flags||{});
  store.versions.unshift(v);return v;
}

/* ---------- Claude, through the local server (prompts are built server-side) ---------- */
function parseJSON(t){const a=t.indexOf('{'),b=t.lastIndexOf('}');if(a<0||b<=a)throw new Error('nojson');return JSON.parse(t.slice(a,b+1));}
async function ai(kind,payload){
  let r;
  try{r=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,payload})});}
  catch(e){throw Object.assign(new Error('network'),{code:'network'});}
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw Object.assign(new Error(j.error||'failed'),{code:j.code||'failed'});
  return String(j.text||'');
}
async function extract(text){return normalise(parseJSON(await ai('extract',{text})));}
function payloadFor(path,kind){
  const d=state;
  if(kind==='idea')return {target:d.target,skills:d.skills};
  if(kind==='summary')return {resume:d};
  return {bullets:lines(get(path)),target:d.target,jd:d.jd};
}
async function runAI(path,kind){
  if(!sample)return;
  if(kind==='bullets'&&!lines(get(path)).length){sugg[path]={status:'error',msg:'Write at least one point first. Claude rewrites what you give it and adds nothing.'};renderForm();return;}
  sugg[path]={status:'loading'};renderForm();
  try{
    const raw=await ai(kind,payloadFor(path,kind));
    const text=kind==='idea'?raw.trim():raw.split('\n').map(x=>x.replace(/^\s*[-•*\d.]+\s+/,'').trim()).filter(Boolean).join('\n');
    sugg[path]=text?{status:'done',text,kind}:{status:'error',msg:'Claude returned nothing. Try again.'};
  }catch(err){sugg[path]={status:'error',msg:aiErr(err)};}
  if(route==='editor')renderForm();
}
function aiErr(err){
  const c=err&&err.code;
  if(c==='not_configured'){sample=null;document.body.classList.remove('has-ai');return 'Claude is not set up on this server. Add ANTHROPIC_API_KEY to .env and restart it.';}
  if(c==='too_long')return 'That text is too long to send in one request. Shorten it and try again.';
  if(c==='network')return 'Could not reach the server. Check that it is running.';
  if(c==='refused')return 'Claude declined this request.';
  return c==='rate_limited'?'Claude is busy. Wait a minute, then try again.':'Claude did not return a usable answer. Try again.';
}
let pdfjs=null;
async function pdfText(file){
  if(!pdfjs){
    pdfjs=await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc=(await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  }
  const pdf=await pdfjs.getDocument({data:await file.arrayBuffer()}).promise;
  let out='';
  for(let p=1;p<=pdf.numPages;p++){
    const tc=await (await pdf.getPage(p)).getTextContent();let ly=null;
    for(const it of tc.items){const y=it.transform?Math.round(it.transform[5]):ly;if(ly!==null&&y!==null&&Math.abs(y-ly)>2)out+='\n';out+=it.str;if(it.hasEOL){out+='\n';ly=null;}else ly=y;}
    out+='\n';
  }
  return out.replace(/\n{3,}/g,'\n\n');
}
async function restore(file){
  try{
    const p=JSON.parse(await file.text()),vs=p&&Array.isArray(p.versions)?p.versions:null;
    if(!vs)throw new Error('shape');
    const ids={};let n=0;
    vs.slice().reverse().forEach(v=>{
      if(!v||typeof v!=='object'||!v.data)return;
      const nv=newVersion(MODES[v.mode]?v.mode:'pro',String(v.label||'Restored resume'),v.data,null,{example:!!v.example,extracted:!!v.extracted});
      nv.dismissed=Array.isArray(v.dismissed)?v.dismissed.map(String):[];nv._from=v.parentId;ids[v.id]=nv.id;n++;
    });
    store.versions.forEach(v=>{if('_from' in v){v.parentId=ids[v._from]||null;delete v._from;}});
    save();homeMsg=n?'Restored '+n+' resume'+(n===1?'':'s')+' from '+file.name+'. Nothing was overwritten.':'No resumes were found in '+file.name+'.';
  }catch(e){homeMsg='That file is not a Resume Studio backup.';}
  if(route==='home')renderHome();
}
function saveFile(name,text,type){
  const u=URL.createObjectURL(new Blob([text],{type}));
  const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(u),1000);
}

/* ---------- form helpers ---------- */
const fid=p=>'f-'+p.replace(/\./g,'-');
const fld=(label,path,ph)=>'<label class="fld" for="'+fid(path)+'"><span>'+label+'</span><input id="'+fid(path)+'" data-path="'+path+'" value="'+h(get(path))+'" placeholder="'+h(ph||'')+'" autocomplete="off"></label>';
const area=(label,path,ph,rows)=>'<label class="fld" for="'+fid(path)+'"><span>'+label+'</span><textarea id="'+fid(path)+'" data-path="'+path+'" rows="'+(rows||4)+'" placeholder="'+h(ph||'')+'">'+h(get(path))+'</textarea></label>';
const sel=(label,path,opts)=>'<label class="fld" for="'+fid(path)+'"><span>'+label+'</span><select id="'+fid(path)+'" data-path="'+path+'">'+opts.map(o=>'<option'+(get(path)===o?' selected':'')+'>'+o+'</option>').join('')+'</select></label>';
function itemBtns(k,i){
  const n=state[k].length,mv=(dir,label,off)=>'<button class="btn ghost small" type="button" data-move="'+k+'.'+i+'.'+dir+'" aria-label="Move entry '+(i+1)+' '+label+'"'+(off?' disabled':'')+'>'+(dir<0?'↑':'↓')+'</button>';
  return '<div class="row">'+(n>1?mv(-1,'up',i===0)+mv(1,'down',i===n-1):'')+'<button class="btn ghost small" type="button" data-del="'+k+'.'+i+'">Remove</button></div>';
}
function aiRow(path,kind,label){
  const g=sugg[path];
  let o='<div class="row"><button class="btn ai small ai-only" type="button" data-ai="'+path+'" data-kind="'+kind+'"'+(g&&g.status==='loading'?' disabled':'')+'>'+(g&&g.status==='loading'?'Asking Claude…':label)+'</button><small class="no-ai" style="color:var(--muted)">Claude rewrites are off. Add ANTHROPIC_API_KEY to .env and restart the server.</small></div>';
  if(g&&g.status==='done')o+='<div class="sugg"><small>'+(g.kind==='idea'?'An idea from Claude for something to build. It goes on your resume only after you have built it.':'Suggested by Claude. It was told to keep your facts and add none. Check every claim before you use it.')+'</small><pre>'+h(g.text)+'</pre><div class="row">'+(g.kind==='idea'?'':'<button class="btn small" type="button" data-use="'+path+'">Use this wording</button>')+'<button class="btn ghost small" type="button" data-drop="'+path+'">'+(g.kind==='idea'?'Close':'Keep mine')+'</button></div></div>';
  if(g&&g.status==='error')o+='<div class="sugg"><small>'+h(g.msg)+'</small></div>';
  return o;
}
function intake(key,label){
  const s=VS[key];
  return '<label class="fld" for="'+key+'-text"><span>'+label+'</span><textarea id="'+key+'-text" data-st="'+key+'.text" rows="10" placeholder="Paste the full text of the resume here.">'+h(s.text)+'</textarea></label>'+
    '<div class="row"><label class="btn ghost small" for="'+key+'-file" style="cursor:pointer">Or choose a PDF, Word or text file</label><input type="file" id="'+key+'-file" data-file="'+key+'" accept=".pdf,.txt,.md,.docx" hidden><span class="status" id="'+key+'-fmsg">'+h(s.meta||'')+'</span></div>';
}

/* ---------- views ---------- */
function renderHome(){
  const rows=store.versions.map(v=>{
    const a=analyse(v.data,1,v.mode),par=v.parentId&&byId(v.parentId);
    return '<div class="srow"><div><div class="t">'+h(v.label)+(v.example?' <span class="tag">Example</span>':'')+'</div><div class="m">'+MODES[v.mode]+(par?' · copy of '+h(par.label):'')+' · '+h(v.data.contact.name||'No name yet')+'</div></div><span class="sc">'+a.score+' / 100'+(a.jd?' · JD '+a.jd.pct+'%':'')+'</span><div class="row"><button class="btn small" type="button" data-open="'+v.id+'">Open</button><button class="btn ghost small" type="button" data-dup="'+v.id+'">Duplicate</button><button class="btn small '+(pendingDel===v.id?'danger':'ghost')+'" type="button" data-rm="'+v.id+'">'+(pendingDel===v.id?'Confirm delete':'Delete')+'</button></div></div>';
  }).join('');
  $('view').innerHTML=
  '<section class="hero"><h1>Build a resume that reflects your real strengths.</h1><p>Four ways in, one resume engine. Every route checks the page as you write, keeps to facts you have confirmed, and exports LaTeX source you own.</p></section>'+
  '<section class="opts">'+
    '<div class="opt"><span class="n">OPTION 1</span><h2>Fresher resume builder</h2><p>No job history yet. Build a first resume from education, projects, coursework and activities.</p><div class="row"><button class="btn" type="button" data-new="fresher">Start blank</button><button class="btn ghost" type="button" data-ex="fresher">Open the example</button></div></div>'+
    '<div class="opt"><span class="n">OPTION 2</span><h2>Tailor a resume to a job</h2><p>Pick a saved resume or bring your own, add the job description, and get a separate tailored copy. The original stays as it is.</p><div class="row"><button class="btn" type="button" data-go="tailor">Tailor a resume</button></div></div>'+
    '<div class="opt"><span class="n">OPTION 3</span><h2>Professional resume builder</h2><p>For experienced candidates. Seven screening layers check dates, role fit, evidence for skills and wording, with a reason for each flag.</p><div class="row"><button class="btn" type="button" data-new="pro">Start blank</button><button class="btn ghost" type="button" data-ex="pro">Open the example</button></div></div>'+
    '<div class="opt"><span class="n">OPTION 4</span><h2>Check any resume</h2><p>Paste or upload a resume made anywhere. Add a job description if you have one. Get a score and a prioritised plan.</p><div class="row"><button class="btn" type="button" data-go="checker">Check a resume</button></div></div>'+
  '</section>'+
  '<section class="col"><h2 style="font:700 19px var(--display)">Saved resumes</h2><p class="help">Saved in this browser only. There are no accounts yet, so keep a backup file if these matter.</p><div class="row"><button class="btn ghost small" type="button" id="bk-export">Download a backup</button><label class="btn ghost small" for="bk-file" style="cursor:pointer">Restore from a backup</label><input type="file" id="bk-file" data-import="1" accept=".json,application/json" hidden><span class="status" role="status">'+h(homeMsg)+'</span></div><div class="saved">'+(rows||'<p class="help">Nothing saved yet.</p>')+'</div></section>';
}
function renderTailor(){
  const s=VS.tl,src=store.versions;
  if(!s.vid||!byId(s.vid))s.vid=src.length?src[0].id:'';
  if(!src.length)s.source='paste';
  $('view').innerHTML='<section class="two"><div class="panel"><h2>1. Choose the resume to tailor</h2>'+
    '<div class="radio"><label for="tl-s1"><input type="radio" name="tl-source" id="tl-s1" data-radio="saved"'+(s.source==='saved'?' checked':'')+(src.length?'':' disabled')+'> A saved resume</label><label for="tl-s2"><input type="radio" name="tl-source" id="tl-s2" data-radio="paste"'+(s.source==='paste'?' checked':'')+'> Paste or upload one</label></div>'+
    (s.source==='saved'?'<label class="fld" for="tl-vid"><span>Saved resume</span><select id="tl-vid" data-st="tl.vid">'+src.map(v=>'<option value="'+v.id+'"'+(v.id===s.vid?' selected':'')+'>'+h(v.label)+' ('+h(v.data.contact.name||'no name')+')</option>').join('')+'</select></label>'
      :intake('tl','Resume text')+'<p class="help ai-only" style="display:block">Claude reads the text into the form fields, copying facts as written. You then check every field before exporting.</p><p class="help no-ai">Reading a pasted resume into the form needs Claude. Add ANTHROPIC_API_KEY to .env and restart the server.</p>')+
    '</div><div class="panel"><h2>2. Add the job</h2><div class="grid2"><label class="fld" for="tl-role"><span>Job title</span><input id="tl-role" data-st="tl.role" value="'+h(s.role)+'" autocomplete="off"></label><label class="fld" for="tl-company"><span>Company (optional)</span><input id="tl-company" data-st="tl.company" value="'+h(s.company)+'" autocomplete="off"></label></div>'+
    '<label class="fld" for="tl-jd"><span>Job description</span><textarea id="tl-jd" data-st="tl.jd" rows="9" placeholder="Paste the full job description.">'+h(s.jd)+'</textarea></label>'+
    '<p class="help">The copy reorders your skills, projects and bullets so the ones this job asks for come first. It changes no wording and adds no skills. Rewording is a separate step you approve bullet by bullet.</p>'+
    '<div class="row"><button class="btn" type="button" id="tl-create"'+(s.busy?' disabled':'')+'>'+(s.busy?'Reading the resume…':'Create tailored copy')+'</button></div><div class="status" role="status">'+h(s.msg)+'</div></div></section>';
}
function planHTML(F){
  return [['fix','Fix first'],['improve','Improve next'],['optional','Optional refinements']].map(([k,l])=>{const fs=F.filter(f=>f.sev===k);return fs.length?'<h3 class="grp '+k+'"><i></i>'+l+' ('+fs.length+')</h3>'+fs.map(f=>'<div class="find '+k+'"><b>'+h(f.title)+'</b><span class="why">'+h(f.why)+'</span></div>').join(''):'';}).join('');
}
const rubricHTML=rub=>'<ul class="rubric">'+rub.map(c=>{const k=c.got>=c.max?'':c.got>0?'part':'miss';return '<li class="'+k+'"><span class="st">'+(k===''?'ok':k==='part'?'partial':'fix')+'</span><span><b>'+c.label+'</b><span class="why">'+h(c.why)+'</span></span><span class="pts">'+c.got+' / '+c.max+'</span></li>';}).join('')+'</ul>';
function renderChecker(){
  const s=VS.chk,r=s.report;
  let rep='<div class="panel"><h2>Your report appears here</h2><p class="help">Paste a resume and choose Check resume. The checks run in your browser. Nothing is sent to a server.</p></div>';
  if(r){
    rep='<div class="panel"><h2>Report</h2><div class="scorebox"><div class="score-card"><span class="lbl">ATS Readiness Score</span><span class="num">'+r.score+'<small> / 100</small></span><div class="bar"><i style="width:'+r.score+'%"></i></div></div>'+
      '<div class="score-card"><span class="lbl">JD Match Score</span>'+(r.jd?'<span class="num">'+r.jd.pct+'<small>%</small></span><div class="bar"><i style="width:'+r.jd.pct+'%"></i></div>':'<span class="num"><small>'+(s.jd.trim()?'No recognised terms in the job description':'No job description added')+'</small></span>')+'</div></div>'+
      '<p class="help">How this is scored: seven checks on the extracted text, shown below with the points each one earned. No universal ATS score exists, and this does not reproduce any employer\'s system.</p>'+
      (r.findings.length?planHTML(r.findings):'<p class="help">No issues found by these checks.</p>')+
      (r.jd?'<h3 class="grp optional" style="margin-top:4px">Job description terms found ('+r.jd.hit.length+' of '+r.jd.terms.length+')</h3><div class="chips">'+(r.jd.hit.map(t=>'<span class="chip hit">'+h(t)+'</span>').join('')||'<span class="help">None.</span>')+'</div>':'')+
      '<h3 class="grp optional" style="margin-top:4px">Score breakdown</h3>'+rubricHTML(r.rub)+
      '<div class="row"><button class="btn ai ai-only" type="button" id="chk-import"'+(s.busy?' disabled':'')+'>'+(s.busy?'Reading the resume…':'Fix these in the editor')+'</button><small class="no-ai" style="color:var(--muted)">Moving this resume into the editor needs Claude. Add ANTHROPIC_API_KEY to .env and restart the server.</small></div><div class="status" role="status">'+h(s.msg)+'</div></div>';
  }
  $('view').innerHTML='<section class="two"><div class="panel"><h2>Check any resume</h2><p class="help">Works on a resume made anywhere. Add a job description for role-specific checks.</p>'+intake('chk','Resume text')+
    '<label class="fld" for="chk-jd"><span>Job description (optional)</span><textarea id="chk-jd" data-st="chk.jd" rows="6" placeholder="Paste the job description for a JD Match Score.">'+h(s.jd)+'</textarea></label>'+
    '<div class="row"><button class="btn" type="button" id="chk-run">Check resume</button><button class="btn ghost" type="button" id="chk-sample">Load a sample with problems</button></div></div>'+rep+'</section>';
}
const SAMPLE_TEXT='ROHAN S.\nrohan.s@example.com\n\nMy Journey\nWorked at Greenleaf Retail as store associate from 03/2023 to now. Responsible for billing and stock.\nHelped customers and did inventory.\n\nAcademic\nB.Com, City College, 2019-2022\n\nThings I know\nExcel, Tally, customer service';

function renderEditor(){
  const v=cur();if(!v){go('home');return;}
  state=v.data;
  const tabs=TABS[v.mode];if(!tabs.some(t=>t[0]===editTab))editTab='details';
  const par=v.parentId&&byId(v.parentId);
  if(pvTab==='compare'&&!par)pvTab='preview';
  let ban='';
  if(v.example)ban+='<div class="banner"><span><b>Example data.</b> This person, their college and their employers are made up. Edit freely or start a blank resume from the home screen.</span></div>';
  if(par)ban+='<div class="banner"><span><b>Tailored copy of '+h(par.label)+'.</b> The original is untouched. Skills, projects and bullets that match the job description were moved first. No wording was changed.</span></div>';
  if(v.extracted)ban+='<div class="banner"><span><b>Read from pasted text by Claude.</b> Check names, titles and dates in every tab before you export.</span></div>';
  $('view').innerHTML='<div class="edbar"><input id="v-label" data-vlabel value="'+h(v.label)+'" aria-label="Resume name"><span class="tag">'+MODES[v.mode]+'</span><span class="grow"></span><button class="btn ghost small" type="button" data-dup="'+v.id+'">Save as a new copy</button></div>'+ban+
  '<div class="ed"><section class="col f"><div class="tabs" role="tablist">'+tabs.map(([id,l],i)=>'<button class="tab" role="tab" type="button" data-edit="'+id+'" aria-selected="'+(id===editTab)+'"><span class="n">'+(i+1)+'</span>'+l+'</button>').join('')+'</div><div class="panel" id="form"></div></section>'+
  '<section class="col p"><div class="tabs" role="tablist">'+[['preview','Preview'],par&&['compare','Compare with original'],['source','LaTeX and export']].filter(Boolean).map(([id,l])=>'<button class="tab" role="tab" type="button" data-pv="'+id+'" aria-selected="'+(id===pvTab)+'">'+l+'</button>').join('')+'</div>'+
    '<div id="pv-preview" class="col"'+(pvTab==='preview'?'':' hidden')+'><div class="tpl">'+TEMPLATES.map(t=>'<button type="button" data-tpl="'+t.id+'" aria-pressed="'+(t.id===state.template)+'"><b>'+t.name+'</b><small>'+t.note+'</small></button>').join('')+'</div><div class="meta"><label for="hl-toggle"><input type="checkbox" id="hl-toggle" checked> Mark job description terms</label><span id="fit-note"></span></div><div class="sheet-wrap" id="wrap"><div class="sheet" id="sheet"></div><div class="pagebreak" id="pagebreak" hidden><span>Page 1 ends here</span></div></div><p class="help">An on-screen approximation of the typeset page. The final PDF comes from compiling the LaTeX source.</p></div>'+
    '<div id="pv-compare" class="cmp"'+(pvTab==='compare'?'':' hidden')+'></div>'+
    '<div id="pv-source" class="panel"'+(pvTab==='source'?'':' hidden')+'><h2>LaTeX and export</h2><div id="precheck"></div><p class="help">Built from your structured details and a fixed template, with your text escaped. Compile it in Overleaf or with pdflatex for the typeset PDF, or print the HTML version straight from the browser.</p><div class="row"><button class="btn" id="btn-copy" type="button">Copy source</button><button class="btn ghost dl-only" id="btn-dl-tex" type="button">Download resume.tex</button><button class="btn ghost dl-only" id="btn-dl-html" type="button">Download print-ready HTML</button><button class="btn ghost" id="btn-print" type="button">Print or save as PDF</button></div><div class="status" id="src-status" role="status"></div><pre class="src" id="src"></pre></div>'+
  '</section><aside class="panel b" id="fb" aria-label="Live feedback"></aside></div>';
  renderForm();renderSheet();
  if(ro)ro.disconnect();
  if(window.ResizeObserver){ro=new ResizeObserver(()=>measure());ro.observe($('wrap'));}
}
function renderForm(){
  const d=state,v=cur(),fresh=v.mode==='fresher';let o='';
  if(editTab==='details'){
    o='<h2>Who you are</h2><p class="help">Contact details go at the top of the page. Location is optional.</p><div class="grid2">'+fld('Full name','contact.name')+fld('Email','contact.email','you@example.com')+fld('Phone','contact.phone')+fld('Location','contact.location','City, State')+fld('LinkedIn','contact.linkedin','linkedin.com/in/…')+fld('GitHub or portfolio','contact.github')+'</div>'+area('Summary','summary','Two or three sentences on what you do and what you are looking for.',4)+aiRow('summary','summary','Draft from my details');
  }else if(editTab==='education'){
    o='<h2>Education</h2><p class="help">Write dates like Jan 2026 so every entry matches.</p>'+d.education.map((e,i)=>{const p='education.'+i+'.';return '<div class="item"><div class="item-head"><b>ENTRY '+(i+1)+'</b>'+itemBtns('education',i)+'</div><div class="grid2">'+fld('Institution',p+'inst')+fld('Qualification',p+'qual','B.Tech, B.Com, MBA…')+fld('Field of study',p+'field')+fld('Grade (optional)',p+'grade')+fld('Start',p+'start','Aug 2022')+fld('End',p+'end','May 2026')+'</div>'+fld('Relevant coursework (optional)',p+'coursework','Subjects that relate to the job, separated by commas')+'</div>';}).join('')+'<div class="row"><button class="btn ghost" type="button" data-add="education">Add education</button></div>';
  }else if(editTab==='experience'){
    o='<h2>'+(fresh?'Internships and activities':'Work history')+'</h2><p class="help">'+(fresh?'No job yet? Leave this empty or add internships, volunteering and clubs. Each one is labelled as what it was, never as a job.':'Describe what you did in plain words, one point per line. Leave out numbers you cannot back up.')+'</p>'+d.experience.map((e,i)=>{const p='experience.'+i+'.';return '<div class="item"><div class="item-head"><b>ENTRY '+(i+1)+'</b>'+itemBtns('experience',i)+'</div><div class="grid2">'+sel('Type',p+'type',TYPES)+fld('Organisation',p+'company')+fld('Role or title',p+'role')+fld('Location',p+'location')+fld('Start',p+'start','Jan 2026')+fld('End',p+'end','Present')+'</div>'+area('What you did, one point per line',p+'bullets','',5)+aiRow(p+'bullets','bullets','Improve wording')+'</div>';}).join('')+'<div class="row"><button class="btn ghost" type="button" data-add="experience">Add an entry</button></div>';
  }else if(editTab==='projects'){
    o='<h2>Projects</h2><p class="help">'+(fresh?'Academic, personal or portfolio work. Say what you built yourself and name the tools you used.':'Side projects, internal tools or freelance work worth showing.')+'</p>'+d.projects.map((e,i)=>{const p='projects.'+i+'.';return '<div class="item"><div class="item-head"><b>PROJECT '+(i+1)+'</b>'+itemBtns('projects',i)+'</div><div class="grid2">'+fld('Project name',p+'name')+fld('Your role (optional)',p+'role','Team lead, solo project…')+fld('Technologies',p+'tech','Python, Flask')+'</div>'+area('What you built, one point per line',p+'bullets','',4)+aiRow(p+'bullets','bullets','Improve wording')+'</div>';}).join('')+'<div class="row"><button class="btn ghost" type="button" data-add="projects">Add project</button></div>'+(fresh?aiRow('idea','idea','Suggest a project I could build'):'');
  }else if(editTab==='skills'){
    o='<h2>Skills, certifications and achievements</h2><p class="help">List only skills you could answer questions about. Separate them with commas.</p>'+area('Skills','skills','Python, SQL, Git',3)+area('Certifications, workshops and training, one per line','certs','',3)+area('Achievements and awards, one per line','achievements','',3);
  }else{
    o='<h2>The job you are applying for</h2><p class="help">Paste the full job description. The feedback panel compares it with your resume as you edit.</p><div class="grid2">'+fld('Target job title','target')+fld('Company (optional)','company')+'</div>'+area('Job description','jd','Paste the job description here.',12);
  }
  $('form').innerHTML=o;
}
function renderSheet(){
  const el=$('sheet');if(!el)return;
  el.className='sheet tpl-'+state.template;
  el.innerHTML=sheetHTML(state,$('hl-toggle').checked);
  $('src').textContent=texDoc(state);
  const v=cur(),par=v.parentId&&byId(v.parentId);
  if(par&&pvTab==='compare')$('pv-compare').innerHTML='<div><h3>Original · '+h(par.label)+'</h3><div class="sheet-wrap"><div class="sheet tpl-'+par.data.template+'">'+sheetHTML(par.data,false)+'</div></div></div><div><h3>Tailored · '+h(v.label)+'</h3><div class="sheet-wrap"><div class="sheet tpl-'+state.template+'">'+sheetHTML(state,true)+'</div></div></div>';
  requestAnimationFrame(measure);
}
function measure(){
  const el=$('sheet'),w=$('wrap');if(!el||!w)return;
  if(w.offsetWidth>0){
    const np=Math.max(1,Math.ceil((el.offsetHeight-4)/(w.offsetWidth*297/210)));
    const v=cur(),allowed=(v.mode==='pro'||state.template==='senior')?2:1;
    pages=np;$('pagebreak').hidden=np<2;
    $('fit-note').textContent=np===1?'Fits one A4 page':np<=allowed?np+' pages, fine for an experienced resume':'Runs to '+np+' pages. Aim for '+allowed+'.';
    $('fit-note').style.color=np>allowed?'var(--bad)':'';
  }
  renderFeedback();
}
function renderFeedback(){
  const v=cur(),el=$('fb');if(!v||!el)return;
  const a=analyse(state,pages,v.mode);lastA=a;
  if(curScore===null)curScore=a.score;else if(a.score!==curScore){prevScore=curScore;curScore=a.score;}
  checkedAt=new Date().toLocaleTimeString();
  const open=a.findings.filter(f=>!v.dismissed.includes(f.id)),nd=a.findings.length-open.length;
  const delta=prevScore===null?'':'<span class="delta '+(curScore>prevScore?'up':'down')+'">'+(curScore>prevScore?'+':'')+(curScore-prevScore)+' since your last change</span>';
  let o='<h2>Live feedback</h2><div class="scorebox"><div class="score-card"><span class="lbl">ATS Readiness Score</span><span class="num">'+a.score+'<small> / 100</small></span><div class="bar"><i style="width:'+a.score+'%"></i></div>'+delta+'</div>'+
    '<div class="score-card"><span class="lbl">JD Match Score</span>'+(a.jd?'<span class="num">'+a.jd.pct+'<small>%</small></span><div class="bar"><i style="width:'+a.jd.pct+'%"></i></div>':'<span class="num"><small>Add a job description</small></span>')+'</div></div>'+
    '<p class="help">Checked at '+checkedAt+'. A transparent rubric with a reason for every flag. It does not reproduce any employer\'s screening system.</p>';
  if(v.mode==='pro')o+='<h3 class="grp optional">Screening layers</h3><ul class="layers">'+LAYERS.map(([k,l])=>{const n=open.filter(f=>f.layer===k).length;const na=k==='jd'&&!state.jd.trim();return '<li><span>'+l+'</span><span class="'+(n||na?'no':'ok')+'">'+(na?'no JD':n?n+' to review':'clear')+'</span></li>';}).join('')+'</ul>';
  [['fix','Fix first'],['improve','Improve next'],['optional','Optional refinements']].forEach(([k,l])=>{
    const fs=open.filter(f=>f.sev===k);if(!fs.length)return;
    o+='<h3 class="grp '+k+'"><i></i>'+l+' ('+fs.length+')</h3>'+fs.map(f=>'<div class="find '+k+'">'+(v.mode==='pro'?'<span class="lay">'+(LAYERS.find(x=>x[0]===f.layer)||['',''])[1]+'</span>':'')+'<b>'+h(f.title)+'</b><span class="why">'+h(f.why)+'</span>'+(f.chips?'<div class="chips">'+f.chips.map(t=>'<span class="chip">'+h(t)+'<button type="button" data-skill="'+h(t)+'">I have this skill</button></span>').join('')+'</div>':'')+'<div class="row"><button class="btn ghost small" type="button" data-review="'+f.tab+'">Review</button>'+(f.apply?'<button class="btn small" type="button" data-apply="'+f.apply+'">'+f.applyLabel+'</button>':'')+'<button class="btn ghost small" type="button" data-dismiss="'+f.id+'">Dismiss</button></div></div>').join('');
  });
  if(!open.length)o+='<p class="help">Nothing open. Read the page once more yourself before you send it.</p>';
  if(nd)o+='<div class="row"><small style="color:var(--muted)">'+nd+' dismissed.</small><button class="btn ghost small" type="button" data-undismiss="1">Show them again</button></div>';
  if(a.jd&&a.jd.hit.length)o+='<h3 class="grp optional">Job description terms found ('+a.jd.hit.length+' of '+a.jd.terms.length+')</h3><div class="chips">'+a.jd.hit.map(t=>'<span class="chip hit">'+h(t)+'</span>').join('')+'</div>';
  el.innerHTML=o;
  const pc=$('precheck');
  if(pc){const fx=open.filter(f=>f.sev==='fix');pc.innerHTML='<div class="banner" style="border-left-color:'+(fx.length?'var(--bad)':'var(--good)')+'"><span><b>Final check before export.</b> '+(fx.length?fx.length+' fix-first item'+(fx.length>1?'s are':' is')+' still open: '+fx.map(f=>h(f.title)).join('; ')+'.':'No fix-first items are open. Readiness '+a.score+' / 100, '+pages+' page'+(pages>1?'s':'')+'.')+' Confirm every claim on the page is true before you send it.</span></div>';}
}

/* ---------- navigation and persistence ---------- */
function save(){try{localStorage.setItem(KEY,JSON.stringify(store));}catch(e){}}
function touch(){const v=cur();if(v)v.updated=Date.now();save();}
function go(r){route=r;pendingDel=null;homeMsg='';try{if(location.hash!=='#'+r)location.hash=r;}catch(e){}render();}
function openVersion(id){store.currentId=id;editTab='details';pvTab='preview';prevScore=curScore=null;pages=1;Object.keys(sugg).forEach(k=>delete sugg[k]);save();go('editor');}
function render(){
  if(route==='editor')renderEditor();else if(route==='tailor')renderTailor();else if(route==='checker')renderChecker();else renderHome();
}
const APPLY={
  capBullets(d){[...d.experience,...d.projects].forEach(e=>{e.bullets=String(e.bullets).split('\n').map(l=>l.replace(/^(\s*[-•*]?\s*)([a-z])/,(m,a,b)=>a+b.toUpperCase())).join('\n');});},
  fixDates(d){[...d.education,...d.experience].forEach(e=>{e.start=normDate(e.start);e.end=normDate(e.end);});},
  jdFirst(d){const t=jdTerms(d.jd),k=list(d.skills);d.skills=[...k.filter(s=>t.some(x=>has(s,x))),...k.filter(s=>!t.some(x=>has(s,x)))].join(', ');}
};

/* ---------- events ---------- */
document.addEventListener('input',e=>{
  const t=e.target,ds=t.dataset||{};
  if(ds.path&&state){set(ds.path,t.value);renderSheet();touch();}
  else if(ds.st){const [o,k]=ds.st.split('.');VS[o][k]=t.value;}
  else if('vlabel' in ds){const v=cur();if(v){v.label=t.value;touch();}}
  else if(t.id==='hl-toggle')renderSheet();
});
document.addEventListener('change',async e=>{
  const t=e.target,ds=t.dataset||{};
  if(ds.import){if(t.files&&t.files[0])await restore(t.files[0]);return;}
  if(ds.radio){VS.tl.source=ds.radio;renderTailor();}
  else if(ds.file&&t.files&&t.files[0]){
    const f=t.files[0],s=VS[ds.file],name=f.name.toLowerCase();
    const done=()=>{if(route==='tailor')renderTailor();else if(route==='checker')renderChecker();};
    try{
      if(name.endsWith('.docx')){s.meta='Reading '+f.name+'…';done();s.text=await docxText(await f.arrayBuffer());s.meta=s.text.trim().length<50?f.name+': no text found in this file.':'Read '+f.name+'. Check the text above matches your resume.';}
      else if(name.endsWith('.pdf')){s.meta='Reading '+f.name+'…';done();s.text=await pdfText(f);s.meta=s.text.trim().length<50?f.name+': no selectable text found. It may be a scanned image.':'Read '+f.name+'. Check the text above matches your resume.';}
      else{s.text=await f.text();s.meta='Read '+f.name+'.';}
    }catch(err){s.meta='Could not read '+f.name+' here. Copy the text from the file and paste it above.';}
    done();
  }
});
document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;const d=b.dataset;
  if(d.go){go(d.go);}
  else if(d.new){const v=newVersion(d.new,d.new==='pro'?'Professional resume':'My first resume',Object.assign(clone(BLANK),{template:d.new==='pro'?'senior':'starter'}));openVersion(v.id);}
  else if(d.ex){let v=store.versions.find(x=>x.example&&x.mode===d.ex);if(!v)v=newVersion(d.ex,d.ex==='pro'?'Arjun · operations (example)':'Meera · first resume (example)',d.ex==='pro'?EX_PRO:EX_FRESHER,null,{example:true});openVersion(v.id);}
  else if(d.open){openVersion(d.open);}
  else if(d.dup){const s=byId(d.dup);if(s){const v=newVersion(s.mode,s.label.replace(/ \(example\)$/,'')+' copy',s.data,s.parentId,{extracted:s.extracted});v.dismissed=s.dismissed.slice();save();if(route==='editor')openVersion(v.id);else renderHome();}}
  else if(d.rm){if(pendingDel===d.rm){store.versions=store.versions.filter(v=>v.id!==d.rm);store.versions.forEach(v=>{if(v.parentId===d.rm)v.parentId=null;});pendingDel=null;save();}else pendingDel=d.rm;renderHome();}
  else if(d.edit){editTab=d.edit;renderEditor();}
  else if(d.pv){pvTab=d.pv;renderEditor();}
  else if(d.tpl){state.template=d.tpl;touch();renderEditor();}
  else if(d.add){state[d.add].push(clone(NEW[d.add]));if(d.add==='experience'&&cur().mode==='fresher')state.experience[state.experience.length-1].type='Internship';touch();renderForm();renderSheet();}
  else if(d.move){const [k,i,dir]=d.move.split('.'),a=state[k],j=+i+ +dir;if(j>=0&&j<a.length){[a[+i],a[j]]=[a[j],a[+i]];Object.keys(sugg).forEach(p=>{if(p.startsWith(k+'.'))delete sugg[p];});touch();renderForm();renderSheet();}}
  else if(d.del){const [k,i]=d.del.split('.');state[k].splice(+i,1);Object.keys(sugg).forEach(p=>{if(p.startsWith(k+'.'))delete sugg[p];});touch();renderForm();renderSheet();}
  else if(d.ai){runAI(d.ai,d.kind);}
  else if(d.use){set(d.use,sugg[d.use].text);delete sugg[d.use];touch();renderForm();renderSheet();}
  else if(d.drop){delete sugg[d.drop];renderForm();}
  else if(d.skill){const k=list(state.skills);if(!k.some(x=>x.toLowerCase()===d.skill))k.push(d.skill.replace(/(^|[\s\-\/])[a-z]/g,m=>m.toUpperCase()));state.skills=k.join(', ');touch();renderForm();renderSheet();}
  else if(d.review){editTab=d.review;renderForm();document.querySelectorAll('[data-edit]').forEach(x=>x.setAttribute('aria-selected',String(x.dataset.edit===editTab)));const f=$('form');if(f&&f.scrollIntoView)f.scrollIntoView({block:'nearest'});}
  else if(d.apply){APPLY[d.apply](state);touch();renderForm();renderSheet();}
  else if(d.dismiss){cur().dismissed.push(d.dismiss);touch();renderFeedback();}
  else if(d.undismiss){cur().dismissed=[];touch();renderFeedback();}
  else if(b.id==='chk-sample'){VS.chk.text=SAMPLE_TEXT;VS.chk.jd='';VS.chk.meta='Sample loaded. This person is made up.';VS.chk.report=analyseText(SAMPLE_TEXT,'');VS.chk.msg='';renderChecker();}
  else if(b.id==='chk-run'){const s=VS.chk;if(!s.text.trim()){s.report=null;s.meta='Paste the resume text first.';}else{s.report=analyseText(s.text,s.jd);s.msg='';}renderChecker();}
  else if(b.id==='chk-import'){
    const s=VS.chk;if(!sample||s.busy)return;s.busy=true;s.msg='';renderChecker();
    try{const data=await extract(s.text);data.jd=s.jd;data.template='corp';const v=newVersion('pro',(data.contact.name||'Imported')+' · imported',data,null,{extracted:true});s.busy=false;openVersion(v.id);}
    catch(err){s.busy=false;s.msg=aiErr(err);if(route==='checker')renderChecker();}
  }
  else if(b.id==='tl-create'){
    const s=VS.tl;if(s.busy)return;
    if(!s.jd.trim()){s.msg='Paste the job description first.';renderTailor();return;}
    const label=[s.role.trim()||'Tailored copy',s.company.trim()].filter(Boolean).join(' · ');
    const make=src=>{const data=clone(src.data);data.jd=s.jd;if(s.role.trim())data.target=s.role.trim();data.company=s.company.trim();tailorData(data);const v=newVersion('tailor',label,data,src.id,{extracted:src.extracted});s.msg='';openVersion(v.id);};
    if(s.source==='saved'){const src=byId(s.vid);if(!src){s.msg='Choose a saved resume.';renderTailor();return;}make(src);}
    else{
      if(!s.text.trim()){s.msg='Paste the resume text first.';renderTailor();return;}
      if(!sample){s.msg='Reading pasted text into the form needs Claude, which is not set up on this server. Tailor a saved resume instead.';renderTailor();return;}
      s.busy=true;s.msg='';renderTailor();
      try{const data=await extract(s.text);const src=newVersion('pro',(data.contact.name||'Imported')+' · original',data,null,{extracted:true});s.busy=false;make(src);}
      catch(err){s.busy=false;s.msg=aiErr(err);if(route==='tailor')renderTailor();}
    }
  }
  else if(b.id==='bk-export'){saveFile('resume-studio-backup.json',JSON.stringify({app:'ai-resume-studio',versions:store.versions},null,1),'application/json');homeMsg='Backup saved with '+store.versions.length+' resume'+(store.versions.length===1?'':'s')+'.';renderHome();}
  else if(b.id==='btn-copy'){
    try{await navigator.clipboard.writeText(texDoc(state));$('src-status').textContent='Source copied.';}
    catch(err){$('src-status').textContent='Copying was blocked. Select the source below and copy it by hand.';}
  }
  else if(b.id==='btn-dl-tex'){saveFile('resume.tex',texDoc(state),'application/x-tex');$('src-status').textContent='Saved resume.tex. Compile it with pdflatex or upload it to Overleaf.';}
  else if(b.id==='btn-dl-html'){saveFile('resume.html',exportHTML(state),'text/html');$('src-status').textContent='Saved resume.html. Open it in a browser and print to PDF.';}
  else if(b.id==='btn-print'){
    const w=window.open('','_blank');
    if(!w){$('src-status').textContent='The print window was blocked. Allow pop-ups for this page, or download the HTML instead.';return;}
    w.document.write(exportHTML(state));w.document.close();
    const go=()=>{w.focus();w.print();};
    if(w.document.fonts&&w.document.fonts.ready)w.document.fonts.ready.then(()=>setTimeout(go,150));else setTimeout(go,800);
    $('src-status').textContent='In the print dialog choose "Save as PDF", A4, and turn off headers and footers.';
  }
});
window.addEventListener('hashchange',()=>{const r=(location.hash||'').slice(1);if(['home','editor','tailor','checker'].includes(r)&&r!==route){route=r;render();}});

/* ---------- boot ---------- */
function start(saved){
  let s=saved&&saved.store&&Array.isArray(saved.store.versions)?saved.store:null;
  if(!s){try{const p=JSON.parse(localStorage.getItem(KEY)||'null');if(p&&Array.isArray(p.versions))s=p;}catch(e){}}
  if(s){store=s;store.versions.forEach(v=>{v.data=normalise(v.data);v.dismissed=v.dismissed||[];if(!MODES[v.mode])v.mode='pro';});}
  else{store={versions:[],currentId:null};newVersion('pro','Arjun · operations (example)',EX_PRO,null,{example:true});newVersion('fresher','Meera · first resume (example)',EX_FRESHER,null,{example:true});}
  let r=(saved&&saved.route)||'';
  try{const hr=(location.hash||'').slice(1);if(hr)r=hr;}catch(e){}
  route=['home','editor','tailor','checker'].includes(r)?r:'home';
  if(route==='editor'&&!cur())route='home';
  render();
}
start({});
fetch('/api/health').then(r=>r.json()).then(j=>{sample=j.ai?true:null;document.body.classList.toggle('has-ai',!!j.ai);}).catch(()=>{});
