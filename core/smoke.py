"""Smoke test: verify the GRIB engine (earthkit-data + eccodes) is importable."""
import sys

if sys.version_info.major == 2:
    raise RuntimeError("Python 2 is not supported.")

try:
    import earthkit.data  # noqa: F401
except ImportError as exc:
    raise RuntimeError("earthkit-data package is not installed.") from exc
