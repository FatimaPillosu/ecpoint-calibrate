# Bug: Exported WT histograms (PNG) don't match in-app histograms

## Symptom
When exporting Weather Types as PNG via Menu > Export > Weather Types (PNG), the exported histograms show drastically fewer data points than the same WT displayed in-app (e.g., 16 vs 5,700). The WT titles/thresholds match — only the data differs.

## Root Cause
Two separate code paths evaluate observations against WT thresholds:

1. **In-app histogram** (`/postprocessing/generate-wt-histogram`): Uses direct per-WT threshold checking — iterates each predictor condition independently. Works correctly with asymmetric/pruned trees.

2. **Export PNG** (`/postprocessing/save` mode="wt"): Uses `WeatherType.evaluate()` / `evaluate_all()` which assumes the breakpoint matrix forms a **Cartesian product** (every predictor combination exists as a row). After merging or pruning, the matrix no longer has this structure, so `evaluate_all` assigns observations to wrong bins or drops them entirely.

## Why Cartesian product assumption breaks
A symmetric tree with 3 predictors × 2 splits each = 8 WTs, all combinations present. After pruning (e.g., merging two WTs), some rows cover wider ranges. The `evaluate_all` method uses `np.digitize` on sorted unique thresholds per predictor, then combines bin indices — this only works when every combination of bins exists as a row. Missing combinations cause mismatches.

## Correct Behavior
Both in-app and exported histograms must produce identical results for the same WT thresholds. The evaluation must check each WT's threshold conditions independently, not assume matrix structure.

## Fix
Replace `evaluate_all()` in the save/export code path with the same direct threshold checking used by `generate-wt-histogram`. Specifically, for each WT row, filter observations where ALL predictor conditions (thrL <= value < thrH) are satisfied simultaneously.

## Test Cases
1. Create a symmetric tree, prune it asymmetrically, export WTs as PNG — counts must match in-app.
2. Create a tree, use bulk elimination, export — counts must match.
3. Create a tree where a predictor level is skipped (-inf/inf) at some leaves — export must still count correctly.

## Files Involved
- `core/api.py` — `/postprocessing/save` endpoint (mode="wt" branch)
- `core/postprocessors/conditional_verification.py` — `WeatherType.evaluate()`, `evaluate_all()`
- `core/postprocessors/decision_tree.py` — tree building and WT code generation
