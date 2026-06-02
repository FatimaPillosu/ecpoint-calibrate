import numpy as np
import pandas
import pytest

from core.api import _merge_range
from core.postprocessors.decision_tree import DecisionTree, WeatherType
from tests.unit.utils import strip_node_shape

inf = float("inf")


@pytest.fixture
def sparse_breakpoints():
    records = [
        ("-inf", "0.25", "-inf", "2", "5", "20", "-inf", "inf", "-inf", "70"),
        ("", "", "", "", "20", "inf", "", "", "70", "275"),
        ("", "", "", "", "", "", "", "", "275", "inf"),
    ]

    labels = [
        "CPR_thrL",
        "CPR_thrH",
        "TP_thrL",
        "TP_thrH",
        "WSPD_thrL",
        "WSPD_thrH",
        "CAPE_thrL",
        "CAPE_thrH",
        "SR_thrL",
        "SR_thrH",
    ]

    ranges = {
        "CPR": ["-inf", "inf"],
        "TP": ["-inf", "inf"],
        "WSPD": ["-inf", "inf"],
        "CAPE": ["-inf", "inf"],
        "SR": ["-inf", "inf"],
    }

    df = pandas.DataFrame.from_records(records, columns=labels)
    return df.iloc[:, ::2], df.iloc[:, 1::2], ranges


@pytest.fixture
def breakpoints():
    matrix = [
        [-inf, 0.25, -inf, 2.0, -inf, 5.0, -inf, inf, -inf, 70.0],
        [-inf, 0.25, -inf, 2.0, -inf, 5.0, -inf, inf, 70.0, 275.0],
        [-inf, 0.25, -inf, 2.0, -inf, 5.0, -inf, inf, 275.0, inf],
        [-inf, 0.25, -inf, 2.0, 5.0, 20.0, -inf, inf, -inf, 70.0],
        [-inf, 0.25, -inf, 2.0, 5.0, 20.0, -inf, inf, 70.0, 275.0],
        [-inf, 0.25, -inf, 2.0, 5.0, 20.0, -inf, inf, 275.0, inf],
        [-inf, 0.25, -inf, 2.0, 20.0, inf, -inf, inf, -inf, 70.0],
        [-inf, 0.25, -inf, 2.0, 20.0, inf, -inf, inf, 70.0, 275.0],
        [-inf, 0.25, -inf, 2.0, 20.0, inf, -inf, inf, 275.0, inf],
        [-inf, 0.25, 2.0, inf, -inf, 5.0, -inf, inf, -inf, 70.0],
        [-inf, 0.25, 2.0, inf, -inf, 5.0, -inf, inf, 70.0, 275.0],
        [-inf, 0.25, 2.0, inf, -inf, 5.0, -inf, inf, 275.0, inf],
        [-inf, 0.25, 2.0, inf, 5.0, 20.0, -inf, inf, -inf, 70.0],
        [-inf, 0.25, 2.0, inf, 5.0, 20.0, -inf, inf, 70.0, 275.0],
        [-inf, 0.25, 2.0, inf, 5.0, 20.0, -inf, inf, 275.0, inf],
        [-inf, 0.25, 2.0, inf, 20.0, inf, -inf, inf, -inf, 70.0],
        [-inf, 0.25, 2.0, inf, 20.0, inf, -inf, inf, 70.0, 275.0],
        [-inf, 0.25, 2.0, inf, 20.0, inf, -inf, inf, 275.0, inf],
        [0.25, inf, -inf, 2.0, -inf, 5.0, -inf, inf, -inf, 70.0],
        [0.25, inf, -inf, 2.0, -inf, 5.0, -inf, inf, 70.0, 275.0],
        [0.25, inf, -inf, 2.0, -inf, 5.0, -inf, inf, 275.0, inf],
        [0.25, inf, -inf, 2.0, 5.0, 20.0, -inf, inf, -inf, 70.0],
        [0.25, inf, -inf, 2.0, 5.0, 20.0, -inf, inf, 70.0, 275.0],
        [0.25, inf, -inf, 2.0, 5.0, 20.0, -inf, inf, 275.0, inf],
        [0.25, inf, -inf, 2.0, 20.0, inf, -inf, inf, -inf, 70.0],
        [0.25, inf, -inf, 2.0, 20.0, inf, -inf, inf, 70.0, 275.0],
        [0.25, inf, -inf, 2.0, 20.0, inf, -inf, inf, 275.0, inf],
        [0.25, inf, 2.0, inf, -inf, 5.0, -inf, inf, -inf, 70.0],
        [0.25, inf, 2.0, inf, -inf, 5.0, -inf, inf, 70.0, 275.0],
        [0.25, inf, 2.0, inf, -inf, 5.0, -inf, inf, 275.0, inf],
        [0.25, inf, 2.0, inf, 5.0, 20.0, -inf, inf, -inf, 70.0],
        [0.25, inf, 2.0, inf, 5.0, 20.0, -inf, inf, 70.0, 275.0],
        [0.25, inf, 2.0, inf, 5.0, 20.0, -inf, inf, 275.0, inf],
        [0.25, inf, 2.0, inf, 20.0, inf, -inf, inf, -inf, 70.0],
        [0.25, inf, 2.0, inf, 20.0, inf, -inf, inf, 70.0, 275.0],
        [0.25, inf, 2.0, inf, 20.0, inf, -inf, inf, 275.0, inf],
    ]

    labels = [
        "cpr_thrL",
        "cpr_thrH",
        "tp_acc_thrL",
        "tp_acc_thrH",
        "cp_acc_thrL",
        "cp_acc_thrH",
        "cape_wa_thrL",
        "cape_wa_thrH",
        "sr24h_thrL",
        "sr24h_thrH",
    ]

    df = pandas.DataFrame.from_records(matrix, columns=labels)
    return df.iloc[:, ::2], df.iloc[:, 1::2]


