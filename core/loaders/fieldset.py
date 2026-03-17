import logging
import os
from functools import reduce
from pathlib import Path
from typing import Union

import numpy as np

logger = logging.getLogger(__name__)

_metview = None
_FieldsetBase = None


def _get_metview():
    global _metview, _FieldsetBase
    if _metview is None:
        import metview
        _metview = metview
        _FieldsetBase = metview.Fieldset
    return _metview


def _get_fieldset_base():
    if _FieldsetBase is None:
        _get_metview()
    return _FieldsetBase


class Fieldset:
    """
    Wrapper around metview.Fieldset. The actual metview base class is
    applied dynamically at construction time (via from_path) so the
    module can be imported without metview being installed.
    """

    def __init__(self, path):
        raise PermissionError("Initializing this class directly is not allowed.")

    @property
    def units(self):
        return _get_metview().grib_get_string(self, "units")

    @property
    def name(self) -> str:
        return _get_metview().grib_get_string(self, "name")

    @classmethod
    def from_path(cls, path: Union[Path, str]):
        mv = _get_metview()

        if isinstance(path, Path):
            path = str(path)

        if not os.path.exists(path):
            raise IOError(f"File does not exist: {path}")

        obj = mv.read(path)
        # Dynamically make Fieldset inherit from metview.Fieldset
        if not issubclass(cls, _get_fieldset_base()):
            cls.__bases__ = (_get_fieldset_base(),)
        obj.__class__ = cls
        return obj

    @property
    def dataframe(self):
        data_variables = list(self.to_dataset().data_vars)
        return self.to_dataset().to_dataframe()[
            ["latitude", "longitude"] + data_variables
        ]

    def nearest_gridpoint(self, geopoints):
        return _get_metview().nearest_gridpoint(self, geopoints)

    @property
    def values(self):
        return _get_metview().values(self)

    @values.setter
    def values(self, values):
        raise NotImplementedError

    @classmethod
    def vector_of(cls, *args):
        mv = _get_metview()
        if len(args) == 0:
            raise Exception

        term_1 = args[0]
        sum_squared_values = sum(abs(term.values) ** 2 for term in args)
        values = np.sqrt(sum_squared_values)

        mv_fieldset = mv.set_values(term_1, values)
        mv_fieldset.__class__ = cls
        return mv_fieldset

    @classmethod
    def max_of(cls, *args):
        mv = _get_metview()
        if len(args) == 0:
            raise Exception

        term_1 = args[0]
        values = reduce(np.maximum, (arg.values for arg in args))

        mv_fieldset = mv.set_values(term_1, values)
        mv_fieldset.__class__ = cls
        return mv_fieldset

    @classmethod
    def min_of(cls, *args):
        mv = _get_metview()
        if len(args) == 0:
            raise Exception

        term_1 = args[0]
        values = reduce(np.minimum, (arg.values for arg in args))

        mv_fieldset = mv.set_values(term_1, values)
        mv_fieldset.__class__ = cls
        return mv_fieldset

    def __add__(self, other):
        mv_fieldset = super().__add__(other)
        mv_fieldset.__class__ = type(self)
        return mv_fieldset

    def __sub__(self, other):
        mv_fieldset = super().__sub__(other)
        mv_fieldset.__class__ = type(self)
        return mv_fieldset

    def __mul__(self, other):
        mv_fieldset = super().__mul__(other)
        mv_fieldset.__class__ = type(self)
        return mv_fieldset

    def __truediv__(self, other):
        mv_fieldset = super().__truediv__(other)
        mv_fieldset.__class__ = type(self)
        return mv_fieldset

    def __pow__(self, other):
        mv_fieldset = super().__pow__(other)
        mv_fieldset.__class__ = type(self)
        return mv_fieldset


class NetCDF:
    def __init__(self, dataframe):
        self.dataframe = dataframe

    @classmethod
    def from_path(cls, path: Union[Path, str]):
        mv = _get_metview()

        if isinstance(path, Path):
            path = str(path)

        mv_instance = mv.read(path)

        dataset = mv_instance.to_dataset()
        data_vars = list(dataset.data_vars)
        coords = list(
            {"lat", "lon", "latitude", "longitude", "latitudes", "longitudes"}
            & set(dataset.coords)
        )

        df = dataset.to_dataframe().reset_index()
        df = df[coords + data_vars]

        for coord in coords:
            df[coord] = df[coord].apply(str)

        return cls(df)

    def __mul__(self, other):
        s = self.dataframe.select_dtypes(include=[np.number]) * other
        df = self.dataframe.copy()
        df[s.columns] = s
        return type(self)(df)

    def __add__(self, other):
        s = self.dataframe.select_dtypes(include=[np.number]) + other
        df = self.dataframe.copy()
        df[s.columns] = s
        return type(self)(df)

    def __sub__(self, other):
        s = self.dataframe.select_dtypes(include=[np.number]) - other
        df = self.dataframe.copy()
        df[s.columns] = s
        return type(self)(df)

    def __truediv__(self, other):
        s = self.dataframe.select_dtypes(include=[np.number]) / other
        df = self.dataframe.copy()
        df[s.columns] = s
        return type(self)(df)

    def __pow__(self, power, modulo=None):
        s = self.dataframe.select_dtypes(include=[np.number]) ** power
        df = self.dataframe.copy()
        df[s.columns] = s
        return type(self)(df)
