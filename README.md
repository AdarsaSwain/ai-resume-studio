# AI Resume Studio

Build, check and tailor resumes. Every route scores the page as you write, keeps to facts you entered, and exports LaTeX source and a print-ready page.

## Run it

```
npm install
copy .env.example .env     # optional: add ANTHROPIC_API_KEY to turn on the Claude features
npm run dev                # http://localhost:5173
```

Production: `npm run build`, then `npm start` and open http://127.0.0.1:8787.

Tests: `npm test`.

## What is where

| Path | What it holds |
|---|---|
| `src/engine.js` | Data shapes, scoring rubric, job description matching, preview HTML, LaTeX and tailoring. Pure functions, no DOM. |
| `src/app.js` | The interface: home, editor, tailor and checker views, saved in `localStorage`. |
| `src/prompts.js` | Every prompt sent to Claude, built from structured input. |
| `server/index.js` | Express server: `/api/health`, `/api/ai`, and the built front end. |
| `test/` | Engine and prompt tests. |

## Claude features

Without a key the builder, scoring, tailoring, checker and exports all work in the browser. With `ANTHROPIC_API_KEY` set, three things turn on: rewording bullets, drafting a summary, and reading a pasted or uploaded resume into the form. Those requests send the relevant resume text to the server and on to the Anthropic API; nothing else leaves the browser.

The model defaults to `claude-opus-5-5`; set `CLAUDE_MODEL` to change it.
