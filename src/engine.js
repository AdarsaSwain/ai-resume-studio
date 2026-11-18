/* Resume engine: data shapes, scoring, preview HTML, LaTeX. Pure functions, no DOM, shared by the browser and the server. */
/* ---------- paper styles, shared by the preview and the HTML export ---------- */
const PAPER_CSS = `
.sheet{background:#fff;color:#14161a;padding:4.4em 4.8em;line-height:1.33;font-family:"STIX Two Text",Georgia,serif}
.sheet *{margin:0}
.sheet .name{font-size:2.3em;font-weight:600;line-height:1.1;text-align:center}
.sheet .contact{text-align:center;margin-top:.5em;font-size:.95em;overflow-wrap:anywhere}
.sheet .dot{margin:0 .5em;color:#777}
.sheet section{margin-top:1.15em}
.sheet h2{font-size:1.08em;font-weight:600;font-variant:small-caps;letter-spacing:.04em;border-bottom:.07em solid #14161a;padding-bottom:.15em;margin-bottom:.5em}
.sheet .entry{margin-bottom:.65em}
.sheet .line{display:flex;justify-content:space-between;gap:1em;align-items:baseline}
.sheet .line span:last-child{white-space:nowrap;text-align:right}
.sheet .sub{font-style:italic}
.sheet .cw{margin-top:.15em}
.sheet ul{padding-left:1.3em;margin-top:.2em}
.sheet li{margin-top:.12em}
.sheet mark{background:#ffe066;color:inherit;padding:0 .1em}
.sheet .empty{color:#888;font-style:italic;text-align:center;margin-top:3em}
.sheet.tpl-tech{font-family:"IBM Plex Sans",Helvetica,Arial,sans-serif;line-height:1.36}
.sheet.tpl-tech .name{text-align:left;letter-spacing:-.01em}
.sheet.tpl-tech .contact{text-align:left}
.sheet.tpl-tech h2{font-variant:normal;text-transform:uppercase;font-size:.86em;letter-spacing:.12em;border-bottom-width:.05em;border-color:#9aa0aa}
.sheet.tpl-corp{font-family:"EB Garamond",Garamond,Georgia,serif;font-size-adjust:.46}
.sheet.tpl-corp .name{text-transform:uppercase;letter-spacing:.08em;font-weight:400;font-size:2em}
.sheet.tpl-corp h2{font-variant:normal;text-transform:uppercase;letter-spacing:.1em;font-size:.95em;border-bottom:.2em double #14161a}
.sheet.tpl-senior{font-family:"Source Serif 4",Georgia,serif;line-height:1.36}
.sheet.tpl-senior .name{text-align:left;font-size:2.5em;color:#1b2a4a}
.sheet.tpl-senior .contact{text-align:left;border-bottom:.14em solid #1b2a4a;padding-bottom:.7em}
.sheet.tpl-senior h2{font-variant:normal;text-transform:uppercase;font-size:.84em;letter-spacing:.14em;color:#1b2a4a;border-bottom:none;margin-bottom:.35em}
`;

