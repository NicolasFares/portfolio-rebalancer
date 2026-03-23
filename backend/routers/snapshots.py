"""Portfolio snapshot endpoints."""

from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Portfolio, PortfolioSnapshot, SnapshotAllocation, SnapshotHolding
from ..schemas import (
    SnapshotSummary,
    PortfolioHistoryPoint,
    PortfolioHistoryResponse,
    AllocationHistoryPoint,
    AllocationHistoryResponse,
    HoldingHistoryPoint,
    HoldingHistoryResponse,
)
from ..services.snapshots import create_snapshot

router = APIRouter(prefix="/api/snapshots", tags=["snapshots"])


@router.post("/{portfolio_id}", response_model=SnapshotSummary)
def take_snapshot(portfolio_id: int, db: Session = Depends(get_db)):
    """Manually create a snapshot for today."""
    portfolio = db.get(Portfolio, portfolio_id)
    if not portfolio:
        raise HTTPException(404, "Portfolio not found")

    snapshot = create_snapshot(db, portfolio_id)
    return snapshot


@router.get("/{portfolio_id}", response_model=list[SnapshotSummary])
def list_snapshots(
    portfolio_id: int,
    limit: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
):
    """List recent snapshots for a portfolio."""
    portfolio = db.get(Portfolio, portfolio_id)
    if not portfolio:
        raise HTTPException(404, "Portfolio not found")

    rows = (
        db.query(PortfolioSnapshot)
        .filter_by(portfolio_id=portfolio_id)
        .order_by(PortfolioSnapshot.snapshot_date.desc())
        .limit(limit)
        .all()
    )
    return rows


@router.get("/{portfolio_id}/history", response_model=PortfolioHistoryResponse)
def portfolio_history(
    portfolio_id: int,
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    db: Session = Depends(get_db),
):
    """Portfolio value over time."""
    portfolio = db.get(Portfolio, portfolio_id)
    if not portfolio:
        raise HTTPException(404, "Portfolio not found")

    q = db.query(PortfolioSnapshot).filter_by(portfolio_id=portfolio_id)
    if from_date:
        q = q.filter(PortfolioSnapshot.snapshot_date >= from_date)
    if to_date:
        q = q.filter(PortfolioSnapshot.snapshot_date <= to_date)
    rows = q.order_by(PortfolioSnapshot.snapshot_date.asc()).all()

    return PortfolioHistoryResponse(
        base_currency=portfolio.base_currency,
        data_points=[
            PortfolioHistoryPoint(
                date=s.snapshot_date,
                total_value_base=s.total_value_base,
                cash_value_base=s.cash_value_base,
            )
            for s in rows
        ],
    )


@router.get("/{portfolio_id}/allocations", response_model=AllocationHistoryResponse)
def allocation_history(
    portfolio_id: int,
    dimension: str = Query("asset_type"),
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    db: Session = Depends(get_db),
):
    """Allocation percentages over time for a dimension."""
    portfolio = db.get(Portfolio, portfolio_id)
    if not portfolio:
        raise HTTPException(404, "Portfolio not found")

    q = db.query(PortfolioSnapshot).filter_by(portfolio_id=portfolio_id)
    if from_date:
        q = q.filter(PortfolioSnapshot.snapshot_date >= from_date)
    if to_date:
        q = q.filter(PortfolioSnapshot.snapshot_date <= to_date)
    snapshot_rows = q.order_by(PortfolioSnapshot.snapshot_date.asc()).all()

    snapshot_ids = [s.id for s in snapshot_rows]
    allocations = (
        db.query(SnapshotAllocation)
        .filter(
            SnapshotAllocation.snapshot_id.in_(snapshot_ids),
            SnapshotAllocation.dimension == dimension,
        )
        .all()
    )

    # Group by snapshot_id
    alloc_by_snapshot: dict[int, dict[str, float]] = {}
    all_categories: set[str] = set()
    for a in allocations:
        alloc_by_snapshot.setdefault(a.snapshot_id, {})[a.category] = a.pct
        all_categories.add(a.category)

    categories = sorted(all_categories)
    data_points = []
    for s in snapshot_rows:
        values = alloc_by_snapshot.get(s.id, {})
        data_points.append(AllocationHistoryPoint(
            date=s.snapshot_date,
            values={cat: values.get(cat, 0.0) for cat in categories},
        ))

    return AllocationHistoryResponse(
        dimension=dimension,
        categories=categories,
        data_points=data_points,
    )


@router.get("/{portfolio_id}/holdings/{holding_id}", response_model=HoldingHistoryResponse)
def holding_history(
    portfolio_id: int,
    holding_id: int,
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    db: Session = Depends(get_db),
):
    """Single holding value over time."""
    portfolio = db.get(Portfolio, portfolio_id)
    if not portfolio:
        raise HTTPException(404, "Portfolio not found")

    q = db.query(PortfolioSnapshot).filter_by(portfolio_id=portfolio_id)
    if from_date:
        q = q.filter(PortfolioSnapshot.snapshot_date >= from_date)
    if to_date:
        q = q.filter(PortfolioSnapshot.snapshot_date <= to_date)
    snapshot_rows = q.order_by(PortfolioSnapshot.snapshot_date.asc()).all()

    snapshot_ids = [s.id for s in snapshot_rows]
    holding_snaps = (
        db.query(SnapshotHolding)
        .filter(
            SnapshotHolding.snapshot_id.in_(snapshot_ids),
            SnapshotHolding.holding_id == holding_id,
        )
        .all()
    )

    # Build lookup
    snap_date_map = {s.id: s.snapshot_date for s in snapshot_rows}
    holding_name = ""
    ticker = None
    data_points = []
    for hs in holding_snaps:
        holding_name = hs.name
        ticker = hs.ticker
        data_points.append(HoldingHistoryPoint(
            date=snap_date_map[hs.snapshot_id],
            quantity=hs.quantity,
            price_per_unit=hs.price_per_unit,
            value_base=hs.value_base,
        ))

    data_points.sort(key=lambda p: p.date)

    return HoldingHistoryResponse(
        holding_name=holding_name,
        ticker=ticker,
        data_points=data_points,
    )


@router.delete("/{portfolio_id}/history")
def delete_history(
    portfolio_id: int,
    before: date = Query(...),
    db: Session = Depends(get_db),
):
    """Delete snapshots before a given date for manual cleanup."""
    portfolio = db.get(Portfolio, portfolio_id)
    if not portfolio:
        raise HTTPException(404, "Portfolio not found")

    deleted = (
        db.query(PortfolioSnapshot)
        .filter(
            PortfolioSnapshot.portfolio_id == portfolio_id,
            PortfolioSnapshot.snapshot_date < before,
        )
        .delete()
    )
    db.commit()
    return {"deleted": deleted}
