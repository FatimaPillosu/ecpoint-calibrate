import re
from pathlib import Path

import numpy


def _get_metview():
    import metview
    return metview


def read(path: Path):
    if not path.exists():
        raise IOError(f"File does not exist: {path}")

    return _get_metview().read(str(path))


def get_values(geopoints) -> numpy.ndarray:
    if "value_0" in geopoints.columns():
        return geopoints["value_0"]

    return geopoints.values()


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
