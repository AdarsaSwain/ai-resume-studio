import test from 'node:test';
import assert from 'node:assert/strict';
import { EX_FRESHER, EX_PRO, BLANK, clone, normalise, lines, list, jdTerms, jdMatch, resumeText, normDate, analyse, analyseText, sheetHTML, texDoc, tx, tailorData } from '../src/engine.js';
import { buildPrompt } from '../src/prompts.js';

test('normDate converts common formats to Jan 2026 style', () => {
  assert.equal(normDate('June 2020'), 'Jun 2020');
  assert.equal(normDate('03/2023'), 'Mar 2023');
  assert.equal(normDate('2023-11'), 'Nov 2023');
  assert.equal(normDate('now'), 'Present');
  assert.equal(normDate('sometime'), 'sometime');
});

test('jdTerms finds whole terms and drops ones only present inside a longer term', () => {
  const t = jdTerms('We use REST APIs, PostgreSQL and Java. Team management matters.');
  assert.ok(t.includes('rest apis') && t.includes('postgresql') && t.includes('java') && t.includes('team management'));
  assert.ok(!t.includes('javascript') && !t.includes('sql') && !t.includes('rest api'));
  assert.deepEqual(jdTerms(''), []);
});

test('examples score sensibly and a blank resume scores almost nothing', () => {
  for (const [ex, mode] of [[EX_FRESHER, 'fresher'], [EX_PRO, 'pro']]) {
    const a = analyse(normalise(ex), 1, mode);
    assert.ok(a.score > 60 && a.score <= 100, 'score ' + a.score);
    assert.equal(a.rub.reduce((s, r) => s + r.max, 0), 100);
    assert.ok(a.jd.pct >= 0 && a.jd.pct <= 100);
    assert.ok(a.findings.every(f => f.id && f.title && f.why && ['fix', 'improve', 'optional'].includes(f.sev)));
  }
  // A blank page earns only the five length points for fitting on one page.
  assert.equal(analyse(clone(BLANK), 1, 'pro').score, 5);
});

test('the pro example flags its mixed date format and offers the one-click fix', () => {
  const f = analyse(normalise(EX_PRO), 1, 'pro').findings.find(x => x.id === 'dates');
  assert.equal(f.apply, 'fixDates');
});

test('tailoring reorders but never changes wording', () => {
  const d = normalise(EX_FRESHER), before = normalise(EX_FRESHER);
  tailorData(d);
  assert.deepEqual(list(d.skills).sort(), list(before.skills).sort());
  assert.deepEqual(d.projects.flatMap(p => lines(p.bullets)).sort(), before.projects.flatMap(p => lines(p.bullets)).sort());
  assert.deepEqual(d.experience.map(e => lines(e.bullets).sort()), before.experience.map(e => lines(e.bullets).sort()));
  const terms = jdTerms(d.jd), first = list(d.skills)[0].toLowerCase();
  assert.ok(terms.some(t => first.includes(t)), 'a matching skill comes first');
  assert.equal(jdMatch(d.jd, resumeText(d)).pct, jdMatch(before.jd, resumeText(before)).pct);
});

test('LaTeX output escapes user text and is a complete document', () => {
  assert.equal(tx('50% of R&D_budget #1 {x} $5'), '50\\% of R\\&D\\_budget \\#1 \\{x\\} \\$5');
  const d = normalise(EX_PRO); d.summary = 'Cut costs 10% & saved $5k';
  const tex = texDoc(d);
  assert.ok(tex.includes('\\begin{document}') && tex.trimEnd().endsWith('\\end{document}'));
  assert.ok(tex.includes('Cut costs 10\\% \\& saved \\$5k'));
});

test('preview HTML escapes user text', () => {
  const d = normalise(EX_FRESHER); d.contact.name = '<script>x</script>';
  const html = sheetHTML(d, true);
  assert.ok(!html.includes('<script>') && html.includes('&lt;script&gt;'));
  assert.ok(html.includes('<mark>'));
});

test('text checker scores a weak resume low and reports why', () => {
  const r = analyseText('ROHAN S.\nrohan.s@example.com\n\nMy Journey\nWorked at a shop.\n\nThings I know\nExcel', '');
  assert.ok(r.score < 50);
  assert.ok(r.findings.some(f => f.sev === 'fix'));
});

test('prompts are built from structured input and reject bad payloads', () => {
  assert.ok(buildPrompt('bullets', { bullets: ['built an api'], jd: 'Python and Docker' }).includes('built an api'));
  assert.ok(buildPrompt('summary', { resume: EX_PRO }).includes('Bluecart Logistics'));
  assert.throws(() => buildPrompt('bullets', { bullets: [] }), { code: 'bad_payload' });
  assert.throws(() => buildPrompt('extract', { text: 'x'.repeat(70000) }), { code: 'too_long' });
  assert.throws(() => buildPrompt('anything', {}), { code: 'bad_kind' });
});
