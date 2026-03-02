from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Portfolio, AllocationTarget
from ..schemas import TargetItem, TargetOut, RebalanceResult
from ..services.rebalancer import compute_rebalance

router = APIRouter(prefix="/api/portfolios/{portfolio_id}", tags=["targets"])


@router.get("/targets", response_model=list[TargetOut])
def get_targets(portfolio_id: int, db: Session = Depends(get_db)):
    p = db.get(Portfolio, portfolio_id)
    if not p:
        raise HTTPException(404, "Portfolio not found")
    return p.targets


@router.put("/targets", response_model=list[TargetOut])
def set_targets(portfolio_id: int, body: list[TargetItem], db: Session = Depends(get_db)):
    p = db.get(Portfolio, portfolio_id)
    if not p:
        raise HTTPException(404, "Portfolio not found")

    total = sum(t.target_pct for t in body)
    if abs(total - 100.0) > 0.01:
        raise HTTPException(400, f"Targets must sum to 100% (got {total}%)")

    # Replace all targets
    db.query(AllocationTarget).filter_by(portfolio_id=portfolio_id).delete()
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
def rebalance(portfolio_id: int, db: Session = Depends(get_db)):
    p = db.get(Portfolio, portfolio_id)
    if not p:
        raise HTTPException(404, "Portfolio not found")
    return compute_rebalance(p, p.holdings, p.targets)
