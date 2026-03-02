import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Portfolio, Holding
from ..schemas import HoldingCreate, HoldingUpdate, HoldingOut

router = APIRouter(tags=["holdings"])


def _serialize_breakdown(data: dict) -> dict:
    """JSON-serialize allocation_breakdown dict for DB storage."""
    ab = data.get("allocation_breakdown")
    if ab is not None:
        data["allocation_breakdown"] = json.dumps(ab)
    return data


@router.post("/api/portfolios/{portfolio_id}/holdings", response_model=HoldingOut, status_code=201)
def add_holding(portfolio_id: int, body: HoldingCreate, db: Session = Depends(get_db)):
    p = db.get(Portfolio, portfolio_id)
    if not p:
        raise HTTPException(404, "Portfolio not found")
    h = Holding(portfolio_id=portfolio_id, **_serialize_breakdown(body.model_dump()))
    db.add(h)
    db.commit()
    db.refresh(h)
    return h


@router.put("/api/holdings/{holding_id}", response_model=HoldingOut)
def update_holding(holding_id: int, body: HoldingUpdate, db: Session = Depends(get_db)):
    h = db.get(Holding, holding_id)
    if not h:
        raise HTTPException(404, "Holding not found")
    for k, v in _serialize_breakdown(body.model_dump(exclude_unset=True)).items():
        setattr(h, k, v)
    db.commit()
    db.refresh(h)
    return h


@router.delete("/api/holdings/{holding_id}", status_code=204)
def delete_holding(holding_id: int, db: Session = Depends(get_db)):
    h = db.get(Holding, holding_id)
    if not h:
        raise HTTPException(404, "Holding not found")
    db.delete(h)
    db.commit()
