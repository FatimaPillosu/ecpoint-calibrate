from core.loaders import ErrorType, load_point_data_by_path
from core.postprocessors.decision_tree import WeatherType


def get_pdt_statistics(path: str) -> dict:
    loader = load_point_data_by_path(path)

    fields = loader.predictors
    all_cols = fields + [loader.error_type.name]

    # Read all needed columns in a single pass instead of re-reading the file per column
    df_all = loader.select(*all_cols, series=False)

    def get_field_summary(name: str) -> dict:
        col = df_all[name]
        return dict(
            name=name,
            min=f"{col.min():.2f}",
            max=f"{col.max():.2f}",
            mean=f"{col.mean():.2f}",
            median=f"{col.median():.2f}",
            count=f"{int(col.count())}",
        )

    summary = [get_field_summary(field) for field in all_cols]

    error_count = next(
        each["count"] for each in summary if each["name"] == loader.error_type.name
    )

    return dict(
        fields=fields,
        summary=summary,
        units=loader.units,
        count=error_count,
        error=loader.error_type.name,
        bins=WeatherType.DEFAULT_FER_BINS if loader.error_type == ErrorType.FER else [],
    )
