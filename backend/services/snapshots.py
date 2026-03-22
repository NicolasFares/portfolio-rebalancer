"""Snapshot service: captures daily portfolio state."""

from __future__ import annotations

import json
from datetime import date, timezone, datetime

from sqlalchemy.orm import Session

from ..models import (
    Portfolio,
    PortfolioSnapshot,
    SnapshotAllocation,
    SnapshotHolding,
)
from .rebalancer import _to_base


def create_snapshot(db: Session, portfolio_id: int) -> PortfolioSnapshot:
    """Create or update today's snapshot for a portfolio.

    Computes total value, cash value, allocation breakdowns (by asset_type,
    sector, geography), and per-holding snapshots. If a snapshot already
    exists for today, it is replaced (upsert).
    """
    portfolio = db.get(Portfolio, portfolio_id)
    if portfolio is None:
        raise ValueError(f"Portfolio {portfolio_id} not found")

    today = datetime.now(timezone.utc).date()

    # Upsert: delete existing snapshot for today if present
    existing = (
        db.query(PortfolioSnapshot)
        .filter_by(portfolio_id=portfolio_id, snapshot_date=today)
        .first()
    )
    if existing:
        db.delete(existing)
        db.flush()

    # Compute values
    holdings = portfolio.holdings
    holdings_value = sum(_to_base(h, portfolio) for h in holdings)

    cash_value_base = 0.0
    for acct in portfolio.accounts:
        cash = acct.cash_balance
        cur = acct.currency.upper()
        base = portfolio.base_currency.upper()
        if cur == base:
            cash_value_base += cash
        elif cur == "EUR":
            cash_value_base += cash * portfolio.eur_to_base
        elif cur == "USD":
            cash_value_base += cash * portfolio.usd_to_base
        else:
            cash_value_base += cash

    total_value = holdings_value + cash_value_base

    snapshot = PortfolioSnapshot(
        portfolio_id=portfolio_id,
        snapshot_date=today,
        total_value_base=round(total_value, 2),
        cash_value_base=round(cash_value_base, 2),
        eur_to_base=portfolio.eur_to_base,
        usd_to_base=portfolio.usd_to_base,
    )
    db.add(snapshot)
    db.flush()  # get snapshot.id

    # Allocation breakdowns for all 3 dimensions
    for dim in ("asset_type", "sector", "geography"):
        by_cat: dict[str, float] = {}
        for h in holdings:
            val = _to_base(h, portfolio)
            if dim == "asset_type":
                if h.allocation_breakdown:
                    breakdown = (
                        json.loads(h.allocation_breakdown)
                        if isinstance(h.allocation_breakdown, str)
                        else h.allocation_breakdown
                    )
                    for cat, pct in breakdown.items():
                        by_cat[cat] = by_cat.get(cat, 0.0) + val * (pct / 100)
                else:
                    by_cat[h.asset_type] = by_cat.get(h.asset_type, 0.0) + val
            elif dim == "sector":
                key = h.sector or "unclassified"
                by_cat[key] = by_cat.get(key, 0.0) + val
            elif dim == "geography":
                key = h.geography or "unclassified"
                by_cat[key] = by_cat.get(key, 0.0) + val

        # Add account cash for asset_type dimension
        if dim == "asset_type" and cash_value_base > 0:
            by_cat["cash"] = by_cat.get("cash", 0.0) + cash_value_base

        dim_total = sum(by_cat.values())
        for cat, val in by_cat.items():
            pct = (val / dim_total * 100) if dim_total > 0 else 0.0
            db.add(SnapshotAllocation(
                snapshot_id=snapshot.id,
                dimension=dim,
                category=cat,
                value_base=round(val, 2),
                pct=round(pct, 2),
            ))

    # Per-holding snapshots
    for h in holdings:
        val = _to_base(h, portfolio)
        db.add(SnapshotHolding(
            snapshot_id=snapshot.id,
            holding_id=h.id,
            account_id=h.account_id,
            name=h.name,
            ticker=h.ticker,
            asset_type=h.asset_type,
            quantity=h.quantity,
            price_per_unit=h.price_per_unit,
            currency=h.currency,
            value_base=round(val, 2),
        ))

    # Cash entries as snapshot holdings
    for acct in portfolio.accounts:
        if acct.cash_balance > 0:
            cur = acct.currency.upper()
            base = portfolio.base_currency.upper()
            if cur == base:
                cash_base = acct.cash_balance
            elif cur == "EUR":
                cash_base = acct.cash_balance * portfolio.eur_to_base
            elif cur == "USD":
                cash_base = acct.cash_balance * portfolio.usd_to_base
            else:
                cash_base = acct.cash_balance

            db.add(SnapshotHolding(
                snapshot_id=snapshot.id,
                holding_id=None,
                account_id=acct.id,
                name=f"Cash ({acct.name})",
                ticker=None,
                asset_type="cash",
                quantity=acct.cash_balance,
                price_per_unit=1.0,
                currency=acct.currency,
                value_base=round(cash_base, 2),
            ))

    db.commit()
    return snapshot
