"""Questrade OAuth2 token management.

Stores tokens in data/questrade_token.json (gitignored).
Handles token exchange and auto-rotation of refresh tokens.
"""

import json
import time
from pathlib import Path

import httpx

TOKEN_FILE = Path(__file__).resolve().parent.parent / "data" / "questrade_token.json"
AUTH_URL = "https://login.questrade.com/oauth2/token"


def _read_token() -> dict | None:
    if not TOKEN_FILE.exists():
        return None
    return json.loads(TOKEN_FILE.read_text())


def _write_token(data: dict) -> None:
    TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
    TOKEN_FILE.write_text(json.dumps(data, indent=2))


def exchange_token(refresh_token: str) -> dict:
    """Exchange a refresh token for access + new refresh token.

    Returns dict with access_token, refresh_token, api_server, expires_at.
    Raises httpx.HTTPStatusError on failure.
    """
    resp = httpx.get(AUTH_URL, params={
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    })
    resp.raise_for_status()
    data = resp.json()

    token_data = {
        "access_token": data["access_token"],
        "refresh_token": data["refresh_token"],
        "api_server": data["api_server"],  # e.g. "https://api05.iq.questrade.com/"
        "expires_at": time.time() + data["expires_in"] - 30,  # 30s buffer
    }
    _write_token(token_data)
    return token_data


def get_valid_token() -> dict:
    """Return a valid token, refreshing if needed.

    Raises ValueError if no token is configured.
    Raises httpx.HTTPStatusError if refresh fails (token expired).
    """
    token_data = _read_token()
    if not token_data:
        raise ValueError("No Questrade token configured")

    if time.time() >= token_data.get("expires_at", 0):
        token_data = exchange_token(token_data["refresh_token"])

    return token_data


def get_status() -> dict:
    """Return connection status without triggering a refresh."""
    token_data = _read_token()
    if not token_data:
        return {"status": "not_configured"}

    if time.time() >= token_data.get("expires_at", 0):
        # Access token expired but refresh token may still work (valid 7 days)
        return {"status": "expired", "message": "Access token expired, will refresh on next use"}

    return {"status": "connected"}


def clear_token() -> None:
    """Remove stored token."""
    if TOKEN_FILE.exists():
        TOKEN_FILE.unlink()
