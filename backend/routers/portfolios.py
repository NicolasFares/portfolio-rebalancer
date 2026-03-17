from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Portfolio, Account
from ..schemas import PortfolioCreate, PortfolioUpdate, PortfolioOut, PortfolioDetail, HoldingOut, AccountOut

router = APIRouter(prefix="/api/portfolios", tags=["portfolios"])


@router.get("", response_model=list[PortfolioOut])
def list_portfolios(db: Session = Depends(get_db)):
    return db.query(Portfolio).order_by(Portfolio.id).all()


@router.post("", response_model=PortfolioOut, status_code=201)
def create_portfolio(body: PortfolioCreate, db: Session = Depends(get_db)):
    p = Portfolio(**body.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.get("/{portfolio_id}", response_model=PortfolioDetail)
def get_portfolio(portfolio_id: int, db: Session = Depends(get_db)):
    p = (
        db.query(Portfolio)
        .options(joinedload(Portfolio.accounts).joinedload(Account.holdings))
        .options(joinedload(Portfolio.targets))
        .filter(Portfolio.id == portfolio_id)
        .first()
    )
    if not p:
        raise HTTPException(404, "Portfolio not found")

    # Build holdings list with account_name populated
    holdings_out = []
    for account in p.accounts:
        for h in account.holdings:
            holdings_out.append(HoldingOut(
                id=h.id,
                account_id=h.account_id,
                account_name=account.name,
                name=h.name,
                ticker=h.ticker,
                asset_type=h.asset_type,
                quantity=h.quantity,
                price_per_unit=h.price_per_unit,
                currency=h.currency,
                sector=h.sector,
                geography=h.geography,
                allocation_breakdown=h.allocation_breakdown,
                created_at=h.created_at,
                updated_at=h.updated_at,
            ))

    accounts_out = [AccountOut.model_validate(a) for a in p.accounts]

    return PortfolioDetail(
        id=p.id,
        name=p.name,
        base_currency=p.base_currency,
        eur_to_base=p.eur_to_base,
        usd_to_base=p.usd_to_base,
        created_at=p.created_at,
        updated_at=p.updated_at,
        holdings=holdings_out,
        targets=p.targets,
        accounts=accounts_out,
    )


@router.put("/{portfolio_id}", response_model=PortfolioOut)
def update_portfolio(portfolio_id: int, body: PortfolioUpdate, db: Session = Depends(get_db)):
    p = db.get(Portfolio, portfolio_id)
    if not p:
        raise HTTPException(404, "Portfolio not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{portfolio_id}", status_code=204)
def delete_portfolio(portfolio_id: int, db: Session = Depends(get_db)):
    p = db.get(Portfolio, portfolio_id)
    if not p:
        raise HTTPException(404, "Portfolio not found")
    db.delete(p)
    db.commit()