/* ---------- data ---------- */
const BLANK = {template:'starter',contact:{name:'',email:'',phone:'',location:'',linkedin:'',github:''},target:'',company:'',summary:'',education:[],experience:[],projects:[],skills:'',certs:'',achievements:'',jd:''};
const EX_FRESHER = {
  template:'starter',
  contact:{name:'Meera Kulkarni',email:'meera.kulkarni@example.com',phone:'+91 90000 00000',location:'Pune, Maharashtra',linkedin:'linkedin.com/in/example',github:'github.com/example'},
  target:'Junior Backend Developer',company:'',
  summary:'Final-year computer engineering student who builds backend services in Python. Completed a six-month internship building REST APIs for a grocery delivery startup.',
  education:[{inst:'Sahyadri Institute of Technology, Pune',qual:'B.Tech',field:'Computer Engineering',start:'Aug 2022',end:'May 2026',grade:'CGPA 8.4 / 10',coursework:'Data Structures, Database Systems, Operating Systems, Computer Networks'}],
  experience:[
    {type:'Internship',company:'Kirana Loop',role:'Backend Intern',location:'Pune',start:'Jan 2026',end:'Jun 2026',bullets:'Built REST APIs in Flask for the order tracking feature\nWrote SQL queries and migrations for the PostgreSQL orders database\nhelped fix bugs reported by the support team'},
    {type:'Club or activity',company:'College Coding Club',role:'Core team member',location:'',start:'Aug 2024',end:'Apr 2025',bullets:'Ran weekly Python practice sessions for first-year students'}
  ],
  projects:[
    {name:'Brain Tumor Detection',tech:'Python, machine learning',role:'',bullets:'Built a college project using Python and machine learning to detect brain tumors from MRI scans\nPresented the project at the department final-year showcase'},
    {name:'Hostel Mess Menu Bot',tech:'Python, Flask, SQL',role:'',bullets:'Made a web app that shows the daily mess menu and lets students rate meals'}
  ],
  skills:'Python, SQL, Git, Flask, PostgreSQL, JavaScript, HTML, CSS, Linux',
  certs:'NPTEL: Programming, Data Structures and Algorithms using Python',
  achievements:'Second place, college hackathon, 2025',
  jd:'Junior Backend Developer\n\nWe are hiring a junior backend developer to build and maintain REST APIs for our merchant payments platform. You will write Python services with FastAPI, model data in PostgreSQL and cache with Redis. You should know SQL, Git and Docker, write unit tests, and be comfortable with code review and debugging. Exposure to AWS, CI/CD and microservices is a plus. Clear communication and problem solving matter to us.'
};
const EX_PRO = {
  template:'senior',
  contact:{name:'Arjun Mehta',email:'arjun.mehta@example.com',phone:'+91 90000 00001',location:'Mumbai, Maharashtra',linkedin:'linkedin.com/in/example',github:''},
  target:'Operations Manager',company:'',
  summary:'Operations analyst with six years in last-mile logistics. I am a hardworking team player who has run vendor onboarding and daily delivery reporting for two city networks.',
  education:[{inst:'Western Ghats College of Commerce, Pune',qual:'B.Com',field:'Accounting and Finance',start:'Jul 2016',end:'Apr 2019',grade:'',coursework:''}],
  experience:[
    {type:'Job',company:'Bluecart Logistics',role:'Senior Operations Analyst',location:'Mumbai',start:'Mar 2023',end:'Present',bullets:'Managed vendor onboarding for delivery partners across Mumbai and Thane\nManaged the daily delivery performance report sent to city leads\nManaged a team of four analysts covering two shifts\nreduced late deliveries by reworking the evening dispatch schedule'},
    {type:'Job',company:'Northway Freight',role:'Operations Analyst',location:'Pune',start:'June 2020',end:'Aug 2022',bullets:'Tracked SLA breaches for three warehouse clients and reported them weekly\nBuilt Excel dashboards for fleet utilisation used in monthly reviews'}
  ],
  projects:[],
  skills:'Excel, SQL, Vendor Management, Reporting, Power BI, Six Sigma, Forecasting',
  certs:'',
  achievements:'Operations Analyst of the Quarter, Bluecart Logistics, 2024',
  jd:'Operations Manager\n\nWe need an operations manager to run last-mile delivery for our Mumbai network. You will own vendor management and SLA performance, lead a team of analysts and shift leads, and drive process improvement across dispatch. You should be strong in Excel and SQL, comfortable with forecasting and budgeting, and used to stakeholder management with city and finance teams. Experience with Power BI reporting and team management is expected. Lean or Six Sigma exposure is a plus.'
};
const NEW = {
  education:{inst:'',qual:'',field:'',start:'',end:'',grade:'',coursework:''},
  experience:{type:'Job',company:'',role:'',location:'',start:'',end:'',bullets:''},
  projects:{name:'',tech:'',role:'',bullets:''}
};
const TYPES=['Job','Internship','Volunteering','Club or activity'];
const TEMPLATES = [
  {id:'starter',name:'Starter',note:'Students, first resume',order:['summary','education','projects','experience','activities','skills','achievements','certs']},
  {id:'tech',name:'Modern Tech',note:'Software, data, AI',order:['summary','skills','experience','projects','education','activities','achievements','certs']},
  {id:'corp',name:'Corporate',note:'Finance, consulting, ops',order:['summary','experience','education','skills','projects','achievements','activities','certs']},
  {id:'senior',name:'Senior',note:'Managers, experienced',order:['summary','achievements','experience','skills','education','projects','certs','activities']}
];
const MODES={fresher:'Fresher builder',tailor:'Tailored to a job',pro:'Professional builder'};
const TABS={
  fresher:[['details','Details'],['education','Education'],['projects','Projects'],['experience','Internships and activities'],['skills','Skills'],['jd','Target job']],
  pro:[['details','Details'],['experience','Experience'],['projects','Projects'],['education','Education'],['skills','Skills'],['jd','Target job']]
};
TABS.tailor=TABS.pro;
const LAYERS=[['consistency','Profile consistency'],['role','Role alignment'],['achievement','Achievement quality'],['evidence','Skills evidence'],['structure','ATS structure'],['jd','JD coverage'],['quality','Final quality']];

const clone=o=>JSON.parse(JSON.stringify(o));
const h=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const uid=()=>'v'+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36);
const lines=t=>String(t||'').split('\n').map(s=>s.replace(/^\s*[-•*]\s*/,'').trim()).filter(Boolean);
const list=t=>String(t||'').split(/[,\n]/).map(s=>s.trim()).filter(Boolean);
const dates=(a,b)=>[a,b].filter(Boolean).join(' – ');
const isWork=e=>!e.type||e.type==='Job'||e.type==='Internship';
function normalise(o){
  const d=clone(BLANK),s=x=>x==null?'':String(x);o=o||{};
  d.template=TEMPLATES.some(t=>t.id===o.template)?o.template:'starter';
  Object.keys(d.contact).forEach(k=>d.contact[k]=s(o.contact&&o.contact[k]));
  ['target','company','summary','skills','certs','achievements','jd'].forEach(k=>d[k]=Array.isArray(o[k])?o[k].join(k==='skills'?', ':'\n'):s(o[k]));
  ['education','experience','projects'].forEach(k=>d[k]=(Array.isArray(o[k])?o[k]:[]).map(e=>{const n=clone(NEW[k]);Object.keys(n).forEach(f=>{if(e&&e[f]!=null)n[f]=Array.isArray(e[f])?e[f].join('\n'):s(e[f]);});return n;}));
  d.experience.forEach(e=>{if(!TYPES.includes(e.type))e.type='Job';});
  return d;
}

