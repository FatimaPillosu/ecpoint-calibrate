"""Geopoints loader.

Replaces the previous Metview-backed reader. A ``.geo`` file is parsed into a
lightweight numpy-backed :class:`Geopoints` value object that exposes only the
surface the rest of the codebase relies on (length/truthiness, latitudes,
longitudes, values, boolean masking, filtering and element-wise arithmetic
against another Geopoints of equal length).

Two on-disk variants are supported, matching the original Metview behaviour:

* **Traditional** ``#GEO`` format with positional columns
  ``lat lon height date time value`` (whitespace separated). The value is the
  last column.
* **NCOLS** format declared via ``#FORMAT NCOLS`` / ``#COLUMNS`` with a named
  column header. Latitude/longitude/value are looked up by name
  (``latitude``/``longitude``/``value_0``).

Missing values (sentinel ``3e+38``) are read verbatim as floats; this layer
does not mask them, which mirrors the previous behaviour at the read boundary.
"""

import re
from pathlib import Path
from typing import List, Union

import numpy as np


class Geopoints:
    """Numpy-backed container for georeferenced point values."""

    __slots__ = ("lats", "lons", "vals")

    def __init__(self, lats, lons, values):
        self.lats = np.asarray(lats, dtype=float)
        self.lons = np.asarray(lons, dtype=float)
        self.vals = np.asarray(values, dtype=float)

    def __len__(self) -> int:
        return int(self.vals.size)

    def __bool__(self) -> bool:
        return self.vals.size > 0

    def latitudes(self) -> np.ndarray:
        return self.lats

    def longitudes(self) -> np.ndarray:
        return self.lons

    @property
    def values(self) -> np.ndarray:
        return self.vals

    def columns(self) -> List[str]:
        # Retained for backwards compatibility with get_values().
        return ["value_0"]

    def __getitem__(self, key):
        if key == "value_0":
            return self.vals
        raise KeyError(key)

    def filter(self, mask) -> "Geopoints":
        mask = np.asarray(mask, dtype=bool)
        return Geopoints(self.lats[mask], self.lons[mask], self.vals[mask])

    # --- boolean masks against a scalar threshold ---
    def __ge__(self, other):
        return self.vals >= other

    def __le__(self, other):
        return self.vals <= other

    def __gt__(self, other):
        return self.vals > other

    def __lt__(self, other):
        return self.vals < other

    # --- element-wise arithmetic with another Geopoints (or scalar) ---
    def _operand(self, other):
        return other.vals if isinstance(other, Geopoints) else other

    def __sub__(self, other) -> "Geopoints":
        return Geopoints(self.lats, self.lons, self.vals - self._operand(other))

    def __add__(self, other) -> "Geopoints":
        return Geopoints(self.lats, self.lons, self.vals + self._operand(other))

    def __mul__(self, other) -> "Geopoints":
        return Geopoints(self.lats, self.lons, self.vals * self._operand(other))

    def __truediv__(self, other) -> "Geopoints":
        return Geopoints(self.lats, self.lons, self.vals / self._operand(other))


def _split_data_row(line: str) -> List[str]:
    # Rows are whitespace-separated in both formats (tabs in NCOLS, spaces in
    # the traditional format); split on any run of whitespace.
    return line.split()


def _parse_ncols(lines: List[str]) -> Geopoints:
    # Column header is the first non-empty line after "#COLUMNS".
    col_idx = next(i for i, ln in enumerate(lines) if ln.strip() == "#COLUMNS")
    header = None
    for ln in lines[col_idx + 1:]:
        if ln.strip():
            header = ln.split()
            break
    if header is None:
        raise ValueError("NCOLS geo file has no column header after #COLUMNS")

    def find(*names):
        for name in names:
            if name in header:
                return header.index(name)
        raise ValueError(f"geo file column header missing any of {names}: {header}")

    lat_i = find("latitude", "lat")
    lon_i = find("longitude", "lon")
    val_i = find("value_0", "value")

    data_idx = next(i for i, ln in enumerate(lines) if ln.strip() == "#DATA")
    lats, lons, vals = [], [], []
    for ln in lines[data_idx + 1:]:
        s = ln.strip()
        if not s or s.startswith("#"):
            continue
        cols = _split_data_row(ln)
        lats.append(float(cols[lat_i]))
        lons.append(float(cols[lon_i]))
        vals.append(float(cols[val_i]))

    return Geopoints(lats, lons, vals)


def _parse_traditional(lines: List[str]) -> Geopoints:
    # Positional columns: lat lon height date time value (value is last).
    data_idx = next(i for i, ln in enumerate(lines) if ln.strip() == "#DATA")
    lats, lons, vals = [], [], []
    for ln in lines[data_idx + 1:]:
        s = ln.strip()
        if not s or s.startswith("#"):
            continue
        cols = _split_data_row(ln)
        lats.append(float(cols[0]))
        lons.append(float(cols[1]))
        vals.append(float(cols[-1]))

    return Geopoints(lats, lons, vals)


def read(path: Union[Path, str]) -> Geopoints:
    path = Path(path)
    if not path.exists():
        raise IOError(f"File does not exist: {path}")

    with open(path) as f:
        lines = f.read().splitlines()

    is_ncols = any(ln.strip() == "#COLUMNS" for ln in lines)
    return _parse_ncols(lines) if is_ncols else _parse_traditional(lines)


def get_values(geopoints) -> np.ndarray:
    if "value_0" in geopoints.columns():
        return geopoints["value_0"]

    return geopoints.values


def read_units(path: Path) -> str:
    with open(path) as f:
        while line := f.readline():
            if line.strip() == "#METADATA":
                break

            if line.strip() == "#DATA":
                raise ValueError("units not found")

        while line := f.readline():
            if m := re.match(r"units=(.+)", line):
                return m.group(1)

            if line.strip() == "#DATA":
                break

    raise ValueError("units not found")