def test_decision_tree_with_predefined_threshold_splits(sparse_breakpoints):
    sparse_thresholds_low, sparse_thresholds_high, ranges = sparse_breakpoints
    dt = DecisionTree.create_from_sparse_thresholds(
        low=sparse_thresholds_low, high=sparse_thresholds_high, ranges=ranges
    )

    expected_threshold_low_matrix = [
        [float("-inf"), float("-inf"), 5.0, float("-inf"), float("-inf")],
        [float("-inf"), float("-inf"), 5.0, float("-inf"), 70.0],
        [float("-inf"), float("-inf"), 5.0, float("-inf"), 275.0],
        [float("-inf"), float("-inf"), 20.0, float("-inf"), float("-inf")],
        [float("-inf"), float("-inf"), 20.0, float("-inf"), 70.0],
        [float("-inf"), float("-inf"), 20.0, float("-inf"), 275.0],
    ]
    assert np.array_equal(dt.threshold_low, expected_threshold_low_matrix)

    expected_threshold_high_matrix = [
        [0.25, 2.0, 20.0, float("inf"), 70.0],
        [0.25, 2.0, 20.0, float("inf"), 275.0],
        [0.25, 2.0, 20.0, float("inf"), float("inf")],
        [0.25, 2.0, float("inf"), float("inf"), 70.0],
        [0.25, 2.0, float("inf"), float("inf"), 275.0],
        [0.25, 2.0, float("inf"), float("inf"), float("inf")],
    ]
    assert np.array_equal(dt.threshold_high, expected_threshold_high_matrix)


