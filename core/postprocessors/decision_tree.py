import math
from base64 import b64encode
from io import BytesIO
from typing import Generator, List, Tuple

import attr
import matplotlib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from colour import Color

from core.loaders import BasePointDataReader, ErrorType
from core.utils import int_or_float

from .conditional_verification import plot_avg, plot_obs_freq, plot_std
from .generics import Node


@attr.s(slots=True)
class DecisionTree(object):
    threshold_low = attr.ib()
    threshold_high = attr.ib()
    ranges = attr.ib()

    @property
    def predictors(self) -> List[str]:
        return [
            predictor.replace("_thrL", "") for predictor in self.threshold_low.keys()
        ]

    @property
    def num_predictors(self) -> int:
        return len(self.predictors)

    @property
    def num_wt(self) -> int:
        return len(self.threshold_low)

    @property
    def leaf_codes(self) -> List[str]:
        def g(node: Node) -> Generator[str, None, None]:
            if not node.children:
                yield node.meta["code"]

            for child in node.children:
                yield from g(node=child)

        return list(g(node=self.tree))

    @property
    def leaf_colors(self) -> List[str]:
        colors = [
            Color("#f278f6"),
            Color("#d10330"),
            Color("#ea9826"),
            Color("#d0c912"),
            Color("#88c927"),
            Color("#359761"),
            Color("#2ad0ba"),
            Color("#4b8bab"),
            Color("#9797f4"),
            Color("#4d4ffa"),
        ]

        if self.num_predictors > 10:
            colors += Color("#af0fff").range_to(
                Color("#cb94ff"), self.num_predictors - 10
            )

        colors += [Color("black")]
        return [color.hex for color in colors]

    @classmethod
    def _get_threshold_counts(cls, sparse_thresholds):
        num_predictors = len(sparse_thresholds.keys())

        thresholds_num = np.zeros(num_predictors, dtype=int)
        thresholds_num_acc = np.zeros(num_predictors, dtype=int)
        acc = 1

        for i in range(num_predictors):
            temp = sparse_thresholds.iloc[:, i].dropna()
            temp = temp[temp != ""]
            thresholds_num[i] = len(temp)
            acc = acc * len(temp)
            thresholds_num_acc[i] = acc

        return thresholds_num, thresholds_num_acc, num_predictors

    @classmethod
    def create_from_sparse_thresholds(cls, low, high, ranges) -> "DecisionTree":
        thresholds_num, thresholds_num_acc, num_predictors = cls._get_threshold_counts(
            low
        )
        num_wt = thresholds_num_acc[-1]

        thrL_matrix = np.zeros((num_wt, num_predictors))
        thrH_matrix = np.zeros((num_wt, num_predictors))

        # Vectorized Cartesian product using np.tile / np.repeat.
        # For predictor i with k_i bins:
        #   each value repeats  product(k_{i+1} ... k_{p-1}) times
        #   the pattern tiles   product(k_0 ... k_{i-1}) times
        for i in range(num_predictors):
            valsL = low.iloc[:, i].dropna()
            valsL = valsL[valsL != ""].to_numpy(dtype=float)
            valsH = high.iloc[:, i].dropna()
            valsH = valsH[valsH != ""].to_numpy(dtype=float)

            right = int(np.prod(thresholds_num[i + 1:])) if i < num_predictors - 1 else 1
            left = int(thresholds_num_acc[i - 1]) if i > 0 else 1

            thrL_matrix[:, i] = np.tile(np.repeat(valsL, right), left)
            thrH_matrix[:, i] = np.tile(np.repeat(valsH, right), left)

        return cls(
            threshold_low=pd.DataFrame(data=thrL_matrix, columns=low.columns),
            threshold_high=pd.DataFrame(data=thrH_matrix, columns=high.columns),
            ranges=ranges,
        )

    @property
    def tree(self) -> Node:
        root = Node("Root")
        root.meta["level"] = -1

        # Dict-based child lookup for O(1) matching instead of O(children)
        children_map = {}  # id(node) -> {name: child_node}

        for i in range(self.num_wt):
            thrL = self.threshold_low.iloc[i, :]
            thrH = self.threshold_high.iloc[i, :]

            curr = root
            for level, (low, predictor, high) in enumerate(
                zip(thrL, self.predictors, thrH)
            ):
                text = "{low} < {predictor} < {high}".format(
                    low=int_or_float(low), predictor=predictor, high=int_or_float(high)
                )
                parent = curr
                parent_id = id(parent)

                if parent_id not in children_map:
                    children_map[parent_id] = {}

                matched_node = children_map[parent_id].get(text)
                if matched_node:
                    curr = matched_node
                    continue
                else:
                    maybe_child = Node(text, range=self.ranges[predictor])
                    maybe_child.meta["predictor"] = predictor
                    maybe_child.meta["level"] = level
                    curr.meta["idxWT"] = i

                    # For a path in the decision tree that has been resolved, we want
                    # to add only those nodes to the tree that have a decision, i.e.
                    # a bounded range.
                    if not maybe_child.is_unbounded:
                        curr = maybe_child
                        parent.add_child(curr)
                        children_map[parent_id][text] = curr

            if not curr.children:
                curr.meta["idxWT"] = i
                curr.nodeSvgShape = {
                    "shapeProps": {"stroke": self.leaf_colors[curr.meta["level"]]}
                }

        def codegen(node: Node, code: str):
            node.meta["code"] = code
            for idx, child in enumerate(node.children):
                lvl = child.meta["level"]
                codegen(node=child, code=code[:lvl] + str(idx + 1) + code[lvl + 1 :])
            return node

        return codegen(node=root, code="0" * self.num_predictors)

    def tree_lazy(self, max_depth: int = 3, start_pred_idx: int = 0,
                  parent_code: str = None) -> Node:
        """
        Build a depth-limited tree directly from the Cartesian product
        structure — O(visible_nodes) instead of O(num_wt).

        Nodes at the boundary get '_collapsed', '_childCount', '_wtFrom',
        and '_wtTo' in meta so the frontend can request expansion on demand.

        Parameters:
            start_pred_idx: skip predictors before this index (used by
                expand_node to avoid re-including already-resolved levels).
            parent_code: WT code of the parent node (used by expand_node
                so expanded children carry forward the correct code prefix).
        """
        import re as _re

        predictors = self.predictors
        p = len(predictors)

        if parent_code is None:
            parent_code = "0" * p

        # For each predictor, extract the unique (low, high) bins and check
        # which ones are bounded (visible in the tree).
        predictor_bins = []  # list of [(low, high, text, is_bounded), ...]
        for i in range(p):
            pred = predictors[i]
            pred_range = self.ranges.get(pred)
            low_vals = self.threshold_low.iloc[:, i].to_numpy()
            high_vals = self.threshold_high.iloc[:, i].to_numpy()
            unique_lows = np.sort(np.unique(low_vals))

            bins = []
            for ul in unique_lows:
                uh = high_vals[low_vals == ul][0]
                text = "{low} < {pred} < {high}".format(
                    low=int_or_float(ul), pred=pred, high=int_or_float(uh)
                )
                is_bounded = True
                if pred_range:
                    pattern = _re.compile(
                        rf"{_re.escape(str(pred_range[0]))} < .* < "
                        rf"{_re.escape(str(pred_range[1]))}"
                    )
                    is_bounded = not bool(pattern.match(text))
                bins.append((ul, uh, text, is_bounded))
            predictor_bins.append(bins)

        # How many WTs does each bin at predictor i span?
        wts_per_bin = [1] * p
        for i in range(p - 2, -1, -1):
            wts_per_bin[i] = wts_per_bin[i + 1] * len(predictor_bins[i + 1])

        root = Node("Root")
        root.meta["level"] = -1
        root.meta["code"] = parent_code

        def _build(parent, pred_idx, depth, wt_offset, code):
            if pred_idx >= p:
                # Leaf node
                parent.meta["idxWT"] = wt_offset
                parent.nodeSvgShape = {
                    "shapeProps": {
                        "stroke": self.leaf_colors[parent.meta.get("level", 0)]
                    }
                }
                return

            bins = predictor_bins[pred_idx]
            has_bounded = any(b[3] for b in bins)

            if not has_bounded:
                # All bins at this level are unbounded — skip to next predictor
                _build(parent, pred_idx + 1, depth, wt_offset, code)
                return

            bounded_idx = 0
            for bin_i, (low, high, text, is_bounded) in enumerate(bins):
                child_wt_offset = wt_offset + bin_i * wts_per_bin[pred_idx]
                child_wt_count = wts_per_bin[pred_idx]

                if not is_bounded:
                    continue

                bounded_idx += 1
                child = Node(text, range=self.ranges[predictors[pred_idx]])
                child.meta["predictor"] = predictors[pred_idx]
                child.meta["level"] = pred_idx
                child_code = (
                    code[:pred_idx] + str(bounded_idx) + code[pred_idx + 1 :]
                )
                child.meta["code"] = child_code
                parent.add_child(child)

                if depth + 1 >= max_depth and pred_idx + 1 < p:
                    # Boundary: mark as collapsed
                    child.meta["_collapsed"] = True
                    child.meta["_childCount"] = child_wt_count
                    child.meta["_wtFrom"] = child_wt_offset
                    child.meta["_wtTo"] = child_wt_offset + child_wt_count - 1
                    child.meta["idxWT"] = child_wt_offset
                else:
                    _build(
                        child, pred_idx + 1, depth + 1,
                        child_wt_offset, child_code,
                    )

        _build(root, start_pred_idx, 0, 0, parent_code)
        return root

    def expand_node(self, wt_from: int, wt_to: int, max_depth: int = 3,
                    node_level: int = None, node_code: str = None) -> List[dict]:
        """
        Expand a collapsed node by rebuilding its subtree from the WT range
        [wt_from, wt_to].  Returns the children JSON for that node, pruned
        to max_depth levels below.

        Parameters:
            node_level: the predictor level of the collapsed node, so we
                start building from the NEXT predictor (avoids re-including
                already-resolved levels).
            node_code: the WT code of the collapsed node, so expanded
                children carry forward the correct code prefix.
        """
        # Build a sub-DecisionTree for just these WTs
        sub_low = self.threshold_low.iloc[wt_from:wt_to + 1].reset_index(drop=True)
        sub_high = self.threshold_high.iloc[wt_from:wt_to + 1].reset_index(drop=True)
        sub_dt = DecisionTree(
            threshold_low=sub_low, threshold_high=sub_high, ranges=self.ranges
        )

        # Start from the next predictor after the collapsed node's level
        start = (node_level + 1) if node_level is not None else 0
        sub_root = sub_dt.tree_lazy(
            max_depth=max_depth,
            start_pred_idx=start,
            parent_code=node_code,
        )

        # Fix indices to use original (not sub-range) offsets
        def _fix_idx(node: Node, offset: int):
            if "idxWT" in node.meta:
                node.meta["idxWT"] += offset
            if "_wtFrom" in node.meta:
                node.meta["_wtFrom"] += offset
            if "_wtTo" in node.meta:
                node.meta["_wtTo"] += offset
            for child in node.children:
                _fix_idx(child, offset)

        _fix_idx(sub_root, wt_from)

        # Return children of the rebuilt root (the root itself is the node being expanded)
        return [child.json for child in sub_root.children]

    def _leaf_codes_direct(self) -> List[str]:
        """
        Compute leaf codes directly from threshold matrices without building
        the full tree.  Uses vectorized numpy operations — O(n × p) with
        minimal Python-loop overhead.
        """
        p = len(self.predictors)
        n = self.num_wt
        codes = np.empty((n, p), dtype="U1")

        for i in range(p):
            pred = self.predictors[i]
            pred_range = self.ranges.get(pred)

            low_vals = self.threshold_low.iloc[:, i].to_numpy()
            high_vals = self.threshold_high.iloc[:, i].to_numpy()
            unique_lows = np.sort(np.unique(low_vals))

            # Digit for each unique bin (small loop — typically 3–10 bins)
            digits = np.empty(len(unique_lows), dtype="U1")
            bounded_idx = 0
            for j, ul in enumerate(unique_lows):
                uh = high_vals[low_vals == ul][0]
                is_unbounded = (
                    pred_range is not None
                    and int_or_float(ul) == pred_range[0]
                    and int_or_float(uh) == pred_range[1]
                )
                if is_unbounded:
                    digits[j] = "0"
                else:
                    bounded_idx += 1
                    digits[j] = str(bounded_idx)

            # Vectorized mapping: searchsorted + fancy indexing
            bin_indices = np.searchsorted(unique_lows, low_vals)
            codes[:, i] = digits[bin_indices]

        # Join columns into strings using numpy char operations
        result = codes[:, 0]
        for i in range(1, p):
            result = np.char.add(result, codes[:, i])
        return result.tolist()

    def evaluate_all(self, loader: BasePointDataReader, *extra_cols: str):
        """
        Single-pass vectorized WT assignment for all PDT rows.

        Instead of evaluating each WT separately — O(num_wt × n × p) — this
        assigns every row to its weather type in one pass — O(n × p).

        Returns (wt_indices, dataframe) where:
          - wt_indices: int array of length n mapping each row to its WT row
            index in threshold_low / threshold_high.
          - dataframe: the columns needed for downstream processing.
        """
        predictors = self.predictors
        p = len(predictors)

        # Columns we need from the loader
        needed = list(set(predictors) | set(extra_cols))

        if loader.cheaper:
            df = loader.select(*needed, series=False)
        else:
            df = loader.dataframe

        # Per-predictor: sorted unique low thresholds and periodicity flag
        sorted_edges = []
        counts = []
        periodic_flags = []

        for i in range(p):
            lows = np.sort(self.threshold_low.iloc[:, i].unique())
            sorted_edges.append(lows)
            counts.append(len(lows))

            # A periodic predictor has at least one WT where thrL > thrH
            is_periodic = (
                self.threshold_low.iloc[:, i].values
                > self.threshold_high.iloc[:, i].values
            ).any()
            periodic_flags.append(is_periodic)

        # Strides to convert per-predictor bin indices into a flat WT row index
        strides = np.ones(p, dtype=np.int64)
        for i in range(p - 2, -1, -1):
            strides[i] = strides[i + 1] * counts[i + 1]

        n = len(df)
        wt_indices = np.zeros(n, dtype=np.int64)

        for i, pred in enumerate(predictors):
            values = df[pred].to_numpy(dtype=np.float64)
            bin_idx = np.searchsorted(sorted_edges[i], values, side="right") - 1

            if periodic_flags[i]:
                # Values below min threshold wrap to last bin (periodic)
                bin_idx[bin_idx < 0] = counts[i] - 1
            else:
                bin_idx = np.clip(bin_idx, 0, counts[i] - 1)

            wt_indices += bin_idx * strides[i]

        return wt_indices, df

    def cal_rep_error(self, loader: BasePointDataReader, nBin) -> pd.DataFrame:
        error_col = loader.error_type.name
        wt_indices, df = self.evaluate_all(loader, error_col)

        error_values = df[error_col].to_numpy()
        rep_error = np.full((self.num_wt, nBin), -1.0)

        for wt_idx in range(self.num_wt):
            mask = wt_indices == wt_idx
            if mask.any():
                wt_error = pd.Series(error_values[mask])
                rep_error[wt_idx] = WeatherType.discretize_error(
                    wt_error, num_bins=nBin
                )

        result = pd.DataFrame(data=rep_error, index=self._leaf_codes_direct())
        return result.round(3)


    def wt_title_tokens(self, wt_idx: int) -> Tuple:
        """Generate title tokens for a specific WT by row index."""
        thrL = self.threshold_low.iloc[wt_idx, :]
        thrH = self.threshold_high.iloc[wt_idx, :]
        tokens = tuple(
            "({low} <= {pred} < {high})".format(
                low=int_or_float(low), pred=pred, high=int_or_float(high)
            )
            for low, pred, high in zip(thrL, self.predictors, thrH)
        )
        return tokens


