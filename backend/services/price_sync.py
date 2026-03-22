"""Price synchronization service using yfinance."""

from __future__ import annotations

from enum import StrEnum

import yfinance as yf


class Exchange(StrEnum):
    """Known stock exchanges with yfinance ticker suffix mappings."""
    TSX = "TSX"
    TSXV = "TSXV"
    NYSE = "NYSE"
    NASDAQ = "NASDAQ"
    AMEX = "AMEX"
    NYSEARCA = "NYSEARCA"
    LSE = "LSE"
    FRA = "FRA"
    PAR = "PAR"
    AMS = "AMS"
    BRU = "BRU"
    MIL = "MIL"
    MAD = "MAD"
    ASX = "ASX"
    HKEX = "HKEX"
    TYO = "TYO"
    SGX = "SGX"
    KRX = "KRX"
    NSE = "NSE"
    BSE = "BSE"


VALID_EXCHANGES: set[str] = {e.value for e in Exchange}


# Maps exchange codes to yfinance ticker suffixes
EXCHANGE_SUFFIX_MAP: dict[str, str] = {
    "TSX": ".TO",
    "TSXV": ".V",
    "LSE": ".L",
    "FRA": ".F",
    "PAR": ".PA",
    "AMS": ".AS",
    "BRU": ".BR",
    "MIL": ".MI",
    "MAD": ".MC",
    "ASX": ".AX",
    "HKEX": ".HK",
    "TYO": ".T",
    "SGX": ".SI",
    "KRX": ".KS",
    "NSE": ".NS",
    "BSE": ".BO",
    # US exchanges — no suffix needed
    "NYSE": "",
    "NASDAQ": "",
    "AMEX": "",
    "NYSEARCA": "",
}


def build_yfinance_ticker(
    ticker: str, exchange: str | None, asset_type: str
) -> str:
    """Construct a yfinance-compatible ticker string."""
    if asset_type == "crypto":
        # yfinance crypto format: BTC-USD, ETH-USD, etc.
        if "-" not in ticker:
            return f"{ticker}-USD"
        return ticker

    if exchange:
        suffix = EXCHANGE_SUFFIX_MAP.get(exchange.upper(), "")
        # Don't double-add suffix if ticker already has it
        if suffix and not ticker.upper().endswith(suffix.upper()):
            return f"{ticker}{suffix}"

    return ticker


def fetch_prices(
    holdings: list[dict],
) -> dict[int, dict]:
    """Batch-fetch current prices for holdings via yfinance.

    Args:
        holdings: List of dicts with keys: id, ticker, exchange, asset_type

    Returns:
        {holding_id: {"price": float, "currency": str, "price_date": date}}
        for each successfully fetched holding.
    """
    if not holdings:
        return {}

    # Build ticker mapping: yf_ticker -> holding info
    ticker_to_holdings: dict[str, list[dict]] = {}
    for h in holdings:
        yf_ticker = build_yfinance_ticker(
            h["ticker"], h.get("exchange"), h["asset_type"]
        )
        ticker_to_holdings.setdefault(yf_ticker, []).append(h)

    yf_tickers = list(ticker_to_holdings.keys())

    # Fetch all tickers at once using yfinance Tickers
    results: dict[int, dict] = {}
    tickers_obj = yf.Tickers(" ".join(yf_tickers))

    for yf_ticker in yf_tickers:
        try:
            ticker_obj = tickers_obj.tickers[yf_ticker]
            hist = ticker_obj.history(period="5d")
            if hist.empty:
                continue
            price = float(hist["Close"].iloc[-1])
            price_date = hist.index[-1].date()
            currency = str(ticker_obj.fast_info.currency).upper()

            for h in ticker_to_holdings[yf_ticker]:
                results[h["id"]] = {
                    "price": price,
                    "currency": currency,
                    "price_date": price_date,
                }
        except Exception:
            # Individual ticker failure — skip, will be reported as failed
            continue

    return results
