# Bug: WT codes not renumbered after leftmost merge

## Symptom
After bulk elimination merges the leftmost WT in a sibling group into its right neighbor, the remaining WTs keep their original digit instead of being renumbered sequentially. Example: group has 341011, 341012, 341013. After merging 341011+341012 → 341011, the third WT stays 341013 instead of becoming 341012.

## Root Cause
`_leaf_codes_direct()` in `decision_tree.py` assigns digits based on the position of each row's low threshold in the sorted unique thresholds list. After a leftmost merge, the expanded row takes the lowest threshold (-inf), but the remaining row's threshold (e.g., 1000) still maps to its original position (3) in the unique list — not to the sequential rank (2) within the surviving siblings.

## Correct Behavior
After any merge, WT code digits at each predictor level must be assigned as sequential 1-based ranks within each sibling group. If a group has N surviving rows, their digits should be 1, 2, ..., N — regardless of their absolute threshold values.

## Fix
In `_leaf_codes_direct()`, for each predictor level, group rows by their parent conditions (all predictor levels above), then assign digits as sequential ranks (1, 2, ...) within each group. Unbounded rows (-inf/inf) still get digit 0.

## Test Cases
1. Create 3 WTs at a level, eliminate the leftmost → remaining 2 should have digits 1, 2 (not 1, 3).
2. Create 4 WTs, eliminate two from different positions → survivors renumbered 1, 2.
3. Merge rightmost WT → remaining WTs keep sequential digits.
4. Mixed: some groups fully merged (digit 0), others partially → all digits correct.

## Files Involved
- `core/postprocessors/decision_tree.py` — `_leaf_codes_direct()` method