@attr.s(slots=True)
class WeatherType(object):
    thrL = attr.ib()
    thrH = attr.ib()

    thrL_labels = attr.ib()
    thrH_labels = attr.ib()

    error_type: ErrorType = attr.ib(default=None)

    DEFAULT_FER_BINS = [
        -1.1,
        -0.99,
        -0.75,
        -0.5,
        -0.25,
        0.25,
        0.5,
        0.75,
        1,
        1.5,
        2,
        3,
        5,
        10,
        25,
        50,
        1000,
    ]

    def evaluate(
        self, *cols: str, loader: BasePointDataReader
    ) -> Tuple[pd.DataFrame, Tuple]:
        self.error_type = loader.error_type

        if loader.cheaper:
            df: pd.DataFrame = loader.select(*cols, series=False)
        else:
            df: pd.DataFrame = loader.dataframe[list(cols)]

        title_pred = ()

        for thrL_label, thrH_label in zip(self.thrL_labels, self.thrH_labels):
            thrL_temp = self.thrL[thrL_label]
            thrH_temp = self.thrH[thrH_label]

            predictor_shortname = thrL_label.replace("_thrL", "")

            if loader.cheaper:
                temp_pred: pd.Series = loader.select(predictor_shortname)
            else:
                temp_pred: pd.Series = loader.dataframe[predictor_shortname]

            if thrL_temp > thrH_temp:
                # Case when predictor is periodic. For ex, Local Solar Time has
                # a period of 24 hours. It's possible to have the following
                # threshold splits:
                #   21 - 3   <- handles this case
                #    3 - 9
                #    9 - 15
                #   15 - 21
                mask = (temp_pred >= thrL_temp) | (temp_pred < thrH_temp)
            else:
                mask = (temp_pred >= thrL_temp) & (temp_pred < thrH_temp)

            df = df.loc[mask]

            title_pred += (
                "({low} <= {pred} < {high})".format(
                    low=int_or_float(thrL_temp),
                    pred=predictor_shortname,
                    high=int_or_float(thrH_temp),
                ),
            )

        return df, title_pred

    def _evaluate(self, predictors_matrix):
        """
        Deprecated decision tree evaluator, now replaced by evaluate().

        Algorithm is very similar to evaluate() with loader.cheaper=False.
        """
        self.error_type = (
            ErrorType.FER if ErrorType.FER.name in predictors_matrix else ErrorType.FE
        )

        error = predictors_matrix[self.error_type.name]
        title_pred = ""

        for thrL_label, thrH_label in zip(self.thrL_labels, self.thrH_labels):
            thrL_temp = self.thrL[thrL_label]
            thrH_temp = self.thrH[thrH_label]

            predictor_shortname = thrL_label.replace("_thrL", "")

            temp_pred = predictors_matrix[predictor_shortname]

            mask = (temp_pred >= thrL_temp) & (temp_pred < thrH_temp)

            error = error[mask]
            predictors_matrix = predictors_matrix[mask]

            title_pred += "({low} <= {pred} < {high}) ".format(
                low=int_or_float(thrL_temp),
                pred=predictor_shortname,
                high=int_or_float(thrH_temp),
            )

        return error.to_list(), predictors_matrix, title_pred

    @staticmethod
    def discretize_error(error, num_bins: int) -> pd.Series:
        error = error.sort_values().to_numpy()

        rep_error = np.zeros(num_bins)
        a = np.arange(num_bins)
        centre_bin = (((2.0 * a) + 1) / (2.0 * num_bins)) * len(error)
        for k in range(num_bins):
            val = centre_bin[k]
            low, up = math.floor(val), math.ceil(val)

            if len(error) == 0:
                rep_error[k] = -1
                continue
            elif len(error) == 1:
                low = up = 0
            elif up >= len(error):
                up = len(error) - 1
                low = up - 1

            low_val = error[low]
            up_val = error[up]
            w_low, w_up = 1 - abs(val - low), 1 - abs(val - up)

            rep_error[k] = ((low_val * w_low) + (up_val * w_up)) / (w_low + w_up)

        return pd.Series(rep_error)

    def plot(self, data, bins: list, title, y_lim: int, num_bins: int, out_path=None):
        matplotlib.style.use("seaborn-v0_8")
        fig, ax = plt.subplots()
        plt.tight_layout(pad=5)

        ax.set_xlabel(
            f"{self.error_type.name} Bins {'[-]' if self.error_type == ErrorType.FER else ''}",
            fontsize=8,
        )
        ax.set_ylabel("Frequencies [%]", fontsize=8)
        ax.set_title(title, fontsize=8)

        ax.xaxis.set_tick_params(labelsize=7)
        ax.yaxis.set_tick_params(labelsize=7)

        ax.text(
            x=0.05,
            y=0.95,
            s=f"total = {human_format(data.count())}",
            transform=ax.transAxes,
            fontsize="x-small",
            verticalalignment="top",
            bbox=dict(boxstyle="round", facecolor="wheat", alpha=0.5),
        )

        # Add bias computation
        discretized_error = self.discretize_error(error=data, num_bins=num_bins)
        bias = self.error_type.bias(error=discretized_error, low=bins[0], high=bins[-1])
        ax.text(
            x=0.85,
            y=0.95,
            s=f"{bias:.2f}",
            transform=ax.transAxes,
            fontsize=24,
            verticalalignment="top",
        )

        out = pd.cut(data, bins=bins, include_lowest=True)
        series = out.value_counts(normalize=True, sort=False) * 100

        subplot = series.plot.bar(ax=ax, rot=45, ylim=(0, y_lim))
        patches = subplot.patches

        autolabel(ax, patches, y_cum=len(out))
        colorize_patches(patches, bins, self.error_type)

        if out_path:
            return fig.savefig(out_path, format="png")
        else:
            img = BytesIO()
            fig.savefig(img, format="png")
            img.seek(0)
            return b64encode(img.read()).decode()

    def plot_maps(self, data, code, mode):
        if mode == "a":
            return plot_obs_freq(data, code)
        if mode == "b":
            return plot_avg(data, code)
        if mode == "c":
            return plot_std(data, code)