/* ---------- job description terms ---------- */
const DICT=['python','java','javascript','typescript','golang','rust','c++','c#','sql','nosql','postgresql','mysql','mongodb','redis','kafka','rabbitmq','rest apis','rest api','restful','graphql','grpc','microservices','docker','kubernetes','aws','azure','gcp','linux','git','ci/cd','jenkins','github actions','terraform','react','next.js','node.js','fastapi','django','flask','spring boot','html','css','tailwind','unit tests','unit testing','testing','tdd','agile','scrum','data structures','algorithms','system design','machine learning','deep learning','tensorflow','pytorch','pandas','numpy','nlp','llm','api design','authentication','oauth','jwt','caching','monitoring','logging','debugging','code review','documentation','communication','problem solving','payments','upi','security','performance','scalability','distributed systems','object-oriented','excel','power bi','tableau','data analysis','statistics','sales','marketing','seo','figma','ui/ux','android','kotlin','swift','flutter','php','laravel','ruby','.net','stakeholder management','process improvement','vendor management','budgeting','forecasting','kpi','sla','project management','leadership','team management','logistics','supply chain','compliance','reporting','crm','sap','erp','negotiation','customer service','risk management','lean','six sigma','last-mile','dispatch','recruitment','training','audit','accounting','gst','tally'];
const reEsc=s=>s.replace(/[.*+?^${}()|[\]\\\/]/g,'\\$&');
const termRe=(terms,flags)=>new RegExp('(?<![A-Za-z0-9+#])('+terms.slice().sort((a,b)=>b.length-a.length).map(reEsc).join('|')+')(?![A-Za-z0-9+#])',flags);
const has=(text,term)=>termRe([term],'i').test(text);
function jdTerms(jd){
  if(!String(jd||'').trim())return [];
  const t=DICT.filter(x=>has(jd,x));
  return t.filter(x=>!t.some(u=>u!==x&&u.includes(x)&&!has(jd.replace(termRe([u],'gi'),' '),x)));
}
function resumeText(d){
  return [d.summary,d.skills,d.certs,d.achievements,...d.education.map(e=>[e.qual,e.field,e.inst,e.coursework].join(' ')),...d.experience.map(e=>[e.role,e.company,e.bullets].join(' ')),...d.projects.map(p=>[p.name,p.tech,p.role,p.bullets].join(' '))].join('\n');
}
function jdMatch(jd,text){
  const terms=jdTerms(jd);if(!terms.length)return null;
  const hit=terms.filter(t=>has(text,t)),miss=terms.filter(t=>!has(text,t));
  return {terms,hit,miss,pct:Math.round(100*hit.length/terms.length)};
}

/* ---------- dates ---------- */
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DATE_RE=/^((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}|\d{4}|Present)$/;
function normDate(s){
  const t=String(s||'').trim();let m;
  if(/^(present|current|now|ongoing|till date|to date)$/i.test(t))return 'Present';
  if((m=/^([A-Za-z]{3,9})\.?,?\s+(\d{4})$/.exec(t))){const i=MON.findIndex(x=>x.toLowerCase()===m[1].slice(0,3).toLowerCase());if(i>=0)return MON[i]+' '+m[2];}
  if((m=/^(\d{1,2})[\/\-.](\d{4})$/.exec(t))&&+m[1]>=1&&+m[1]<=12)return MON[+m[1]-1]+' '+m[2];
  if((m=/^(\d{4})[\/\-.](\d{1,2})$/.exec(t))&&+m[2]>=1&&+m[2]<=12)return MON[+m[2]-1]+' '+m[1];
  return t;
}
function parseD(s){
  const t=normDate(s);let m;
  if(t==='Present'){const n=new Date();return n.getFullYear()*12+n.getMonth();}
  if((m=/^([A-Z][a-z]{2}) (\d{4})$/.exec(t)))return +m[2]*12+MON.indexOf(m[1]);
  if((m=/^(\d{4})$/.exec(t)))return +m[1]*12;
  return null;
}

