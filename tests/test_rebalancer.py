"""Unit tests for compute_rebalance() — no database, no HTTP."""

from types import SimpleNamespace

from backend.services.rebalancer import compute_rebalance


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_portfolio(**kwargs):
    defaults = {
        "id": 1,
        "name": "Test",
        "base_currency": "CAD",
        "eur_to_base": 1.50,
        "usd_to_base": 1.44,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def make_holding(**kwargs):
    defaults = {
        "id": 1,
        "account_id": 1,
        "name": "Test Holding",
        "ticker": None,
        "asset_type": "equity",
        "quantity": 100,
        "price_per_unit": 10.0,
        "currency": "CAD",
        "sector": None,
        "geography": None,
        "allocation_breakdown": None,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def make_target(**kwargs):
    defaults = {
        "id": 1,
        "portfolio_id": 1,
        "category": "equity",
        "target_pct": 60.0,
        "dimension": "asset_type",
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def suggestion_by_category(result, category):
    """Return the RebalanceSuggestion for a given category, or None."""
    for s in result.suggestions:
        if s.category == category:
            return s
    return None


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_simple_rebalance():
    """Two holdings, two targets — verify diff_pct and diff_value."""
    portfolio = make_portfolio()
    holdings = [
        make_holding(id=1, name="Equity Fund", asset_type="equity", quantity=100, price_per_unit=10.0),
        make_holding(id=2, name="Bond Fund", asset_type="bond", quantity=50, price_per_unit=20.0),
    ]
    targets = [
        make_target(id=1, category="equity", target_pct=60.0),
        make_target(id=2, category="bond", target_pct=40.0),
    ]

    result = compute_rebalance(portfolio, holdings, targets, dimension="asset_type")

    assert result.total_value == 2000.0
    assert result.base_currency == "CAD"

    equity = suggestion_by_category(result, "equity")
    assert equity is not None
    assert equity.current_value == 1000.0
    assert equity.current_pct == 50.0
    assert equity.target_pct == 60.0
    assert equity.diff_pct == 10.0
    assert equity.diff_value == 200.0

    bond = suggestion_by_category(result, "bond")
    assert bond is not None
    assert bond.current_value == 1000.0
    assert bond.current_pct == 50.0
    assert bond.target_pct == 40.0
    assert bond.diff_pct == -10.0
    assert bond.diff_value == -200.0


def test_rebalance_with_cash():
    """Cash from accounts is included in the 'cash' asset_type category."""
    portfolio = make_portfolio()
    holdings = [
        make_holding(id=1, name="Equity Fund", asset_type="equity", quantity=100, price_per_unit=10.0),
        make_holding(id=2, name="Bond Fund", asset_type="bond", quantity=50, price_per_unit=20.0),
    ]
    targets = [
        make_target(id=1, category="equity", target_pct=60.0),
        make_target(id=2, category="bond", target_pct=40.0),
    ]

    result = compute_rebalance(
        portfolio, holdings, targets, dimension="asset_type", cash_from_accounts=500.0
    )

    assert result.total_value == 2500.0

    cash = suggestion_by_category(result, "cash")
    assert cash is not None
    assert cash.current_value == 500.0
    assert cash.current_pct == 20.0  # 500 / 2500 * 100
    assert cash.target_pct == 0.0    # no cash target defined
    assert cash.diff_pct == -20.0
    assert cash.diff_value == -500.0

    # Equity and bond percentages recalculated against new total
    equity = suggestion_by_category(result, "equity")
    assert equity.current_pct == 40.0  # 1000 / 2500 * 100


def test_rebalance_multi_currency():
    """EUR and USD holdings are converted to CAD base currency."""
    portfolio = make_portfolio(base_currency="CAD", eur_to_base=1.50, usd_to_base=1.40)
    holdings = [
        make_holding(
            id=1, name="Euro Equity", asset_type="equity",
            quantity=100, price_per_unit=10.0, currency="EUR",
        ),
        make_holding(
            id=2, name="USD Bond", asset_type="bond",
            quantity=100, price_per_unit=10.0, currency="USD",
        ),
    ]
    targets = [
        make_target(id=1, category="equity", target_pct=50.0),
        make_target(id=2, category="bond", target_pct=50.0),
    ]

    result = compute_rebalance(portfolio, holdings, targets, dimension="asset_type")

    # 100 * 10 * 1.50 = 1500 CAD  (EUR equity)
    # 100 * 10 * 1.40 = 1400 CAD  (USD bond)
    assert result.total_value == 2900.0

    equity = suggestion_by_category(result, "equity")
    assert equity.current_value == 1500.0
    assert equity.current_pct == round(1500 / 2900 * 100, 2)
    assert equity.diff_pct == round(50.0 - (1500 / 2900 * 100), 2)
    assert equity.diff_value == round((50.0 - (1500 / 2900 * 100)) / 100 * 2900, 2)

    bond = suggestion_by_category(result, "bond")
    assert bond.current_value == 1400.0
    assert bond.current_pct == round(1400 / 2900 * 100, 2)
    assert bond.diff_pct == round(50.0 - (1400 / 2900 * 100), 2)
    assert bond.diff_value == round((50.0 - (1400 / 2900 * 100)) / 100 * 2900, 2)


def test_rebalance_managed_holding():
    """A managed holding with allocation_breakdown splits across asset types."""
    portfolio = make_portfolio()
    holdings = [
        make_holding(
            id=1, name="Balanced Fund", asset_type="managed",
            quantity=100, price_per_unit=10.0,
            allocation_breakdown='{"equity": 60, "bond": 40}',
        ),
    ]
    targets = [
        make_target(id=1, category="equity", target_pct=50.0),
        make_target(id=2, category="bond", target_pct=50.0),
    ]

    result = compute_rebalance(portfolio, holdings, targets, dimension="asset_type")

    assert result.total_value == 1000.0

    equity = suggestion_by_category(result, "equity")
    assert equity is not None
    assert equity.current_value == 600.0
    assert equity.current_pct == 60.0

    bond = suggestion_by_category(result, "bond")
    assert bond is not None
    assert bond.current_value == 400.0
    assert bond.current_pct == 40.0


def test_rebalance_empty_portfolio():
    """No holdings → total_value=0; diffs equal target_pct, diff_value=0."""
    portfolio = make_portfolio()
    targets = [
        make_target(id=1, category="equity", target_pct=60.0),
        make_target(id=2, category="bond", target_pct=40.0),
    ]

    result = compute_rebalance(portfolio, [], targets, dimension="asset_type")

    assert result.total_value == 0.0

    equity = suggestion_by_category(result, "equity")
    assert equity is not None
    assert equity.current_value == 0.0
    assert equity.current_pct == 0.0
    assert equity.diff_pct == 60.0
    assert equity.diff_value == 0.0

    bond = suggestion_by_category(result, "bond")
    assert bond is not None
    assert bond.current_value == 0.0
    assert bond.current_pct == 0.0
    assert bond.diff_pct == 40.0
    assert bond.diff_value == 0.0


def test_rebalance_sector_dimension():
    """Holdings are grouped by sector when dimension='sector'."""
    portfolio = make_portfolio()
    holdings = [
        make_holding(
            id=1, name="Tech ETF", asset_type="equity",
            quantity=100, price_per_unit=10.0, sector="technology",
        ),
        make_holding(
            id=2, name="Energy ETF", asset_type="equity",
            quantity=50, price_per_unit=20.0, sector="energy",
        ),
    ]
    targets = [
        make_target(id=1, category="technology", target_pct=70.0, dimension="sector"),
        make_target(id=2, category="energy", target_pct=30.0, dimension="sector"),
    ]

    result = compute_rebalance(portfolio, holdings, targets, dimension="sector")

    assert result.total_value == 2000.0

    tech = suggestion_by_category(result, "technology")
    assert tech is not None
    assert tech.current_value == 1000.0
    assert tech.current_pct == 50.0
    assert tech.target_pct == 70.0
    assert tech.diff_pct == 20.0

    energy = suggestion_by_category(result, "energy")
    assert energy is not None
    assert energy.current_value == 1000.0
    assert energy.current_pct == 50.0
    assert energy.target_pct == 30.0
    assert energy.diff_pct == -20.0


def test_rebalance_geography_dimension():
    """Holdings are grouped by geography; None maps to 'unclassified'."""
    portfolio = make_portfolio()
    holdings = [
        make_holding(
            id=1, name="US Equity", asset_type="equity",
            quantity=100, price_per_unit=10.0, geography="US",
        ),
        make_holding(
            id=2, name="Unknown Fund", asset_type="equity",
            quantity=50, price_per_unit=20.0, geography=None,
        ),
    ]
    targets = [
        make_target(id=1, category="US", target_pct=60.0, dimension="geography"),
        make_target(id=2, category="unclassified", target_pct=40.0, dimension="geography"),
    ]

    result = compute_rebalance(portfolio, holdings, targets, dimension="geography")

    assert result.total_value == 2000.0

    us = suggestion_by_category(result, "US")
    assert us is not None
    assert us.current_value == 1000.0
    assert us.current_pct == 50.0
    assert us.target_pct == 60.0
    assert us.diff_pct == 10.0

    unclassified = suggestion_by_category(result, "unclassified")
    assert unclassified is not None
    assert unclassified.current_value == 1000.0
    assert unclassified.current_pct == 50.0
    assert unclassified.target_pct == 40.0
    assert unclassified.diff_pct == -10.0
