"""GRIB fieldset loader.

GRIB messages are read with earthkit-data; field values are held as numpy
arrays so that arithmetic, reductions and nearest-gridpoint extraction are
plain numpy / earthkit-geo operations.

A :class:`Fieldset` wraps a single earthkit ``GribField`` (kept for grid
geometry and metadata) plus an optional numpy values override produced by
arithmetic. Operations never mutate the source field.
"""

import logging
import os
import threading
from functools import reduce
from pathlib import Path
from typing import Union

import numpy as np

logger = logging.getLogger(__name__)

_ekd = None

# eccodes' GRIB-definition parser uses a non-reentrant flex scanner: two GRIB
# reads running concurrently (e.g. a predictor-metadata request overlapping a
# computation under Flask's threaded dev server) corrupt its shared state and
# abort the process ("fatal flex scanner internal error"). Serialise every
# eccodes-touching operation behind this lock so only one runs at a time.
_ECCODES_LOCK = threading.RLock()


def _get_ekd():
    """Import earthkit-data lazily so the module imports without it installed."""
    global _ekd
    if _ekd is None:
        import earthkit.data as ekd

        _ekd = ekd
    return _ekd


class Fieldset:
    """Numpy-backed wrapper around a single earthkit GRIB field."""

    __slots__ = ("_field", "_values", "_latlon", "_kdtree", "_units", "_name")

    def __init__(self, field, values=None):
        # `field` is an earthkit GribField (source of geometry + metadata).
        # `values` optionally overrides the field's own values (after arithmetic).
        self._field = field
        self._values = None if values is None else np.asarray(values)
        self._latlon = None
        self._kdtree = None
        self._units = None
        self._name = None

    @classmethod
    def from_path(cls, path: Union[Path, str]) -> "Fieldset":
        ekd = _get_ekd()

        if isinstance(path, Path):
            path = str(path)

        if not os.path.exists(path):
            raise IOError(f"File does not exist: {path}")

        with _ECCODES_LOCK:
            fieldlist = ekd.from_source("file", path)
            if len(fieldlist) == 0:
                raise ValueError(f"No GRIB messages found in: {path}")
            # ecPoint reads one predictor/step per file; operate on first field.
            return cls(fieldlist[0])

    @property
    def units(self) -> str:
        if self._units is None:
            with _ECCODES_LOCK:
                self._units = self._field.metadata("units")
        return self._units

    @property
    def name(self) -> str:
        if self._name is None:
            with _ECCODES_LOCK:
                self._name = self._field.metadata("name")
        return self._name

    @property
    def values(self) -> np.ndarray:
        if self._values is None:
            with _ECCODES_LOCK:
                self._values = np.asarray(self._field.values)
        return self._values

    @values.setter
    def values(self, values):
        raise NotImplementedError

    def _latlons(self):
        if self._latlon is None:
            with _ECCODES_LOCK:
                ll = self._field.to_latlon()
            self._latlon = (
                np.asarray(ll["lat"]).ravel(),
                np.asarray(ll["lon"]).ravel(),
            )
        return self._latlon

    @property
    def dataframe(self):
        import pandas as pd

        lat, lon = self._latlons()
        return pd.DataFrame(
            {
                "latitude": lat,
                "longitude": lon,
                self.name: self.values.ravel(),
            }
        )

    def nearest_gridpoint(self, geopoints):
        """Return a Geopoints of this field sampled at the nearest grid point
        to each observation location."""
        from earthkit.geo.distance import GeoKDTree

        from core.loaders.geopoints import Geopoints

        lat, lon = self._latlons()
        if self._kdtree is None:
            self._kdtree = GeoKDTree(lat, lon)

        obs_lat = geopoints.latitudes()
        obs_lon = geopoints.longitudes()
        idx, _ = self._kdtree.nearest_point((obs_lat, obs_lon))
        idx = np.asarray(idx)

        sampled = self.values.ravel()[idx]
        return Geopoints(obs_lat, obs_lon, sampled)

    # --- reductions across multiple fields ---
    @classmethod
    def vector_of(cls, *args) -> "Fieldset":
        if len(args) == 0:
            raise Exception

        sum_squared_values = sum(abs(term.values) ** 2 for term in args)
        values = np.sqrt(sum_squared_values)
        return cls(args[0]._field, values=values)

    @classmethod
    def max_of(cls, *args) -> "Fieldset":
        if len(args) == 0:
            raise Exception

        values = reduce(np.maximum, (arg.values for arg in args))
        return cls(args[0]._field, values=values)

    @classmethod
    def min_of(cls, *args) -> "Fieldset":
        if len(args) == 0:
            raise Exception

        values = reduce(np.minimum, (arg.values for arg in args))
        return cls(args[0]._field, values=values)

    # --- element-wise arithmetic (returns a new Fieldset, never mutates) ---
    def _operand(self, other):
        return other.values if isinstance(other, Fieldset) else other

    def __add__(self, other) -> "Fieldset":
        return Fieldset(self._field, values=self.values + self._operand(other))

    def __sub__(self, other) -> "Fieldset":
        return Fieldset(self._field, values=self.values - self._operand(other))

    def __mul__(self, other) -> "Fieldset":
        return Fieldset(self._field, values=self.values * self._operand(other))

    def __truediv__(self, other) -> "Fieldset":
        return Fieldset(self._field, values=self.values / self._operand(other))

    def __pow__(self, other) -> "Fieldset":
        return Fieldset(self._field, values=self.values ** self._operand(other))
