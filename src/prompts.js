/* Prompts for every Claude feature. Built on the server from structured input,
   so the browser can never send free-form instructions to the model. */
import { lines, list, dates, jdTerms, normalise } from './engine.js';

export const KINDS = ['extract', 'summary', 'bullets', 'idea'];
export const MAX_RESUME_CHARS = 60000;

const SHAPE = '{"contact":{"name":"","email":"","phone":"","location":"","linkedin":"","github":""},"summary":"","education":[{"inst":"","qual":"","field":"","start":"","end":"","grade":"","coursework":""}],"experience":[{"type":"Job","company":"","role":"","location":"","start":"","end":"","bullets":""}],"projects":[{"name":"","tech":"","role":"","bullets":""}],"skills":"","certs":"","achievements":""}';

const str = x => (typeof x === 'string' ? x : '');
const bad = code => Object.assign(new Error(code), { code });

export function buildPrompt(kind, p) {
  p = p && typeof p === 'object' ? p : {};
  if (kind === 'extract') {
    const text = str(p.text).trim();
    if (!text) throw bad('bad_payload');
    if (text.length > MAX_RESUME_CHARS) throw bad('too_long');
    return 'Convert the resume text below into JSON with exactly this shape:\n' + SHAPE +
      '\nRules: copy facts exactly as written; do not add, infer, reword or improve anything; leave a field as an empty string when the resume does not state it; write dates as "Jan 2026" when a month is given, otherwise the year, and "Present" for a current role; "bullets" is one string with one point per line and no bullet characters; "skills" is one comma-separated string; "certs" and "achievements" are one string with one item per line; experience "type" is one of Job, Internship, Volunteering, Club or activity. Reply with the JSON only.\n\nRESUME TEXT:\n' + text;
  }
  if (kind === 'idea') {
    return 'A student wants one portfolio project to actually build before applying for this role: "' + (str(p.target).slice(0, 200) || 'an entry-level role') +
      '". Skills they already have: ' + (str(p.skills).slice(0, 2000) || 'not stated') +
      '. Suggest one project they could finish in two to three weekends. Reply in plain text, under 90 words: a name, what it does, and the three things they would build. Do not write resume bullets for it, because they have not built it yet.';
  }
  if (kind === 'summary') {
    const d = normalise(p.resume);
    const facts = {
      target_role: d.target,
      education: d.education.map(e => [e.qual, e.field, e.inst, dates(e.start, e.end)].filter(Boolean).join(', ')),
      experience: d.experience.map(e => ({ type: e.type, role: e.role, organisation: e.company, dates: dates(e.start, e.end), did: lines(e.bullets) })),
      projects: d.projects.map(x => ({ name: x.name, tech: x.tech, did: lines(x.bullets) })),
      skills: list(d.skills)
    };
    const json = JSON.stringify(facts);
    if (json.length > MAX_RESUME_CHARS) throw bad('too_long');
    return 'Write a resume summary of two or three sentences, under 60 words, in plain professional English without first-person pronouns. Use only the facts in the JSON below. Do not add any employer, job title, date, qualification, skill, number, metric or achievement that is not in it. Never describe a project, course or club as employment. No superlatives or buzzwords. Reply with the summary text only.\n\n' + json;
  }
  if (kind === 'bullets') {
    const bullets = (Array.isArray(p.bullets) ? p.bullets : []).map(str).map(s => s.trim()).filter(Boolean);
    if (!bullets.length) throw bad('bad_payload');
    if (bullets.join('\n').length > 8000) throw bad('too_long');
    const target = str(p.target).slice(0, 200), terms = jdTerms(str(p.jd));
    return 'Rewrite these resume bullets so they are clear and specific. Rules: keep every fact exactly as given; do not add numbers, percentages, metrics, tools, technologies, team sizes, dates or outcomes that are not in the input; start each bullet with a capitalised past-tense action verb; vary the verbs; keep each under 25 words; return the same number of bullets in the same order, one per line, with no bullet characters and no commentary.' +
      (target ? '\nTarget role, for emphasis only: ' + target : '') +
      (terms.length ? '\nJob description terms. Use one only where a bullet already states that fact: ' + terms.join(', ') : '') +
      '\n\nBullets:\n' + bullets.join('\n');
  }
  throw bad('bad_kind');
}