/* ---------- analysis of a structured resume ---------- */
const VERBS=new Set('built led ran wrote made won taught set drove grew cut sold kept began held met took gave sent'.split(' '));
const BUZZ=['hardworking','hard-working','team player','passionate','detail-oriented','go-getter','results-driven','dynamic','synergy','self-starter','think outside the box'];
const TARGET_STOP=new Set('junior senior lead associate assistant trainee intern staff principal and the for with'.split(' '));
function analyse(d,pg,mode){
  const rub=[],F=[],c=d.contact;
  const add=(label,max,got,why)=>rub.push({label,max,got:Math.round(got),why});
  const find=(id,layer,sev,tab,title,why,extra)=>F.push(Object.assign({id,layer,sev,tab,title,why},extra||{}));
  const cm=['name','email','phone'].filter(k=>!String(c[k]).trim());
  const emailOk=/^\S+@\S+\.\S+$/.test(c.email);
  add('Contact details',15,15*(3-cm.length)/3,cm.length?'Missing: '+cm.join(', ')+'.':emailOk?'Name, email and phone are present.':'The email does not look complete.');
  if(cm.length)find('contact','structure','fix','details','Add your '+cm.join(', '),'A recruiter cannot reach you without these, and parsers look for them at the top of the page.');
  else if(!emailOk)find('email','structure','fix','details','Check your email address','It does not look like a complete address.');
  const sl=d.summary.trim().length;
  add('Summary',10,sl===0?0:(sl<60||sl>500?5:10),sl===0?'No summary yet.':sl<60?'Very short.':sl>500?'Long. Aim for two or three sentences.':'A short summary is present.');
  if(sl===0)find('summary','structure','improve','details','Write a two or three sentence summary','It tells the reader what you do and what role you want before they read the detail.');
  else if(sl>500)find('summary','quality','improve','details','Shorten the summary','It is over 500 characters. Two or three sentences is enough.');
  const ed=d.education.filter(e=>e.inst.trim()&&e.qual.trim()),edD=ed.filter(e=>e.start||e.end);
  add('Education',15,ed.length?(edD.length===ed.length?15:9):0,ed.length?(edD.length===ed.length?'Institution, qualification and dates are present.':'Some entries have no dates.'):'No complete education entry.');
  if(!ed.length)find('edu','structure','fix','education','Add your education','Give at least one qualification with its institution.');
  else if(edD.length<ed.length)find('edudates','structure','improve','education','Add dates to every education entry','Parsers and recruiters expect a start and end for each qualification.');
  const allB=[...d.experience,...d.projects].flatMap(e=>lines(e.bullets));
  const ent=d.experience.filter(e=>e.company.trim()||e.role.trim()).length+d.projects.filter(p=>p.name.trim()).length;
  add('Experience and projects',20,ent===0?0:(allB.length>=3?20:allB.length?12:6),ent===0?'No entries yet.':allB.length>=3?ent+' entries with '+allB.length+' bullets.':'Fewer than three bullets across your entries.');
  if(ent===0)find('entries','structure','fix',mode==='fresher'?'projects':'experience',mode==='fresher'?'Add a project you built':'Add your work history',mode==='fresher'?'With no job history, projects, coursework and activities are what show your skills. Describe real work only.':'The page has no roles or projects yet.');
  else if(allB.length<3)find('bullets','achievement','improve',mode==='fresher'?'projects':'experience','Describe what you did in at least three bullets','One point per line, in plain words.');
  const weak=allB.filter(b=>{const w=b.split(/\s+/)[0]||'';return !(/^[A-Z]/.test(w)&&(/ed$/.test(w)||VERBS.has(w.toLowerCase())))||b.length<30||b.length>220;});
  const lower=allB.filter(b=>/^[a-z]/.test(b));
  add('Bullet wording',15,allB.length?15*(allB.length-weak.length)/allB.length:0,!allB.length?'No bullets to check.':weak.length?weak.length+' of '+allB.length+' bullets need a stronger opening or a better length.':'Every bullet starts with an action verb and is a readable length.');
  if(weak.length)find('weak','achievement','improve',d.experience.some(e=>lines(e.bullets).some(b=>weak.includes(b)))?'experience':'projects',weak.length+' bullet'+(weak.length>1?'s':'')+' could open more strongly','Each bullet should start with a capitalised past-tense verb and run 30 to 220 characters. First one: "'+weak[0].slice(0,70)+(weak[0].length>70?'…':'')+'"',lower.length?{apply:'capBullets',applyLabel:'Capitalise bullet openings'}:null);
  const sk=list(d.skills);
  add('Skills',10,Math.min(sk.length,5)*2,sk.length>=5?sk.length+' skills listed.':'Fewer than five skills listed.');
  if(sk.length<5)find('skills','evidence','improve','skills','List at least five skills','Only include skills you could answer interview questions about. You have '+sk.length+'.');
  const dated=[...d.education,...d.experience],ds=dated.flatMap(e=>[e.start,e.end]).map(x=>String(x||'').trim()).filter(Boolean);
  const badD=ds.filter(x=>!DATE_RE.test(x));
  add('Date format',10,ds.length?10*(ds.length-badD.length)/ds.length:0,!ds.length?'No dates entered yet.':badD.length?badD.length+' date'+(badD.length>1?'s do':' does')+' not use the Jan 2026 format.':'All dates use the same format.');
  if(badD.length)find('dates','structure','fix',d.experience.some(e=>badD.includes(String(e.start).trim())||badD.includes(String(e.end).trim()))?'experience':'education','Use one date format','Mixed formats make date parsing unreliable. Check: '+badD.slice(0,3).join(', ')+'.',badD.some(x=>DATE_RE.test(normDate(x)))?{apply:'fixDates',applyLabel:'Convert to Jan 2026 format'}:null);
  const allowed=(mode==='pro'||d.template==='senior')?2:1;
  add('Length',5,pg<=allowed?5:0,pg<=allowed?'Runs to '+pg+' page'+(pg>1?'s':'')+' in this template.':'Runs to '+pg+' pages. Aim for '+allowed+'.');
  if(pg>allowed)find('length','structure','improve','experience','Trim to '+allowed+' page'+(allowed>1?'s':''),'Cut older or less relevant bullets first.');

  /* profile consistency */
  const work=d.experience.map((e,i)=>({e,i,s:parseD(e.start),n:parseD(e.end)})).filter(x=>isWork(x.e));
  d.experience.forEach((e,i)=>{if((e.company.trim()||e.bullets.trim())&&!e.role.trim())find('norole'+i,'consistency','fix','experience','Entry '+(i+1)+' has no role or title','Give the title you actually held at '+(e.company||'this organisation')+'.');});
  work.forEach(x=>{if(x.s!=null&&x.n!=null&&x.n<x.s)find('order'+x.i,'consistency','fix','experience','End date is before the start date at '+(x.e.company||'entry '+(x.i+1)),x.e.start+' to '+x.e.end+'. Correct whichever is wrong.');});
  const jobs=work.filter(x=>x.e.type==='Job'&&x.s!=null&&x.n!=null).sort((a,b)=>a.s-b.s);
  for(let i=1;i<jobs.length;i++){
    const a=jobs[i-1],b=jobs[i];
    if(b.s-a.n>6)find('gap'+b.i,'consistency','optional','experience','Gap of '+(b.s-a.n)+' months before '+(b.e.company||'a role'),'Between '+a.e.end+' and '+b.e.start+'. Nothing to change if the dates are right, but expect to be asked about it.');
    else if(b.s<a.n)find('overlap'+b.i,'consistency','optional','experience',(a.e.company||'One role')+' and '+(b.e.company||'another')+' overlap','Fine if you held both at once. Otherwise correct the dates.');
  }
  /* role alignment */
  const tw=d.target.toLowerCase().split(/[^a-z]+/).filter(w=>w.length>3&&!TARGET_STOP.has(w));
  const roleText=(d.summary+' '+d.experience.map(e=>e.role).join(' ')+' '+d.projects.map(p=>p.name+' '+p.role).join(' ')).toLowerCase();
  if(!d.target.trim())find('target','role','optional','jd','Add the job title you are aiming for','It lets the checks compare your experience with a specific role.');
  else if(tw.length&&!tw.some(w=>roleText.includes(w)))find('align','role','improve','details','Your summary and titles do not mention "'+d.target+'"','If your experience is relevant, say how in the summary using your real background. Do not change a job title you held.');
  /* achievement quality */
  if(allB.length>=3&&!allB.some(b=>/\d/.test(b)))find('numbers','achievement','optional',mode==='fresher'?'projects':'experience','No bullet includes a number','If you measured a result, such as time saved, users or volume handled, add it. Do not estimate or invent one.');
  /* skills evidence */
  const evid=[...d.experience.map(e=>e.bullets+' '+e.role),...d.projects.map(p=>p.bullets+' '+p.tech+' '+p.name),...d.education.map(e=>e.coursework),d.certs,d.achievements].join('\n');
  const unsup=sk.filter(s=>!has(evid,s.toLowerCase()));
  if(sk.length&&unsup.length)find('evidence','evidence',mode==='fresher'?'optional':'improve','skills',unsup.length+' listed skill'+(unsup.length>1?'s are':' is')+' not shown anywhere else','No role, project, course or certificate mentions: '+unsup.join(', ')+'. Add a bullet showing where you used each one, or remove any you could not discuss.');
  /* JD coverage */
  const jd=jdMatch(d.jd,resumeText(d));
  if(!d.jd.trim()){if(mode==='tailor')find('nojd','jd','fix','jd','Paste the job description','A tailored copy needs the job description to compare against.');}
  else if(jd){
    if(jd.miss.length)find('jdmiss','jd','improve','skills',jd.miss.length+' job description term'+(jd.miss.length>1?'s':'')+' not in your resume','A missing term is not a missing skill. Add one only if you have used it.',{chips:jd.miss});
    const hitSk=sk.filter(s=>jd.terms.some(t=>has(s,t))),first=sk.slice(0,hitSk.length);
    if(hitSk.length&&hitSk.some(s=>!first.includes(s)))find('jdfirst','jd','optional','skills','Put the skills this job asks for first','Your matching skills are mixed in with the rest. Reordering changes no facts.',{apply:'jdFirst',applyLabel:'Move matching skills first'});
  }
  /* final quality */
  const prose=d.summary+'\n'+allB.join('\n');
  if(/\b(I|my|me|we|our)\b/.test(prose))find('pronoun','quality','improve',/\b(I|my|me|we|our)\b/.test(d.summary)?'details':'experience','Remove first-person words','Resumes drop "I", "my" and "we". Start with the verb instead.');
  const bz=BUZZ.filter(b=>prose.toLowerCase().includes(b));
  if(bz.length)find('buzz','quality','optional','details','Replace unsupported claims: '+bz.join(', '),'These phrases tell the reader nothing they can check. Show the trait with something you did.');
  const openers={};allB.forEach(b=>{const w=(b.split(/\s+/)[0]||'').toLowerCase();openers[w]=(openers[w]||0)+1;});
  const rep=Object.keys(openers).filter(w=>w&&openers[w]>=3);
  if(rep.length)find('repeat','quality','optional','experience',openers[rep[0]]+' bullets start with "'+rep[0].charAt(0).toUpperCase()+rep[0].slice(1)+'"','Vary the opening verb so each bullet reads as a different piece of work.');
  return {score:rub.reduce((a,r)=>a+r.got,0),rub,findings:F,jd};
}

