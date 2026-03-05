"""Questrade API client.

Uses httpx for HTTP calls. Authenticates via questrade_auth module.
All methods auto-refresh tokens as needed.
"""

import httpx

from ..questrade_auth import get_valid_token


def _headers(token_data: dict) -> dict:
    return {"Authorization": f"Bearer {token_data['access_token']}"}


def _base_url(token_data: dict) -> str:
    return token_data["api_server"].rstrip("/")


def get_accounts() -> list[dict]:
    """Fetch all Questrade accounts (TFSA, RRSP, margin, etc.)."""
    token = get_valid_token()
    resp = httpx.get(
        f"{_base_url(token)}/v1/accounts",
        headers=_headers(token),
    )
    resp.raise_for_status()
    return resp.json()["accounts"]


def get_positions(account_number: str) -> list[dict]:
    """Fetch positions for a specific account."""
    token = get_valid_token()
    resp = httpx.get(
        f"{_base_url(token)}/v1/accounts/{account_number}/positions",
        headers=_headers(token),
    )
    resp.raise_for_status()
    return resp.json()["positions"]


def get_symbol_info(symbol_id: int) -> dict:
    """Fetch symbol details (name, currency, etc.)."""
    token = get_valid_token()
    resp = httpx.get(
        f"{_base_url(token)}/v1/symbols/{symbol_id}",
        headers=_headers(token),
    )
    resp.raise_for_status()
    symbols = resp.json()["symbols"]
    return symbols[0] if symbols else {}


def get_symbols_batch(symbol_ids: list[int]) -> list[dict]:
    """Fetch multiple symbols in one call."""
    if not symbol_ids:
        return []
    token = get_valid_token()
    ids_param = ",".join(str(s) for s in symbol_ids)
    resp = httpx.get(
        f"{_base_url(token)}/v1/symbols",
        params={"ids": ids_param},
        headers=_headers(token),
    )
    resp.raise_for_status()
    return resp.json()["symbols"]