def test_decision_tree_construction(breakpoints):
    low, high = breakpoints
    ranges = {
        "cpr": ["-inf", "inf"],
        "tp_acc": ["-inf", "inf"],
        "cp_acc": ["-inf", "inf"],
        "sr24h": ["-inf", "inf"],
        "cape_wa": ["-inf", "inf"],
    }

    dt = DecisionTree(threshold_low=low, threshold_high=high, ranges=ranges)

    expected = {
        "name": "Root",
        "children": [
            {
                "name": "-inf < cpr < 0.25",
                "children": [
                    {
                        "name": "-inf < tp_acc < 2",
                        "children": [
                            {
                                "name": "-inf < cp_acc < 5",
                                "children": [
                                    {
                                        "name": "-inf < sr24h < 70",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 0,
                                            "code": "11101",
                                        },
                                    },
                                    {
                                        "name": "70 < sr24h < 275",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 1,
                                            "code": "11102",
                                        },
                                    },
                                    {
                                        "name": "275 < sr24h < inf",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 2,
                                            "code": "11103",
                                        },
                                    },
                                ],
                                "parent": None,
                                "meta": {
                                    "predictor": "cp_acc",
                                    "level": 2,
                                    "idxWT": 2,
                                    "code": "11100",
                                },
                            },
                            {
                                "name": "5 < cp_acc < 20",
                                "children": [
                                    {
                                        "name": "-inf < sr24h < 70",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 3,
                                            "code": "11201",
                                        },
                                    },
                                    {
                                        "name": "70 < sr24h < 275",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 4,
                                            "code": "11202",
                                        },
                                    },
                                    {
                                        "name": "275 < sr24h < inf",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 5,
                                            "code": "11203",
                                        },
                                    },
                                ],
                                "parent": None,
                                "meta": {
                                    "predictor": "cp_acc",
                                    "level": 2,
                                    "idxWT": 5,
                                    "code": "11200",
                                },
                            },
                            {
                                "name": "20 < cp_acc < inf",
                                "children": [
                                    {
                                        "name": "-inf < sr24h < 70",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 6,
                                            "code": "11301",
                                        },
                                    },
                                    {
                                        "name": "70 < sr24h < 275",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 7,
                                            "code": "11302",
                                        },
                                    },
                                    {
                                        "name": "275 < sr24h < inf",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 8,
                                            "code": "11303",
                                        },
                                    },
                                ],
                                "parent": None,
                                "meta": {
                                    "predictor": "cp_acc",
                                    "level": 2,
                                    "idxWT": 8,
                                    "code": "11300",
                                },
                            },
                        ],
                        "parent": None,
                        "meta": {
                            "predictor": "tp_acc",
                            "level": 1,
                            "idxWT": 6,
                            "code": "11000",
                        },
                    },
                    {
                        "name": "2 < tp_acc < inf",
                        "children": [
                            {
                                "name": "-inf < cp_acc < 5",
                                "children": [
                                    {
                                        "name": "-inf < sr24h < 70",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 9,
                                            "code": "12101",
                                        },
                                    },
                                    {
                                        "name": "70 < sr24h < 275",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 10,
                                            "code": "12102",
                                        },
                                    },
                                    {
                                        "name": "275 < sr24h < inf",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 11,
                                            "code": "12103",
                                        },
                                    },
                                ],
                                "parent": None,
                                "meta": {
                                    "predictor": "cp_acc",
                                    "level": 2,
                                    "idxWT": 11,
                                    "code": "12100",
                                },
                            },
                            {
                                "name": "5 < cp_acc < 20",
                                "children": [
                                    {
                                        "name": "-inf < sr24h < 70",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 12,
                                            "code": "12201",
                                        },
                                    },
                                    {
                                        "name": "70 < sr24h < 275",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 13,
                                            "code": "12202",
                                        },
                                    },
                                    {
                                        "name": "275 < sr24h < inf",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 14,
                                            "code": "12203",
                                        },
                                    },
                                ],
                                "parent": None,
                                "meta": {
                                    "predictor": "cp_acc",
                                    "level": 2,
                                    "idxWT": 14,
                                    "code": "12200",
                                },
                            },
                            {
                                "name": "20 < cp_acc < inf",
                                "children": [
                                    {
                                        "name": "-inf < sr24h < 70",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 15,
                                            "code": "12301",
                                        },
                                    },
                                    {
                                        "name": "70 < sr24h < 275",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 16,
                                            "code": "12302",
                                        },
                                    },
                                    {
                                        "name": "275 < sr24h < inf",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 17,
                                            "code": "12303",
                                        },
                                    },
                                ],
                                "parent": None,
                                "meta": {
                                    "predictor": "cp_acc",
                                    "level": 2,
                                    "idxWT": 17,
                                    "code": "12300",
                                },
                            },
                        ],
                        "parent": None,
                        "meta": {
                            "predictor": "tp_acc",
                            "level": 1,
                            "idxWT": 15,
                            "code": "12000",
                        },
                    },
                ],
                "parent": None,
                "meta": {"predictor": "cpr", "level": 0, "idxWT": 9, "code": "10000"},
            },
            {
                "name": "0.25 < cpr < inf",
                "children": [
                    {
                        "name": "-inf < tp_acc < 2",
                        "children": [
                            {
                                "name": "-inf < cp_acc < 5",
                                "children": [
                                    {
                                        "name": "-inf < sr24h < 70",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 18,
                                            "code": "21101",
                                        },
                                    },
                                    {
                                        "name": "70 < sr24h < 275",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 19,
                                            "code": "21102",
                                        },
                                    },
                                    {
                                        "name": "275 < sr24h < inf",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 20,
                                            "code": "21103",
                                        },
                                    },
                                ],
                                "parent": None,
                                "meta": {
                                    "predictor": "cp_acc",
                                    "level": 2,
                                    "idxWT": 20,
                                    "code": "21100",
                                },
                            },
                            {
                                "name": "5 < cp_acc < 20",
                                "children": [
                                    {
                                        "name": "-inf < sr24h < 70",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 21,
                                            "code": "21201",
                                        },
                                    },
                                    {
                                        "name": "70 < sr24h < 275",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 22,
                                            "code": "21202",
                                        },
                                    },
                                    {
                                        "name": "275 < sr24h < inf",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 23,
                                            "code": "21203",
                                        },
                                    },
                                ],
                                "parent": None,
                                "meta": {
                                    "predictor": "cp_acc",
                                    "level": 2,
                                    "idxWT": 23,
                                    "code": "21200",
                                },
                            },
                            {
                                "name": "20 < cp_acc < inf",
                                "children": [
                                    {
                                        "name": "-inf < sr24h < 70",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 24,
                                            "code": "21301",
                                        },
                                    },
                                    {
                                        "name": "70 < sr24h < 275",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 25,
                                            "code": "21302",
                                        },
                                    },
                                    {
                                        "name": "275 < sr24h < inf",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 26,
                                            "code": "21303",
                                        },
                                    },
                                ],
                                "parent": None,
                                "meta": {
                                    "predictor": "cp_acc",
                                    "level": 2,
                                    "idxWT": 26,
                                    "code": "21300",
                                },
                            },
                        ],
                        "parent": None,
                        "meta": {
                            "predictor": "tp_acc",
                            "level": 1,
                            "idxWT": 24,
                            "code": "21000",
                        },
                    },
                    {
                        "name": "2 < tp_acc < inf",
                        "children": [
                            {
                                "name": "-inf < cp_acc < 5",
                                "children": [
                                    {
                                        "name": "-inf < sr24h < 70",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 27,
                                            "code": "22101",
                                        },
                                    },
                                    {
                                        "name": "70 < sr24h < 275",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 28,
                                            "code": "22102",
                                        },
                                    },
                                    {
                                        "name": "275 < sr24h < inf",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 29,
                                            "code": "22103",
                                        },
                                    },
                                ],
                                "parent": None,
                                "meta": {
                                    "predictor": "cp_acc",
                                    "level": 2,
                                    "idxWT": 29,
                                    "code": "22100",
                                },
                            },
                            {
                                "name": "5 < cp_acc < 20",
                                "children": [
                                    {
                                        "name": "-inf < sr24h < 70",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 30,
                                            "code": "22201",
                                        },
                                    },
                                    {
                                        "name": "70 < sr24h < 275",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 31,
                                            "code": "22202",
                                        },
                                    },
                                    {
                                        "name": "275 < sr24h < inf",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 32,
                                            "code": "22203",
                                        },
                                    },
                                ],
                                "parent": None,
                                "meta": {
                                    "predictor": "cp_acc",
                                    "level": 2,
                                    "idxWT": 32,
                                    "code": "22200",
                                },
                            },
                            {
                                "name": "20 < cp_acc < inf",
                                "children": [
                                    {
                                        "name": "-inf < sr24h < 70",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 33,
                                            "code": "22301",
                                        },
                                    },
                                    {
                                        "name": "70 < sr24h < 275",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 34,
                                            "code": "22302",
                                        },
                                    },
                                    {
                                        "name": "275 < sr24h < inf",
                                        "children": [],
                                        "parent": None,
                                        "meta": {
                                            "predictor": "sr24h",
                                            "level": 4,
                                            "idxWT": 35,
                                            "code": "22303",
                                        },
                                    },
                                ],
                                "parent": None,
                                "meta": {
                                    "predictor": "cp_acc",
                                    "level": 2,
                                    "idxWT": 35,
                                    "code": "22300",
                                },
                            },
                        ],
                        "parent": None,
                        "meta": {
                            "predictor": "tp_acc",
                            "level": 1,
                            "idxWT": 33,
                            "code": "22000",
                        },
                    },
                ],
                "parent": None,
                "meta": {"predictor": "cpr", "level": 0, "idxWT": 27, "code": "20000"},
            },
        ],
        "parent": None,
        "meta": {"level": -1, "idxWT": 18, "code": "00000"},
    }

    assert strip_node_shape(dt.tree.json) == expected


