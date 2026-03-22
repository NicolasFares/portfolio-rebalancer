"""Price and exchange rate synchronization endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Portfolio, Holding
from ..schemas import (
    PriceSyncRequest,
    PriceSyncDetail,
    PriceSyncResult,
    ExchangeRateSyncResult,
)
from ..services.price_sync import fetch_prices
from ..services.exchange_rates import fetch_ecb_rates, compute_rates_for_base
from ..services.snapshots import create_snapshot

router = APIRouter(prefix="/api/sync", tags=["sync"])


@router.post("/{portfolio_id}/prices", response_model=PriceSyncResult)
def sync_prices(
    portfolio_id: int,
    body: PriceSyncRequest | None = None,
    db: Session = Depends(get_db),
):
    """Fetch latest prices from yfinance and update holdings."""
    portfolio = db.get(Portfolio, portfolio_id)
    if not portfolio:
        raise HTTPException(404, "Portfolio not found")

    # Get holdings to sync
    all_holdings = portfolio.holdings
    if body and body.holding_ids:
        all_holdings = [h for h in all_holdings if h.id in body.holding_ids]

    # Filter to publicly-traded holdings (have a ticker, not managed/private)
    syncable = [
        h for h in all_holdings
        if h.ticker and h.asset_type not in ("managed", "cash")
    ]
    skipped = len(all_holdings) - len(syncable)
    if not syncable:
        errors = []
        if skipped > 0:
            errors.append(f"Skipped {skipped} holding(s) without tickers or with managed/cash type")
        return PriceSyncResult(updated=0, failed=0, details=[], errors=errors)

    # Build input for price service
    holding_dicts = [
        {
            "id": h.id,
            "ticker": h.ticker,
            "exchange": h.exchange,
            "asset_type": h.asset_type,
        }
        for h in syncable
    ]

    try:
        price_data = fetch_prices(holding_dicts)
    except Exception as e:
        raise HTTPException(502, f"Price fetch failed: {e}")

    details: list[PriceSyncDetail] = []
    errors: list[str] = []
    updated = 0

    for h in syncable:
        if h.id in price_data:
            data = price_data[h.id]
            old_price = h.price_per_unit
            h.price_per_unit = data["price"]
            h.currency = data["currency"]
            updated += 1
            details.append(
                PriceSyncDetail(
                    holding_id=h.id,
                    ticker=h.ticker,
                    old_price=old_price,
                    new_price=data["price"],
                    currency=data["currency"],
                    price_date=data.get("price_date"),
                )
            )
        else:
            yf_name = h.ticker
            if h.exchange:
                yf_name = f"{h.ticker} ({h.exchange})"
            errors.append(f"Failed to fetch price for {yf_name}")

    db.commit()

    # Auto-create snapshot after successful price sync
    try:
        create_snapshot(db, portfolio_id)
    except Exception:
        pass  # Snapshot failure shouldn't break price sync

    failed = len(syncable) - updated
    return PriceSyncResult(
        updated=updated, failed=failed, details=details, errors=errors
    )


@router.post("/{portfolio_id}/exchange-rates", response_model=ExchangeRateSyncResult)
def sync_exchange_rates(
    portfolio_id: int,
    db: Session = Depends(get_db),
):
    """Fetch latest exchange rates from ECB and update portfolio."""
    portfolio = db.get(Portfolio, portfolio_id)
    if not portfolio:
        raise HTTPException(404, "Portfolio not found")

    try:
        ecb_rates, date = fetch_ecb_rates()
        computed = compute_rates_for_base(ecb_rates, portfolio.base_currency)
    except Exception as e:
        raise HTTPException(502, f"Exchange rate fetch failed: {e}")

    portfolio.eur_to_base = computed["eur_to_base"]
    portfolio.usd_to_base = computed["usd_to_base"]
    db.commit()

    return ExchangeRateSyncResult(
        eur_to_base=computed["eur_to_base"],
        usd_to_base=computed["usd_to_base"],
        source="ECB",
        date=date,
    )
