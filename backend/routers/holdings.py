import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Portfolio, Account, Holding
from ..schemas import HoldingCreate, HoldingUpdate, HoldingOut

router = APIRouter(tags=["holdings"])


def _serialize_breakdown(data: dict) -> dict:
    """JSON-serialize allocation_breakdown dict for DB storage."""
    ab = data.get("allocation_breakdown")
    if ab is not None:
        data["allocation_breakdown"] = json.dumps(ab)
    return data


def _holding_out(h: Holding) -> dict:
    """Build HoldingOut dict with account_name populated."""
    data = {
        "id": h.id,
        "account_id": h.account_id,
        "account_name": h.account_rel.name if h.account_rel else "",
        "name": h.name,
        "ticker": h.ticker,
        "asset_type": h.asset_type,
        "quantity": h.quantity,
        "price_per_unit": h.price_per_unit,
        "currency": h.currency,
        "sector": h.sector,
        "geography": h.geography,
        "avg_buy_price": h.avg_buy_price,
        "allocation_breakdown": h.allocation_breakdown,
        "created_at": h.created_at,
        "updated_at": h.updated_at,
    }
    return data


@router.post("/api/portfolios/{portfolio_id}/holdings", response_model=HoldingOut, status_code=201)
def add_holding(portfolio_id: int, body: HoldingCreate, db: Session = Depends(get_db)):
    p = db.get(Portfolio, portfolio_id)
    if not p:
        raise HTTPException(404, "Portfolio not found")

    # Validate account belongs to this portfolio
    account = db.get(Account, body.account_id)
    if not account or account.portfolio_id != portfolio_id:
        raise HTTPException(400, "Account does not belong to this portfolio")

    data = _serialize_breakdown(body.model_dump())
    h = Holding(**data)
    db.add(h)
    db.commit()
    db.refresh(h)
    return _holding_out(h)


@router.put("/api/holdings/{holding_id}", response_model=HoldingOut)
def update_holding(holding_id: int, body: HoldingUpdate, db: Session = Depends(get_db)):
    h = db.get(Holding, holding_id)
    if not h:
        raise HTTPException(404, "Holding not found")
    for k, v in _serialize_breakdown(body.model_dump(exclude_unset=True)).items():
        setattr(h, k, v)
    db.commit()
    db.refresh(h)
    return _holding_out(h)


@router.delete("/api/holdings/{holding_id}", status_code=204)
def delete_holding(holding_id: int, db: Session = Depends(get_db)):
    h = db.get(Holding, holding_id)
    if not h:
        raise HTTPException(404, "Holding not found")
    db.delete(h)
    db.commit()