/* ---------- analysis of raw resume text (standalone checker) ---------- */
function analyseText(text,jdText){
  const rub=[],F=[],t=String(text||''),ls=t.split('\n').map(x=>x.trim()).filter(Boolean);
  const add=(label,max,got,why)=>rub.push({label,max,got:Math.round(got),why});
  const find=(sev,title,why)=>F.push({sev,title,why});
  const words=t.split(/\s+/).filter(Boolean).length,letters=(t.match(/[A-Za-z]/g)||[]).length;
  const readable=t.length>0?letters/t.replace(/\s/g,'').length:0;
  add('Text extraction',20,words<30?0:readable<.6?10:20,words<30?'Almost no selectable text was found.':readable<.6?'A lot of the text is symbols or broken characters.':words+' words of selectable text.');
  if(words<30)find('fix','The file has little or no selectable text','If this came from a PDF, it may be a scan or an image export. A screening system would read nothing. Export it again as text.');
  else if(readable<.6)find('fix','Much of the text is symbols','Icons, unusual fonts or decorative characters can turn into noise when a parser extracts text.');
  const email=/[\w.+-]+@[\w-]+\.[\w.-]+/.test(t),phone=/(\+?\d[\d\s().-]{8,}\d)/.test(t);
  add('Contact details',15,(email?7.5:0)+(phone?7.5:0),(email?'Email found. ':'No email found. ')+(phone?'Phone found.':'No phone found.'));
  if(!email||!phone)find('fix','Add '+[!email&&'an email address',!phone&&'a phone number'].filter(Boolean).join(' and '),'Put contact details as plain text at the top, not in a header image.');
  const head=re=>ls.some(l=>l.length<40&&re.test(l));
  const hx=head(/experience|employment|work history|internship/i)||head(/projects?/i),he=head(/education|academic|qualification/i),hs=head(/skills|technologies|competenc/i);
  add('Section headings',20,(hx?8:0)+(he?6:0)+(hs?6:0),'Found: '+([hx&&'experience or projects',he&&'education',hs&&'skills'].filter(Boolean).join(', ')||'none of the standard headings')+'.');
  const mh=[!hx&&'Experience or Projects',!he&&'Education',!hs&&'Skills'].filter(Boolean);
  if(mh.length)find(mh.length>1?'fix':'improve','Use standard headings: '+mh.join(', '),'Parsers find sections by their labels. Unusual names such as "My journey" can be missed.');
  const dA=(t.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?,?\s+\d{4}\b/g)||[]).length,dB=(t.match(/\b\d{1,2}[\/.-]\d{4}\b/g)||[]).length,dC=(t.match(/\b(19|20)\d{2}\b/g)||[]).length-dA-dB;
  const dTot=dA+dB+Math.max(dC,0),dMax=Math.max(dA,dB,Math.max(dC,0));
  add('Dates',10,dTot===0?0:dMax/dTot>=.8?10:5,dTot===0?'No dates found.':dMax/dTot>=.8?'Dates use a consistent format.':'Dates mix formats: '+dA+' as month and year, '+dB+' numeric, '+Math.max(dC,0)+' year only.');
  if(dTot===0)find('fix','Add dates to your roles and education','Without dates, a reader cannot tell how recent or how long anything was.');
  else if(dMax/dTot<.8)find('improve','Use one date format throughout','Pick month and year, such as Jan 2026, and use it everywhere.');
  const bl=ls.filter(l=>/^[•·▪■◦●\-–*]\s*\S/.test(l)),bt=bl.map(l=>l.replace(/^[•·▪■◦●\-–*]\s*/,''));
  const strong=bt.filter(b=>{const w=b.split(/\s+/)[0]||'';return /^[A-Z]/.test(w)&&(/ed$/.test(w)||VERBS.has(w.toLowerCase()));});
  add('Bullets',15,bl.length===0?0:Math.min(bl.length,6)/6*8+(strong.length/bl.length)*7,bl.length===0?'No bullet points detected.':bl.length+' bullets, '+strong.length+' starting with an action verb.');
  if(bl.length===0)find('improve','Describe your work in bullet points','Short bullets are easier to scan than paragraphs. If your resume has bullets, they may be images or unusual symbols.');
  else if(strong.length/bl.length<.6)find('improve','Start more bullets with an action verb','Only '+strong.length+' of '+bl.length+' do. Example to rework: "'+(bt.find(b=>!strong.includes(b))||'').slice(0,70)+'"');
  add('Length',10,words<30?0:words<200?5:words>900?5:10,words<200?'Thin at '+words+' words.':words>900?'Long at '+words+' words.':words+' words is a reasonable length.');
  if(words>=30&&words<200)find('improve','Add more detail','At '+words+' words there is little for a reader to assess.');
  if(words>900)find('optional','Consider cutting length','At '+words+' words this probably runs past two pages.');
  const gappy=ls.filter(l=>/\S\s{4,}\S/.test(l)).length,sym=(t.match(/[^\x00-\x7F–—’‘“”•₹]/g)||[]).length;
  const risk=(ls.length&&gappy/ls.length>.25?1:0)+(sym>12?1:0);
  add('Layout risk signals',10,10-risk*5,risk===0?'No sign of columns, tables or icon fonts in the text.':[(gappy/ls.length>.25)&&'wide gaps inside lines suggest columns or a table',sym>12&&sym+' unusual symbols suggest icons'].filter(Boolean).join('; ')+'.');
  if(risk)find('improve','Possible multi-column layout or icons','This check only sees the extracted text, so it is a hint and not a certainty. A single-column layout with plain text is the safest choice.');
  const jd=jdMatch(jdText,t);
  if(jd&&jd.miss.length)find('improve',jd.miss.length+' job description terms do not appear in the resume','Missing: '+jd.miss.join(', ')+'. Add a term only where you have real experience to back it.');
  return {score:rub.reduce((a,r)=>a+r.got,0),rub,findings:F,jd,words};
}

