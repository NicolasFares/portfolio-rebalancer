from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Portfolio, Account
from ..schemas import AccountCreate, AccountUpdate, AccountOut, AccountWithStats

router = APIRouter(tags=["accounts"])


def _to_base_value(value: float, currency: str, portfolio: Portfolio) -> float:
    """Convert a value to the portfolio's base currency."""
    currency = currency.upper()
    base = portfolio.base_currency.upper()
    if currency == base:
        return value
    rates = {"EUR": portfolio.eur_to_base, "USD": portfolio.usd_to_base, base: 1.0}
    if currency in rates:
        return value * rates[currency]
    return value


def _account_with_stats(account: Account, portfolio: Portfolio) -> dict:
    """Compute stats for an account."""
    holding_count = len(account.holdings)
    holdings_value = sum(h.quantity * h.price_per_unit for h in account.holdings)
    total_value = holdings_value + account.cash_balance

    holdings_value_base = sum(
        _to_base_value(h.quantity * h.price_per_unit, h.currency, portfolio)
        for h in account.holdings
    )
    cash_base = _to_base_value(account.cash_balance, account.currency, portfolio)
    total_value_base = holdings_value_base + cash_base

    return {
        **AccountOut.model_validate(account).model_dump(),
        "holding_count": holding_count,
        "total_value": round(total_value, 2),
        "total_value_base": round(total_value_base, 2),
    }


@router.get("/api/portfolios/{portfolio_id}/accounts", response_model=list[AccountWithStats])
def list_accounts(portfolio_id: int, db: Session = Depends(get_db)):
    p = db.get(Portfolio, portfolio_id)
    if not p:
        raise HTTPException(404, "Portfolio not found")
    return [_account_with_stats(a, p) for a in p.accounts]


@router.post("/api/portfolios/{portfolio_id}/accounts", response_model=AccountOut, status_code=201)
def create_account(portfolio_id: int, body: AccountCreate, db: Session = Depends(get_db)):
    p = db.get(Portfolio, portfolio_id)
    if not p:
        raise HTTPException(404, "Portfolio not found")
    a = Account(portfolio_id=portfolio_id, **body.model_dump())
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


@router.put("/api/accounts/{account_id}", response_model=AccountOut)
def update_account(account_id: int, body: AccountUpdate, db: Session = Depends(get_db)):
    a = db.get(Account, account_id)
    if not a:
        raise HTTPException(404, "Account not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(a, k, v)
    db.commit()
    db.refresh(a)
    return a


@router.delete("/api/accounts/{account_id}", status_code=204)
def delete_account(account_id: int, db: Session = Depends(get_db)):
    a = db.get(Account, account_id)
    if not a:
        raise HTTPException(404, "Account not found")
    db.delete(a)
    db.commit()
