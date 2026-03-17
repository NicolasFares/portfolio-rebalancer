from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Portfolio, Account, AllocationTarget
from ..schemas import TargetItem, TargetOut, RebalanceResult
from ..services.rebalancer import compute_rebalance

router = APIRouter(prefix="/api/portfolios/{portfolio_id}", tags=["targets"])


@router.get("/targets", response_model=list[TargetOut])
def get_targets(
    portfolio_id: int,
    dimension: str = Query("asset_type"),
    db: Session = Depends(get_db),
):
    p = db.get(Portfolio, portfolio_id)
    if not p:
        raise HTTPException(404, "Portfolio not found")
    return [t for t in p.targets if t.dimension == dimension]


@router.put("/targets", response_model=list[TargetOut])
def set_targets(portfolio_id: int, body: list[TargetItem], db: Session = Depends(get_db)):
    p = db.get(Portfolio, portfolio_id)
    if not p:
        raise HTTPException(404, "Portfolio not found")

    # Group by dimension and validate each sums to 100%
    by_dim: dict[str, list[TargetItem]] = {}
    for t in body:
        by_dim.setdefault(t.dimension, []).append(t)

    for dim, items in by_dim.items():
        total = sum(t.target_pct for t in items)
        if abs(total - 100.0) > 0.01:
            raise HTTPException(400, f"Targets for dimension '{dim}' must sum to 100% (got {total}%)")

    # Replace targets for the affected dimensions only
    dims_to_replace = set(by_dim.keys())
    existing = db.query(AllocationTarget).filter_by(portfolio_id=portfolio_id).all()
    for t in existing:
        if t.dimension in dims_to_replace:
            db.delete(t)

    new_targets = []
    for t in body:
        target = AllocationTarget(portfolio_id=portfolio_id, **t.model_dump())
        db.add(target)
        new_targets.append(target)
    db.commit()
    for t in new_targets:
        db.refresh(t)
    return new_targets


@router.get("/rebalance", response_model=RebalanceResult)
def rebalance(
    portfolio_id: int,
    dimension: str = Query("asset_type"),
    account_id: int | None = Query(None),
    db: Session = Depends(get_db),
):
    p = (
        db.query(Portfolio)
        .options(joinedload(Portfolio.accounts).joinedload(Account.holdings))
        .options(joinedload(Portfolio.targets))
        .filter(Portfolio.id == portfolio_id)
        .first()
    )
    if not p:
        raise HTTPException(404, "Portfolio not found")

    holdings = p.holdings
    accounts = p.accounts

    # Filter by account if specified
    if account_id is not None:
        holdings = [h for h in holdings if h.account_id == account_id]
        accounts = [a for a in accounts if a.id == account_id]

    dim_targets = [t for t in p.targets if t.dimension == dimension]

    # Compute cash from relevant accounts (converted to base currency)
    def _cash_to_base(account):
        val = account.cash_balance
        currency = account.currency.upper()
        base = p.base_currency.upper()
        if currency == base:
            return val
        rates = {"EUR": p.eur_to_base, "USD": p.usd_to_base, base: 1.0}
        return val * rates.get(currency, 1.0)

    cash_from_accounts = sum(_cash_to_base(a) for a in accounts)

    return compute_rebalance(
        p, holdings, dim_targets,
        dimension=dimension,
        cash_from_accounts=cash_from_accounts,
    )
