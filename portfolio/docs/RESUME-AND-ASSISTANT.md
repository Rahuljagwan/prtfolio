# Resume files and the AI assistant

## Where to put your resume

Two ways, and they work together. If both exist for a file type, the admin upload wins.

1. **Simplest (no admin needed):** copy your files into `portfolio/public/resume/` with these exact names:
   - `public/resume/resume.pdf`
   - `public/resume/resume.docx`
   Then redeploy. The site shows the Resume section, the hero Resume menu and the palette commands automatically.
   Only the files that exist are offered; with neither file, the section is hidden.
2. **No redeploy needed:** upload from `/admin` > Resume tab (stored in the database, 3 MB limit each).

To swap a file: replace it in `public/resume/` and redeploy, or upload a new one in the admin.

## The AI assistant

Default: a free, local, grounded engine. No key, no cost, nothing sent to a third party, answers only from your content.

Optional LLM mode (natural-language answers): set `ASSISTANT_LLM_API_KEY` (an Anthropic API key) in Vercel
Environment Variables and redeploy. Nothing else changes. Details:

- The model receives only the passages retrieved from your portfolio, plus a strict "use only this context" instruction.
- Refusals, greetings and "I couldn't find that" replies never call the model.
- Any failure (timeout, HTTP error, empty reply, daily cap) falls back to the local answer.
- `ASSISTANT_LLM_DAILY_CAP` (default 200) is a soft cap on model calls per server instance per day. A per-visitor limit
  of 20 questions per minute also applies.
- Cost: with a small model, one answer is roughly 1,500 input and 150 output tokens, which is a fraction of a cent.
  Check current pricing on your provider's page. Set a spending limit in the provider dashboard as well.
- Privacy: in this mode the visitor's question and the retrieved passages are sent to the model provider. The page
  footnote changes to say so automatically.
- Status: the LLM call is covered by mocked tests only (`npm run test:assistant`). It has not been run against the
  live API, so test it with your key before relying on it.
