# Claude Code Project Instructions

## Project
ecPoint-Calibrate v1.0.1 — A web-based GUI for conditional verification and calibration of NWP model outputs.

## Architecture
- **Backend**: Flask REST API (Python, port 8888) in `core/`
- **Frontend**: React/Redux with Semantic UI (port 3000) in `ui/`
- **Web server**: Express.js proxy in `web-server.js`
- **Build**: `NODE_OPTIONS=--openssl-legacy-provider npx webpack --mode development`

## Key Files
- `core/api.py` — Flask endpoints
- `core/postprocessors/decision_tree.py` — Decision tree logic and WT code generation
- `ui/workflows/C/2/tree/component.js` — Decision tree visualization
- `ui/workflows/C/2/breakpoints/` — Breakpoints table and merge logic
- `ui/workflows/C/2/postprocessing/component.js` — Post-processing page layout

## Evaluation Files
**IMPORTANT**: Before modifying any code in `core/postprocessors/decision_tree.py` or any WT code generation logic, read ALL evaluation files in `.claude/evals/`. These document known bugs, their root causes, correct behavior, and test cases. Always verify your changes against these test cases.

### Eval directory: `.claude/evals/`
- `wt-code-generation.md` — WT code digit assignment when predictor levels are skipped
- `wt-export-evaluation-mismatch.md` — Exported WT histograms don't match in-app (dual code path bug)
- `wt-code-renumbering-after-leftmost-merge.md` — WT codes not renumbered after leftmost merge

## Brand Guidelines
- **Headings**: Poppins (500-700 weight)
- **Body text**: Work Sans Light (300 weight)
- **Accent color**: #0d9488 (teal)
- **Body text color**: #333333
- **Font sizes**: Headings 15px+, body 13-16px

## Environment
- API keys stored in `.env` (never commit)
- Windows development machine
- Python 3.14, Node.js