def autolabel(ax, patches, y_cum):
    max_y_value = ax.get_ylim()[1]
    padding = max_y_value * 0.01

    for patch in patches:
        value = patch.get_height() * y_cum / 100.0
        if value == 0:
            continue

        text = human_format(value)

        text_x = patch.get_x() + patch.get_width() / 2
        text_y = patch.get_height() + padding

        ax.text(
            text_x, text_y, text, ha="center", va="bottom", color="black", fontsize=7
        )


def human_format(num):
    magnitude = 0
    while abs(num) >= 1000:
        magnitude += 1
        num /= 1000.0
    # add more suffixes if you need them

    format_value = "%.2f" % num
    if float(format_value) - int(float(format_value)) == 0:
        num = "%d" % num
    else:
        num = format_value

    return f'{num}{["", "K", "M", "G", "T", "P"][magnitude]}'


def colorize_patches(patches, bins, error_type: ErrorType):
    if error_type == ErrorType.FER:
        green = [i for i in bins if i < 0][:-1]
        yellow = [i for i in bins if (0 < i <= 2)][1:]

        green_patches, white_patches, yellow_patches, red_patches = (
            patches[: len(green)],
            patches[len(green) : len(green) + 1],
            patches[len(green) + 2 - 1 : len(green) + 2 + len(yellow)],
            patches[len(green) + 2 + len(yellow) - 1 :],
        )

        for patch in green_patches:
            patch.set_facecolor("#2ecc71")

        for patch in white_patches:
            patch.set_facecolor("#ffffff")
            patch.set_edgecolor("#000000")

        for patch in yellow_patches:
            patch.set_facecolor("#fef160")

        for patch in red_patches:
            patch.set_facecolor("#d64541")
    elif error_type == ErrorType.FE:
        blue = [i for i in bins if i < 0][:-1]
        blue_patches, white_patches, red_patches = (
            patches[: len(blue)],
            patches[len(blue) : len(blue) + 1],
            patches[len(blue) + 2 - 1 :],
        )

        for patch in blue_patches:
            patch.set_facecolor("#2c82c9")

        for patch in white_patches:
            patch.set_facecolor("#ffffff")
            patch.set_edgecolor("#000000")

        for patch in red_patches:
            patch.set_facecolor("#d64541")

    else:
        # Do not apply any color
        pass
