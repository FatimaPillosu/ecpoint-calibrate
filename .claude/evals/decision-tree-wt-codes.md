# Decision-tree WT-code generation — known issues & regression tests

Subtle, already-fixed behaviours in `core/postprocessors/decision_tree.py` (WT-code
generation and observation evaluation). Read this for the *why*; each invariant is
locked by a regression test in `tests/unit/test_decision_tree.py` (the *what*). Keep
these invariants when changing `_leaf_codes_direct()`, `evaluate()` or `evaluate_all()`.

## 1. Skip-level digit assignment (WT-CODE-SKIP-LEVEL-001)
- **Invariant:** a row that is fully unbounded at a predictor (literal `-inf/inf`, or
  the predictor's full configured range) gets digit `0` there — even when it shares
  its low value (`-inf`) with a bounded sibling.
- **Root cause (fixed):** a global unique-lows lookup conflated bounded and unbounded
  rows that shared the same low value. `_leaf_codes_direct()` now classifies each row
  by its own `(low, high)` pair.
- **Test:** `test_leaf_codes_skip_level_assigns_zero_digit`

## 2. Sequential renumbering after a leftmost merge (WT-CODE-RENUMBER-001)
- **Invariant:** after merging WTs in a sibling group, survivors' digits are sequential
  ranks (1, 2, …, N) *within each sibling group*, not their position in a global
  threshold list. Merging the leftmost WT must renumber the rest (…12, not …13).
- **Root cause (fixed):** digits were ranked against a global unique-lows list.
  `_leaf_codes_direct()` now groups rows by their parent conditions and ranks within
  each group.
- **Test:** `test_leaf_codes_renumbered_within_sibling_group_after_leftmost_merge`

## 3. Exported histograms must match in-app (WT-EXPORT-MISMATCH)
- **Invariant:** counting observations for a WT checks each predictor condition
  independently (`thrL <= value < thrH`), so a merged/pruned WT counts correctly.
  Exported PNG histograms must equal the in-app ones.
- **Root cause (fixed):** the export path used `evaluate_all()`, which assumed the
  breakpoint matrix was a full Cartesian product; after pruning/merging it mis-binned
  or dropped observations. Both paths now use the same direct per-WT checking
  (`WeatherType.evaluate()`).
- **Test:** `test_weathertype_evaluate_counts_merged_wt_independently`