/* ---------- preview ---------- */
function sheetHTML(d,mark){
  const c=d.contact,terms=mark?jdTerms(d.jd).filter(t=>has(resumeText(d),t)):[];
  const re=terms.length?termRe(terms,'gi'):null;
  const T=t=>{const e=h(t);return re?e.replace(re,'<mark>$1</mark>'):e;};
  const ul=t=>{const b=Array.isArray(t)?t:lines(t);return b.length?'<ul>'+b.map(x=>'<li>'+T(x)+'</li>').join('')+'</ul>':'';};
  const contact=[c.email,c.phone,c.location,c.linkedin,c.github].filter(x=>String(x).trim()).map(h).join('<span class="dot">·</span>');
  const exp=es=>es.map(e=>'<div class="entry"><div class="line"><span><b>'+h(e.company)+'</b></span><span>'+h(dates(e.start,e.end))+'</span></div><div class="line sub"><span>'+T(e.role)+'</span><span>'+h(e.location)+'</span></div>'+ul(e.bullets)+'</div>').join('');
  const wk=d.experience.filter(isWork),ac=d.experience.filter(e=>!isWork(e));
  const sec={
    summary:d.summary.trim()?'<section><h2>'+(d.template==='senior'?'Profile':'Summary')+'</h2><p>'+T(d.summary)+'</p></section>':'',
    education:d.education.length?'<section><h2>Education</h2>'+d.education.map(e=>'<div class="entry"><div class="line"><span><b>'+h(e.inst)+'</b></span><span>'+h(dates(e.start,e.end))+'</span></div><div class="line sub"><span>'+h([e.qual,e.field].filter(Boolean).join(', '))+'</span><span>'+h(e.grade)+'</span></div>'+(e.coursework.trim()?'<p class="cw">Relevant coursework: '+T(e.coursework)+'</p>':'')+'</div>').join('')+'</section>':'',
    experience:wk.length?'<section><h2>Experience</h2>'+exp(wk)+'</section>':'',
    activities:ac.length?'<section><h2>Activities and Leadership</h2>'+exp(ac)+'</section>':'',
    projects:d.projects.length?'<section><h2>Projects</h2>'+d.projects.map(p=>'<div class="entry"><div class="line"><span><b>'+h(p.name)+'</b>'+(p.role.trim()?', '+h(p.role):'')+'</span><span class="sub">'+T(p.tech)+'</span></div>'+ul(p.bullets)+'</div>').join('')+'</section>':'',
    skills:list(d.skills).length?'<section><h2>Skills</h2><p>'+T(list(d.skills).join(', '))+'</p></section>':'',
    achievements:lines(d.achievements).length?'<section><h2>'+(d.template==='senior'?'Key Achievements':'Achievements')+'</h2>'+ul(d.achievements)+'</section>':'',
    certs:list(d.certs).length?'<section><h2>Certifications</h2>'+ul(list(d.certs))+'</section>':''
  };
  const tpl=TEMPLATES.find(t=>t.id===d.template)||TEMPLATES[0];
  const body=tpl.order.map(k=>sec[k]).join('');
  const head=c.name.trim()?'<div class="name">'+h(c.name)+'</div>':'';
  if(!head&&!body)return '<p class="empty">Your resume appears here as you fill in the form.</p>';
  return head+(contact?'<div class="contact">'+contact+'</div>':'')+body;
}

