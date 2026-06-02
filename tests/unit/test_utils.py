from datetime import date

from core.utils import (
    format_date,
    int_or_float,
    sanitize_path,
    tolist,
    wrap_title,
)

inf = float("inf")


def test_tolist_wraps_a_generator():
    @tolist
    def doubles(n):
        for i in range(n):
            yield i * 2

    assert doubles(3) == [0, 2, 4]


def test_int_or_float_collapses_whole_floats_but_keeps_infinities():
    result = int_or_float(3.0)
    assert result == 3 and isinstance(result, int)
    assert int_or_float(3.5) == 3.5
    assert int_or_float(inf) == inf
    assert int_or_float(-inf) == -inf


def test_sanitize_path_is_a_no_op_without_host_bindings(monkeypatch):
    monkeypatch.delenv("HOST_BINDINGS", raising=False)
    assert sanitize_path("/data/forecasts") == "/data/forecasts"


def test_sanitize_path_rewrites_each_host_binding(monkeypatch):
    monkeypatch.setenv("HOST_BINDINGS", "/host/a:/local/a,/host/b:/local/b")
    assert sanitize_path("/host/a/file.grib") == "/local/a/file.grib"
    assert sanitize_path("/host/b/file.grib") == "/local/b/file.grib"


def test_format_date_parses_iso_timestamp_to_date():
    assert format_date("2015-06-01T22:00:00.000Z") == date(2015, 6, 1)


def test_wrap_title_chunks_and_joins_with_newlines():
    assert wrap_title(["a", "b", "c", "d", "e"], 2) == "a b\nc d\ne"
    assert wrap_title([], 3) == ""
