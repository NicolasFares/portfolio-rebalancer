"""Exchange rate fetching from the ECB daily XML feed."""

from __future__ import annotations

import xml.etree.ElementTree as ET

import httpx

ECB_DAILY_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml"
ECB_NS = {"gesmes": "http://www.gesmes.org/xml/2002-08-01", "ecb": "http://www.ecb.int/vocabulary/2002-08-01/euref"}


def fetch_ecb_rates() -> tuple[dict[str, float], str]:
    """Fetch the latest ECB daily exchange rates.

    Returns:
        (rates, date) where rates is {"USD": 1.08, "CAD": 1.47, ...}
        (all rates per 1 EUR) and date is the reference date string.
    """
    resp = httpx.get(ECB_DAILY_URL, timeout=15)
    resp.raise_for_status()

    root = ET.fromstring(resp.text)
    cube = root.find(".//ecb:Cube/ecb:Cube", ECB_NS)
    if cube is None:
        raise ValueError("Could not parse ECB XML feed")

    date = cube.attrib.get("time", "unknown")

    rates: dict[str, float] = {"EUR": 1.0}
    for rate_elem in cube.findall("ecb:Cube", ECB_NS):
        currency = rate_elem.attrib.get("currency", "")
        rate_val = rate_elem.attrib.get("rate", "")
        if currency and rate_val:
            rates[currency] = float(rate_val)

    return rates, date


def compute_rates_for_base(
    ecb_rates: dict[str, float], base_currency: str
) -> dict[str, float]:
    """Convert ECB EUR-based rates to rates relative to a given base currency.

    Returns:
        {"eur_to_base": X, "usd_to_base": Y} where values are
        how many units of base_currency per 1 unit of foreign currency.
    """
    base = base_currency.upper()

    if base == "EUR":
        base_per_eur = 1.0
    elif base in ecb_rates:
        base_per_eur = ecb_rates[base]
    else:
        raise ValueError(f"Base currency {base} not found in ECB rates")

    # EUR -> base: direct
    eur_to_base = base_per_eur

    # USD -> base: (base_per_eur) / (usd_per_eur)
    usd_per_eur = ecb_rates.get("USD")
    if usd_per_eur is None:
        raise ValueError("USD not found in ECB rates")
    usd_to_base = base_per_eur / usd_per_eur

    return {
        "eur_to_base": round(eur_to_base, 6),
        "usd_to_base": round(usd_to_base, 6),
    }