def test_leaf_codes_skip_level_assigns_zero_digit():
    """Regression for WT-CODE-SKIP-LEVEL: a row that is fully unbounded at a
    predictor must get digit 0 there, even when it shares its low value (-inf)
    with a bounded sibling. Root cause (fixed): a global unique-lows lookup
    conflated bounded and unbounded rows sharing the same low value;
    _leaf_codes_direct now classifies each row by its own (low, high) pair.
    """
    low = pandas.DataFrame({"A_thrL": [-inf, -inf, 70.0]})
    high = pandas.DataFrame({"A_thrH": [inf, 70.0, inf]})
    dt = DecisionTree(
        threshold_low=low, threshold_high=high, ranges={"A": ["-inf", "inf"]}
    )

    assert dt._leaf_codes_direct() == ["0", "1", "2"]


def test_leaf_codes_renumbered_within_sibling_group_after_leftmost_merge():
    """Regression for WT-CODE-RENUMBER: after the leftmost WT in a sibling group
    is merged, survivors are renumbered sequentially within their own group. Here
    B under A1 has been merged to 2 bins while B under A2 keeps 3 bins, so digits
    must restart per group (…12, not …13). The pre-fix global-rank lookup across
    groups produced "13"; _leaf_codes_direct now groups rows by their parent
    conditions and ranks sequentially within each group.
    """
    low = pandas.DataFrame(
        {
            "A_thrL": [-inf, -inf, 0.25, 0.25, 0.25],
            "B_thrL": [-inf, 275.0, -inf, 70.0, 275.0],
        }
    )
    high = pandas.DataFrame(
        {
            "A_thrH": [0.25, 0.25, inf, inf, inf],
            "B_thrH": [275.0, inf, 70.0, 275.0, inf],
        }
    )
    dt = DecisionTree(
        threshold_low=low,
        threshold_high=high,
        ranges={"A": ["-inf", "inf"], "B": ["-inf", "inf"]},
    )

    assert dt._leaf_codes_direct() == ["11", "12", "21", "22", "23"]
    assert dt.leaf_codes == ["11", "12", "21", "22", "23"]


