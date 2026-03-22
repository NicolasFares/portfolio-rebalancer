"""Questrade integration endpoints: auth setup, status, and holdings sync."""

import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Portfolio, Account, Holding
from ..questrade_auth import exchange_token, get_status, clear_token
from ..services.questrade import get_accounts, get_positions, get_symbols_batch

router = APIRouter(prefix="/api/questrade", tags=["questrade"])


# ── Schemas ──────────────────────────────────────────────

class AuthRequest(BaseModel):
    refresh_token: str


class SyncRequest(BaseModel):
    account_numbers: list[str] | None = None  # None = sync all accounts


class SyncChange(BaseModel):
    ticker: str
    action: str  # "added" | "updated"
    details: str


class SyncResult(BaseModel):
    added: int
    updated: int
    changes: list[SyncChange]


# ── Auth endpoints ───────────────────────────────────────

@router.post("/auth")
def setup_auth(body: AuthRequest):
    """Accept initial refresh token and perform first token exchange."""
    try:
        exchange_token(body.refresh_token)
    except Exception as e:
        raise HTTPException(400, f"Token exchange failed: {e}")
    return {"status": "connected"}


@router.get("/status")
def auth_status():
    """Return Questrade connection status."""
    return get_status()


@router.delete("/auth")
def disconnect():
    """Remove stored Questrade token."""
    clear_token()
    return {"status": "not_configured"}


@router.get("/accounts")
def list_accounts():
    """Fetch available Questrade accounts."""
    try:
        accounts = get_accounts()
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(502, f"Questrade API error: {e}")
    return {"accounts": accounts}


# ── Sync endpoint ────────────────────────────────────────

def _find_or_create_account(
    db: Session, portfolio_id: int, account_number: str, account_type: str
) -> Account:
    """Find an existing Account by account_number or create one."""
    existing = (
        db.query(Account)
        .filter_by(portfolio_id=portfolio_id, account_number=account_number)
        .first()
    )
    if existing:
        return existing

    a = Account(
        portfolio_id=portfolio_id,
        name=account_type,
        institution="Questrade",
        account_type=account_type,
        account_number=account_number,
        currency="CAD",
    )
    db.add(a)
    db.flush()
    return a


@router.post("/sync/{portfolio_id}", response_model=SyncResult)
def sync_holdings(portfolio_id: int, body: SyncRequest, db: Session = Depends(get_db)):
    """Fetch Questrade positions and upsert them as holdings."""
    portfolio = db.get(Portfolio, portfolio_id)
    if not portfolio:
        raise HTTPException(404, "Portfolio not found")

    try:
        accounts = get_accounts()
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(502, f"Questrade API error: {e}")

    # Filter accounts if specified
    if body.account_numbers:
        accounts = [a for a in accounts if a["number"] in body.account_numbers]

    # Find-or-create Account entities for each Questrade account
    account_map: dict[str, Account] = {}
    for acct in accounts:
        account_map[acct["number"]] = _find_or_create_account(
            db, portfolio_id, acct["number"], acct["type"]
        )

    # Gather all positions across selected accounts
    all_positions = []
    for acct in accounts:
        positions = get_positions(acct["number"])
        for pos in positions:
            pos["_account_type"] = acct["type"]  # TFSA, RRSP, etc.
            pos["_account_number"] = acct["number"]
        all_positions.extend(positions)

    # Filter out closed positions
    all_positions = [p for p in all_positions if p.get("openQuantity", 0) > 0]

    if not all_positions:
        db.commit()
        return SyncResult(added=0, updated=0, changes=[])

    # Batch-fetch symbol info for currency data
    symbol_ids = list({p["symbolId"] for p in all_positions if p.get("symbolId")})
    symbols_data = {}
    if symbol_ids:
        try:
            symbols = get_symbols_batch(symbol_ids)
            symbols_data = {s["symbolId"]: s for s in symbols}
        except Exception:
            pass  # Fall back to no currency info

    # Build existing holdings index by ticker (across all accounts in portfolio)
    all_holdings = portfolio.holdings
    existing = {
        h.ticker: h for h in all_holdings if h.ticker
    }

    changes: list[SyncChange] = []
    added = 0
    updated = 0

    for pos in all_positions:
        ticker = pos.get("symbol", "")
        if not ticker:
            continue

        quantity = pos.get("openQuantity", 0)
        price = pos.get("currentPrice", 0)
        account_number = pos.get("_account_number", "")

        # Determine currency from symbol info
        sym_info = symbols_data.get(pos.get("symbolId"))
        currency = sym_info.get("currency", "CAD") if sym_info else "CAD"
        symbol_name = sym_info.get("description", ticker) if sym_info else ticker

        acct_entity = account_map.get(account_number)

        if ticker in existing:
            h = existing[ticker]
            old_qty, old_price = h.quantity, h.price_per_unit
            h.quantity = quantity
            h.price_per_unit = price
            h.currency = currency
            avg_entry = pos.get("averageEntryPrice")
            if avg_entry:
                h.avg_buy_price = avg_entry
            # Set account_id if still unset
            if acct_entity:
                h.account_id = acct_entity.id
            if old_qty != quantity or old_price != price:
                updated += 1
                changes.append(SyncChange(
                    ticker=ticker,
                    action="updated",
                    details=f"qty: {old_qty}\u2192{quantity}, price: {old_price}\u2192{price}",
                ))
        else:
            h = Holding(
                account_id=acct_entity.id if acct_entity else None,
                name=symbol_name,
                ticker=ticker,
                asset_type="equity",
                quantity=quantity,
                price_per_unit=price,
                currency=currency,
                avg_buy_price=pos.get("averageEntryPrice"),
            )
            db.add(h)
            added += 1
            changes.append(SyncChange(
                ticker=ticker,
                action="added",
                details=f"qty: {quantity}, price: {price}, account: {pos.get('_account_type', '')}",
            ))

    db.commit()
    return SyncResult(added=added, updated=updated, changes=changes)