/* ---------- LaTeX ---------- */
const TEX_MAP={'\\':'\\textbackslash{}','&':'\\&','%':'\\%','$':'\\$','#':'\\#','_':'\\_','{':'\\{','}':'\\}','~':'\\textasciitilde{}','^':'\\textasciicircum{}'};
const tx=s=>String(s==null?'':s).replace(/[\\&%$#_{}~^]/g,c=>TEX_MAP[c]).replace(/[–—]/g,'--').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/₹/g,'Rs.\\ ').trim();
function texDoc(d){
  const c=d.contact,L=[];
  const tpl=TEMPLATES.find(t=>t.id===d.template)||TEMPLATES[0];
  const font={starter:'\\usepackage{lmodern}',tech:'\\usepackage{helvet}\n\\renewcommand{\\familydefault}{\\sfdefault}',corp:'\\usepackage{mathptmx}',senior:'\\usepackage{palatino}'}[tpl.id];
  const secfmt=tpl.id==='starter'?'\\large\\bfseries\\scshape':'\\normalsize\\bfseries';
  const secpre=tpl.id==='starter'?'':'\\MakeUppercase';
  L.push('% AI Resume Studio. Template: '+tpl.name,
    '\\documentclass[10pt,a4paper]{article}','\\usepackage[T1]{fontenc}','\\usepackage[utf8]{inputenc}',font,
    '\\usepackage[margin=1.8cm]{geometry}','\\usepackage{enumitem}','\\usepackage{titlesec}','\\usepackage[hidelinks]{hyperref}',
    '\\pagestyle{empty}','\\setlength{\\parindent}{0pt}',
    '\\titleformat{\\section}{'+secfmt+'}{}{0pt}{'+secpre+'}'+(tpl.id==='senior'?'':'[\\titlerule]'),
    '\\titlespacing*{\\section}{0pt}{10pt}{5pt}',
    '\\setlist[itemize]{leftmargin=1.2em,itemsep=1pt,topsep=2pt,parsep=0pt}',
    '\\newcommand{\\entry}[4]{\\textbf{#1}\\hfill #2\\par\\textit{#3}\\hfill\\textit{#4}\\par}',
    '','\\begin{document}','');
  const items=b=>{b=Array.isArray(b)?b:lines(b);if(b.length){L.push('\\begin{itemize}');b.forEach(x=>L.push('  \\item '+tx(x)));L.push('\\end{itemize}');}};
  const contact=[c.email,c.phone,c.location,c.linkedin,c.github].filter(x=>String(x).trim()).map(tx).join(' \\textbar{} ');
  const env=(tpl.id==='tech'||tpl.id==='senior')?'flushleft':'center';
  if(c.name.trim()||contact){
    L.push('\\begin{'+env+'}');
    if(c.name.trim())L.push('  {\\LARGE\\bfseries '+tx(tpl.id==='corp'?c.name.toUpperCase():c.name)+'}\\\\[4pt]');
    if(contact)L.push('  '+contact);
    L.push('\\end{'+env+'}');
    if(tpl.id==='senior')L.push('\\vspace{-6pt}\\rule{\\linewidth}{0.8pt}');
    L.push('');
  }
  const exp=(title,es)=>{if(es.length){L.push('\\section{'+title+'}');es.forEach(e=>{L.push('\\entry{'+tx(e.company)+'}{'+tx(dates(e.start,e.end))+'}{'+tx(e.role)+'}{'+tx(e.location)+'}');items(e.bullets);L.push('\\vspace{4pt}');});L.push('');}};
  const sec={
    summary(){if(d.summary.trim())L.push('\\section{'+(tpl.id==='senior'?'Profile':'Summary')+'}',tx(d.summary),'');},
    education(){if(d.education.length){L.push('\\section{Education}');d.education.forEach(e=>{L.push('\\entry{'+tx(e.inst)+'}{'+tx(dates(e.start,e.end))+'}{'+tx([e.qual,e.field].filter(Boolean).join(', '))+'}{'+tx(e.grade)+'}');if(e.coursework.trim())L.push('Relevant coursework: '+tx(e.coursework)+'\\par');L.push('\\vspace{4pt}');});L.push('');}},
    experience(){exp('Experience',d.experience.filter(isWork));},
    activities(){exp('Activities and Leadership',d.experience.filter(e=>!isWork(e)));},
    projects(){if(d.projects.length){L.push('\\section{Projects}');d.projects.forEach(p=>{L.push('\\textbf{'+tx(p.name)+'}'+(p.role.trim()?', '+tx(p.role):'')+'\\hfill\\textit{'+tx(p.tech)+'}\\par');items(p.bullets);L.push('\\vspace{4pt}');});L.push('');}},
    skills(){const k=list(d.skills);if(k.length)L.push('\\section{Skills}',k.map(tx).join(', '),'');},
    achievements(){const k=lines(d.achievements);if(k.length){L.push('\\section{'+(tpl.id==='senior'?'Key Achievements':'Achievements')+'}');items(k);L.push('');}},
    certs(){const k=list(d.certs);if(k.length){L.push('\\section{Certifications}');items(k);L.push('');}}
  };
  tpl.order.forEach(k=>sec[k]());
  L.push('\\end{document}');
  return L.join('\n');
}
function exportHTML(d){
  return '<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+h(d.contact.name||'Resume')+'</title>\n'+
  '<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Sans:ital,wght@0,400;0,600;1,400&family=STIX+Two+Text:ital,wght@0,400;0,600;1,400&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap" rel="stylesheet">\n'+
  '<style>'+PAPER_CSS+'\n@page{size:A4;margin:16mm 18mm}\nbody{margin:0;background:#fff}\n.sheet{font-size:10pt;padding:0}\n@media screen{body{background:#e8ebf0}.sheet{max-width:210mm;margin:24px auto;padding:16mm 18mm}}\n</style></head>\n<body><!-- Open this file in a browser and print to PDF. --><div class="sheet tpl-'+d.template+'">'+sheetHTML(d,false)+'</div></body></html>';
}

/* ---------- tailoring: reorder only, never reword ---------- */
function tailorData(d){
  const terms=jdTerms(d.jd);if(!terms.length)return;
  const hits=t=>terms.filter(x=>has(String(t),x)).length;
  const sortBy=(arr,f)=>arr.map((x,i)=>({x,i,s:f(x)})).sort((a,b)=>b.s-a.s||a.i-b.i).map(o=>o.x);
  d.skills=sortBy(list(d.skills),hits).join(', ');
  d.projects=sortBy(d.projects,p=>hits(p.name+' '+p.tech+' '+p.bullets));
  [...d.experience,...d.projects].forEach(e=>{e.bullets=sortBy(lines(e.bullets),hits).join('\n');});
}

export {
  PAPER_CSS, BLANK, EX_FRESHER, EX_PRO, NEW, TYPES, TEMPLATES, MODES, TABS, LAYERS,
  clone, h, uid, lines, list, dates, isWork, normalise,
  DICT, has, jdTerms, resumeText, jdMatch, normDate, parseD,
  analyse, analyseText, sheetHTML, tx, texDoc, exportHTML, tailorData
};