class _FakeLoader:
    """Minimal BasePointDataReader stand-in (cheaper=False) for evaluate()."""

    def __init__(self, dataframe):
        self.dataframe = dataframe
        self.cheaper = False
        self.error_type = None


def test_weathertype_evaluate_counts_merged_wt_independently():
    """Regression for WT-EXPORT-MISMATCH: WeatherType.evaluate() filters each
    predictor condition independently, so a merged/wide-range WT counts the right
    observations. The replaced evaluate_all() assumed a Cartesian-product matrix
    and mis-binned observations after pruning, so exported histograms diverged
    from the in-app ones; both paths now use the same direct per-WT checking.
    """
    df = pandas.DataFrame(
        {
            "A": [0.1, 0.3, 0.3, 0.5, 0.9, 1.0, 0.2, 0.4, 0.6, 0.8],
            "B": [10, 50, 100, 200, 300, 80, 90, 280, 30, 500],
            "OBS": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        }
    )
    labels = ["A_thrL", "A_thrH", "B_thrL", "B_thrH"]
    series = pandas.Series(dict(zip(labels, [0.25, inf, 70.0, 275.0])))
    wt = WeatherType(
        thrL=series.iloc[::2],
        thrH=series.iloc[1::2],
        thrL_labels=labels[::2],
        thrH_labels=labels[1::2],
    )

    out, _ = wt.evaluate("OBS", loader=_FakeLoader(df))

    # A in [0.25, inf) AND B in [70, 275)  ->  observations 3, 4, 6
    assert sorted(out["OBS"].tolist()) == [3, 4, 6]


