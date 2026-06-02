import numpy as np

from core.computations.utils import (
    compute_accumulated_field,
    compute_instantaneous_field_001,
    compute_instantaneous_field_010,
    compute_instantaneous_field_100,
    compute_maximum,
    compute_minimum,
    compute_weighted_average_field,
)
from core.loaders.fieldset import Fieldset
from tests.conf import TEST_DATA_DIR


def test_compute_accumulated_field():
    assert compute_accumulated_field(1, 2, 3, 4, 5) == 4


def test_compute_weighted_average_field():
    assert compute_weighted_average_field(2, 4) == 3
    assert compute_weighted_average_field(2, 4, 6) == 4
    assert compute_weighted_average_field(2, 4, 4, 6) == 4
    assert compute_weighted_average_field(2, 4, 8, 4, 6) == 5


def test_compute_instantaneous_fields():
    # 100 -> first step, 001 -> last step, 010 -> middle step
    assert compute_instantaneous_field_100(10, 20, 30) == 10
    assert compute_instantaneous_field_001(10, 20, 30) == 30
    assert compute_instantaneous_field_010(10, 20, 30) == 20
    assert compute_instantaneous_field_010(10, 20, 30, 40, 50) == 30


def test_compute_maximum_and_minimum():
    a = Fieldset.from_path(path=TEST_DATA_DIR / "cape_20150601_00_03.grib")
    b = Fieldset.from_path(path=TEST_DATA_DIR / "cape_20150601_00_27.grib")
    a_values, b_values = a.values, b.values

    maximum = compute_maximum(a, b)
    minimum = compute_minimum(a, b)

    assert isinstance(maximum, Fieldset)
    assert isinstance(minimum, Fieldset)
    assert (maximum.values == np.maximum(a_values, b_values)).all()
    assert (minimum.values == np.minimum(a_values, b_values)).all()
