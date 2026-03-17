import json

from ..models import Holding, AllocationTarget, Portfolio
from ..schemas import RebalanceSuggestion, RebalanceResult


def _to_base(holding: Holding, portfolio: Portfolio) -> float:
    """Convert a holding's total value to the portfolio's base currency."""
    value = holding.quantity * holding.price_per_unit
    currency = holding.currency.upper()
    base = portfolio.base_currency.upper()

    if currency == base:
        return value

    rates = {
        "EUR": portfolio.eur_to_base,
        "USD": portfolio.usd_to_base,
        base: 1.0,
    }

    if currency in rates:
        return value * rates[currency]

    # Unknown currency — return as-is with a warning (best effort)
    return value


def compute_rebalance(
    portfolio: Portfolio,
    holdings: list[Holding],
    targets: list[AllocationTarget],
    dimension: str = "asset_type",
    cash_from_accounts: float = 0.0,
) -> RebalanceResult:
    # Sum values by the selected dimension in base currency
    by_category: dict[str, float] = {}
    for h in holdings:
        val = _to_base(h, portfolio)
        if dimension == "asset_type":
            if h.allocation_breakdown:
                breakdown = json.loads(h.allocation_breakdown) if isinstance(h.allocation_breakdown, str) else h.allocation_breakdown
                for cat, pct in breakdown.items():
                    by_category[cat] = by_category.get(cat, 0.0) + val * (pct / 100)
            else:
                by_category[h.asset_type] = by_category.get(h.asset_type, 0.0) + val
        elif dimension == "sector":
            key = h.sector or "unclassified"
            by_category[key] = by_category.get(key, 0.0) + val
        elif dimension == "geography":
            key = h.geography or "unclassified"
            by_category[key] = by_category.get(key, 0.0) + val

    # Add account cash to "cash" category for asset_type dimension
    if dimension == "asset_type" and cash_from_accounts > 0:
        by_category["cash"] = by_category.get("cash", 0.0) + cash_from_accounts

    total = sum(by_category.values())

    target_map = {t.category: t.target_pct for t in targets}

    # Collect all categories from both holdings and targets
    all_categories = set(by_category.keys()) | set(target_map.keys())

    suggestions: list[RebalanceSuggestion] = []
    for cat in sorted(all_categories):
        current_value = by_category.get(cat, 0.0)
        current_pct = (current_value / total * 100) if total > 0 else 0.0
        target_pct = target_map.get(cat, 0.0)
        diff_pct = target_pct - current_pct
        diff_value = (diff_pct / 100) * total if total > 0 else 0.0

        suggestions.append(
            RebalanceSuggestion(
                category=cat,
                current_value=round(current_value, 2),
                current_pct=round(current_pct, 2),
                target_pct=round(target_pct, 2),
                diff_pct=round(diff_pct, 2),
                diff_value=round(diff_value, 2),
            )
        )

    return RebalanceResult(
        total_value=round(total, 2),
        base_currency=portfolio.base_currency,
        suggestions=suggestions,
    )