def test_evaluate_handles_periodic_predictor_wraparound():
    """A periodic predictor (thrL > thrH, e.g. Local Solar Time 21->03) matches
    values >= thrL OR < thrH, wrapping across the period boundary.
    """
    df = pandas.DataFrame(
        {
            "LST": [0, 1, 2, 3, 5, 10, 15, 20, 21, 22, 23.0],
            "OBS": [100, 101, 102, 103, 105, 110, 115, 120, 121, 122, 123],
        }
    )
    labels = ["LST_thrL", "LST_thrH"]
    series = pandas.Series(dict(zip(labels, [21.0, 3.0])))  # 21 -> 3 wraps
    wt = WeatherType(
        thrL=series.iloc[::2],
        thrH=series.iloc[1::2],
        thrL_labels=labels[::2],
        thrH_labels=labels[1::2],
    )

    out, _ = wt.evaluate("OBS", loader=_FakeLoader(df))

    assert sorted(out["OBS"].tolist()) == [100, 101, 102, 121, 122, 123]


def test_evaluate_all_agrees_with_per_wt_evaluate():
    """DecisionTree.evaluate_all() (single-pass WT assignment) must place each
    observation in the same WT as per-WT WeatherType.evaluate(). These are the
    two evaluation paths whose divergence caused the export-histogram mismatch.
    """
    low = pandas.DataFrame(
        {"A_thrL": [-inf, -inf, 0.0, 0.0], "B_thrL": [-inf, 0.0, -inf, 0.0]}
    )
    high = pandas.DataFrame(
        {"A_thrH": [0.0, 0.0, inf, inf], "B_thrH": [0.0, inf, 0.0, inf]}
    )
    dt = DecisionTree(
        threshold_low=low,
        threshold_high=high,
        ranges={"A": ["-inf", "inf"], "B": ["-inf", "inf"]},
    )
    ldf = pandas.DataFrame(
        {"A": [-5, -5, 5, 5, -1, 1.0], "B": [-5, 5, -5, 5, 1, -1], "OBS": [1, 2, 3, 4, 5, 6]}
    )

    wt_indices, _ = dt.evaluate_all(_FakeLoader(ldf), "OBS")

    for i in range(dt.num_wt):
        wt = WeatherType(
            thrL=dt.threshold_low.iloc[i],
            thrH=dt.threshold_high.iloc[i],
            thrL_labels=list(dt.threshold_low.columns),
            thrH_labels=list(dt.threshold_high.columns),
        )
        out, _ = wt.evaluate("OBS", loader=_FakeLoader(ldf))
        from_evaluate = set(out["OBS"].tolist())
        from_evaluate_all = set(ldf["OBS"].to_numpy()[wt_indices == i].tolist())
        assert from_evaluate == from_evaluate_all


def test_discretize_error_representative_values():
    """discretize_error returns one representative value per bin (the FER/FE
    histogram input): empty input yields -1 sentinels, a single value repeats.
    """
    assert WeatherType.discretize_error(
        pandas.Series([0.0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), num_bins=5
    ).round(3).tolist() == [1.0, 3.0, 5.0, 7.0, 9.0]
    assert WeatherType.discretize_error(
        pandas.Series([], dtype=float), num_bins=3
    ).tolist() == [-1.0, -1.0, -1.0]
    assert WeatherType.discretize_error(
        pandas.Series([5.0]), num_bins=3
    ).tolist() == [5.0, 5.0, 5.0]


def test_evaluate_skips_predictor_at_its_full_field_range():
    """A predictor whose (thrL, thrH) equals its configured field range is a
    no-op filter — only genuinely-bounded predictors narrow the selection.
    """
    df = pandas.DataFrame(
        {"A": [0.1, 0.3, 0.5, 0.9, 1.0], "B": [1, 2, 3, 4, 5.0], "OBS": [10, 20, 30, 40, 50]}
    )
    labels = ["A_thrL", "A_thrH", "B_thrL", "B_thrH"]
    series = pandas.Series(dict(zip(labels, [0.25, inf, 0.0, 24.0])))  # B == its field range
    wt = WeatherType(
        thrL=series.iloc[::2],
        thrH=series.iloc[1::2],
        thrL_labels=labels[::2],
        thrH_labels=labels[1::2],
    )

    out, _ = wt.evaluate("OBS", loader=_FakeLoader(df), field_ranges={"B": ["0", "24"]})

    # B is skipped; only A >= 0.25 filters (excludes A=0.1)
    assert sorted(out["OBS"].tolist()) == [20, 30, 40, 50]


def test_leaf_codes_rightmost_merge_and_all_unbounded():
    """More WT-code cases: digits renumber sequentially within a group after a
    rightmost merge, and a predictor that is unbounded for every row gets digit 0.
    """
    # A2's two rightmost B-bins merged into [70, inf]; digits restart per group
    low = pandas.DataFrame(
        {
            "A_thrL": [-inf, -inf, -inf, 0.25, 0.25],
            "B_thrL": [-inf, 70.0, 275.0, -inf, 70.0],
        }
    )
    high = pandas.DataFrame(
        {
            "A_thrH": [0.25, 0.25, 0.25, inf, inf],
            "B_thrH": [70.0, 275.0, inf, 70.0, inf],
        }
    )
    dt = DecisionTree(
        threshold_low=low,
        threshold_high=high,
        ranges={"A": ["-inf", "inf"], "B": ["-inf", "inf"]},
    )
    assert dt._leaf_codes_direct() == ["11", "12", "13", "21", "22"]

    # A is fully unbounded for every row -> digit 0 throughout
    low2 = pandas.DataFrame({"A_thrL": [-inf, -inf], "B_thrL": [-inf, 5.0]})
    high2 = pandas.DataFrame({"A_thrH": [inf, inf], "B_thrH": [5.0, inf]})
    dt2 = DecisionTree(
        threshold_low=low2,
        threshold_high=high2,
        ranges={"A": ["-inf", "inf"], "B": ["-inf", "inf"]},
    )
    assert dt2._leaf_codes_direct() == ["01", "02"]


def test_merge_range_expands_and_collapses_to_full_range():
    """_merge_range (the WT-elimination merge step) expands the survivor's range
    at the deepest differing predictor; if the merged span covers the predictor's
    whole field range it collapses to (-inf, inf).
    """
    # survivor B[70,275] + donor B[-inf,70]  ->  B[-inf,275]
    survivor = [0.25, inf, 70.0, 275.0]
    _merge_range(survivor, [0.25, inf, -inf, 70.0], 2, ["A", "B"], {})
    assert survivor == [0.25, inf, -inf, 275.0]

    # survivor B[0,12] + donor B[12,24], B field range [0,24]  ->  collapses to (-inf, inf)
    survivor = [0.25, inf, 0.0, 12.0]
    _merge_range(survivor, [0.25, inf, 12.0, 24.0], 2, ["A", "B"], {"B": ["0", "24"]})
    assert survivor == [0.25, inf, -inf, inf]
