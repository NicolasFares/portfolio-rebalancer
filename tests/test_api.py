"""Integration tests for the Portfolio Rebalancer API.

Each test gets a fresh in-memory SQLite database via the `client` fixture
defined in conftest.py.
"""

import pytest


# ── Helpers ───────────────────────────────────────────────────────────────────

def create_portfolio(client, name="Test Portfolio", base_currency="CAD",
                     eur_to_base=1.50, usd_to_base=1.44):
    resp = client.post("/api/portfolios", json={
        "name": name,
        "base_currency": base_currency,
        "eur_to_base": eur_to_base,
        "usd_to_base": usd_to_base,
    })
    assert resp.status_code == 201
    return resp.json()


def create_account(client, portfolio_id, name="TFSA", institution=None,
                   account_type=None, account_number=None,
                   currency="CAD", cash_balance=0.0):
    resp = client.post(f"/api/portfolios/{portfolio_id}/accounts", json={
        "name": name,
        "institution": institution,
        "account_type": account_type,
        "account_number": account_number,
        "currency": currency,
        "cash_balance": cash_balance,
    })
    assert resp.status_code == 201
    return resp.json()


def create_holding(client, portfolio_id, account_id, name="VFV", ticker="VFV",
                   asset_type="equity", quantity=10.0, price_per_unit=100.0,
                   currency="CAD", sector=None, geography=None,
                   allocation_breakdown=None):
    body = {
        "name": name,
        "ticker": ticker,
        "asset_type": asset_type,
        "quantity": quantity,
        "price_per_unit": price_per_unit,
        "currency": currency,
        "account_id": account_id,
        "sector": sector,
        "geography": geography,
        "allocation_breakdown": allocation_breakdown,
    }
    resp = client.post(f"/api/portfolios/{portfolio_id}/holdings", json=body)
    assert resp.status_code == 201
    return resp.json()


def set_targets(client, portfolio_id, targets):
    resp = client.put(f"/api/portfolios/{portfolio_id}/targets", json=targets)
    assert resp.status_code == 200
    return resp.json()


# ── Portfolio CRUD ─────────────────────────────────────────────────────────────

def test_create_and_list_portfolios(client):
    p1 = create_portfolio(client, "Portfolio A")
    p2 = create_portfolio(client, "Portfolio B")

    resp = client.get("/api/portfolios")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    names = [p["name"] for p in data]
    assert "Portfolio A" in names
    assert "Portfolio B" in names

    # Verify shape of a single portfolio entry
    portfolio = next(p for p in data if p["name"] == "Portfolio A")
    assert portfolio["id"] == p1["id"]
    assert portfolio["base_currency"] == "CAD"
    assert "created_at" in portfolio
    assert "updated_at" in portfolio


def test_get_portfolio_detail(client):
    p = create_portfolio(client, "Detail Portfolio")
    a = create_account(client, p["id"], name="RRSP")
    h = create_holding(client, p["id"], a["id"], name="XEF", asset_type="equity",
                       quantity=5.0, price_per_unit=50.0)

    resp = client.get(f"/api/portfolios/{p['id']}")
    assert resp.status_code == 200
    detail = resp.json()

    assert detail["id"] == p["id"]
    assert detail["name"] == "Detail Portfolio"
    # Nested holdings
    assert len(detail["holdings"]) == 1
    assert detail["holdings"][0]["name"] == "XEF"
    assert detail["holdings"][0]["account_id"] == a["id"]
    assert detail["holdings"][0]["account_name"] == "RRSP"
    # Nested accounts
    assert len(detail["accounts"]) == 1
    assert detail["accounts"][0]["name"] == "RRSP"
    # Targets (empty initially)
    assert detail["targets"] == []


def test_update_portfolio(client):
    p = create_portfolio(client, "Old Name")

    resp = client.put(f"/api/portfolios/{p['id']}", json={"name": "New Name", "usd_to_base": 1.55})
    assert resp.status_code == 200
    updated = resp.json()
    assert updated["name"] == "New Name"
    assert updated["usd_to_base"] == 1.55
    # Unchanged fields stay the same
    assert updated["base_currency"] == "CAD"


def test_delete_portfolio(client):
    p = create_portfolio(client, "To Delete")

    resp = client.delete(f"/api/portfolios/{p['id']}")
    assert resp.status_code == 204

    # Should be gone
    resp = client.get("/api/portfolios")
    assert resp.status_code == 200
    assert resp.json() == []


# ── Account CRUD ───────────────────────────────────────────────────────────────

def test_create_and_list_accounts(client):
    p = create_portfolio(client)

    a1 = create_account(client, p["id"], name="TFSA", institution="TD",
                        account_type="tfsa", currency="CAD", cash_balance=500.0)
    a2 = create_account(client, p["id"], name="RRSP", institution="RBC",
                        account_type="rrsp", currency="CAD", cash_balance=0.0)

    resp = client.get(f"/api/portfolios/{p['id']}/accounts")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2

    names = [a["name"] for a in data]
    assert "TFSA" in names
    assert "RRSP" in names

    # AccountWithStats fields
    tfsa = next(a for a in data if a["name"] == "TFSA")
    assert tfsa["institution"] == "TD"
    assert tfsa["cash_balance"] == 500.0
    assert tfsa["holding_count"] == 0
    assert "total_value" in tfsa
    assert "total_value_base" in tfsa


def test_update_account(client):
    p = create_portfolio(client)
    a = create_account(client, p["id"], name="Old Account")

    resp = client.put(f"/api/accounts/{a['id']}", json={
        "name": "New Account",
        "institution": "National Bank",
        "cash_balance": 1000.0,
    })
    assert resp.status_code == 200
    updated = resp.json()
    assert updated["name"] == "New Account"
    assert updated["institution"] == "National Bank"
    assert updated["cash_balance"] == 1000.0


def test_delete_account(client):
    p = create_portfolio(client)
    a = create_account(client, p["id"], name="To Delete")

    resp = client.delete(f"/api/accounts/{a['id']}")
    assert resp.status_code == 204

    resp = client.get(f"/api/portfolios/{p['id']}/accounts")
    assert resp.status_code == 200
    assert resp.json() == []


# ── Holding CRUD ───────────────────────────────────────────────────────────────

def test_add_and_list_holdings(client):
    p = create_portfolio(client)
    a = create_account(client, p["id"])

    h = create_holding(client, p["id"], a["id"], name="VFV", ticker="VFV",
                       asset_type="equity", quantity=10.0, price_per_unit=150.0)

    assert h["name"] == "VFV"
    assert h["ticker"] == "VFV"
    assert h["asset_type"] == "equity"
    assert h["quantity"] == 10.0
    assert h["price_per_unit"] == 150.0
    assert h["account_id"] == a["id"]
    assert h["account_name"] == "TFSA"

    # Verify it appears in the portfolio detail
    resp = client.get(f"/api/portfolios/{p['id']}")
    assert resp.status_code == 200
    holdings = resp.json()["holdings"]
    assert len(holdings) == 1
    assert holdings[0]["id"] == h["id"]


def test_update_holding(client):
    p = create_portfolio(client)
    a = create_account(client, p["id"])
    h = create_holding(client, p["id"], a["id"], quantity=10.0, price_per_unit=100.0)

    resp = client.put(f"/api/holdings/{h['id']}", json={
        "quantity": 20.0,
        "price_per_unit": 110.0,
        "sector": "technology",
    })
    assert resp.status_code == 200
    updated = resp.json()
    assert updated["quantity"] == 20.0
    assert updated["price_per_unit"] == 110.0
    assert updated["sector"] == "technology"


def test_delete_holding(client):
    p = create_portfolio(client)
    a = create_account(client, p["id"])
    h = create_holding(client, p["id"], a["id"])

    resp = client.delete(f"/api/holdings/{h['id']}")
    assert resp.status_code == 204

    detail = client.get(f"/api/portfolios/{p['id']}").json()
    assert detail["holdings"] == []


# ── Managed Holdings ───────────────────────────────────────────────────────────

def test_managed_holding_with_breakdown(client):
    p = create_portfolio(client)
    a = create_account(client, p["id"])

    breakdown = {"equity": 60.0, "bond": 40.0}
    h = create_holding(client, p["id"], a["id"],
                       name="Balanced Fund", ticker="BAL",
                       asset_type="managed", quantity=100.0, price_per_unit=10.0,
                       allocation_breakdown=breakdown)

    assert h["asset_type"] == "managed"
    assert h["allocation_breakdown"] == breakdown


def test_managed_holding_validation(client):
    p = create_portfolio(client)
    a = create_account(client, p["id"])

    # Breakdown sums to 90% — should return 422
    resp = client.post(f"/api/portfolios/{p['id']}/holdings", json={
        "name": "Bad Fund",
        "ticker": "BAD",
        "asset_type": "managed",
        "quantity": 10.0,
        "price_per_unit": 100.0,
        "currency": "CAD",
        "account_id": a["id"],
        "allocation_breakdown": {"equity": 50.0, "bond": 40.0},  # sums to 90
    })
    assert resp.status_code == 422


# ── Targets ────────────────────────────────────────────────────────────────────

def test_set_and_get_targets(client):
    p = create_portfolio(client)
    targets = [
        {"category": "equity", "target_pct": 60.0, "dimension": "asset_type"},
        {"category": "bond", "target_pct": 30.0, "dimension": "asset_type"},
        {"category": "cash", "target_pct": 10.0, "dimension": "asset_type"},
    ]
    result = set_targets(client, p["id"], targets)
    assert len(result) == 3
    cats = {t["category"]: t["target_pct"] for t in result}
    assert cats["equity"] == 60.0
    assert cats["bond"] == 30.0
    assert cats["cash"] == 10.0

    # GET to verify persistence
    resp = client.get(f"/api/portfolios/{p['id']}/targets?dimension=asset_type")
    assert resp.status_code == 200
    fetched = resp.json()
    assert len(fetched) == 3
    fetched_cats = {t["category"]: t["target_pct"] for t in fetched}
    assert fetched_cats == cats


def test_targets_must_sum_to_100(client):
    p = create_portfolio(client)
    bad_targets = [
        {"category": "equity", "target_pct": 60.0, "dimension": "asset_type"},
        {"category": "bond", "target_pct": 30.0, "dimension": "asset_type"},
        # Missing 10% — only sums to 90%
    ]
    resp = client.put(f"/api/portfolios/{p['id']}/targets", json=bad_targets)
    assert resp.status_code == 400
    assert "100%" in resp.json()["detail"]


# ── Rebalance ──────────────────────────────────────────────────────────────────

def test_rebalance_basic(client):
    p = create_portfolio(client)
    a = create_account(client, p["id"])

    # equity: 1000 CAD, bond: 500 CAD → total 1500 CAD
    create_holding(client, p["id"], a["id"],
                   name="Equities", asset_type="equity",
                   quantity=10.0, price_per_unit=100.0, currency="CAD")
    create_holding(client, p["id"], a["id"],
                   name="Bonds", asset_type="bond",
                   quantity=5.0, price_per_unit=100.0, currency="CAD")

    set_targets(client, p["id"], [
        {"category": "equity", "target_pct": 60.0, "dimension": "asset_type"},
        {"category": "bond", "target_pct": 40.0, "dimension": "asset_type"},
    ])

    resp = client.get(f"/api/portfolios/{p['id']}/rebalance?dimension=asset_type")
    assert resp.status_code == 200
    result = resp.json()

    assert result["total_value"] == 1500.0
    assert result["base_currency"] == "CAD"
    assert len(result["suggestions"]) == 2

    by_cat = {s["category"]: s for s in result["suggestions"]}

    # equity: current = 1000/1500 ≈ 66.67%, target = 60%
    eq = by_cat["equity"]
    assert eq["current_value"] == 1000.0
    assert eq["current_pct"] == pytest.approx(66.67, abs=0.01)
    assert eq["target_pct"] == 60.0
    assert eq["diff_pct"] == pytest.approx(-6.67, abs=0.01)
    assert eq["diff_value"] == pytest.approx(-100.0, abs=0.5)

    # bond: current = 500/1500 ≈ 33.33%, target = 40%
    bd = by_cat["bond"]
    assert bd["current_value"] == 500.0
    assert bd["current_pct"] == pytest.approx(33.33, abs=0.01)
    assert bd["target_pct"] == 40.0
    assert bd["diff_pct"] == pytest.approx(6.67, abs=0.01)
    assert bd["diff_value"] == pytest.approx(100.0, abs=0.5)


def test_rebalance_multi_currency(client):
    # Portfolio: base CAD, 1 USD = 1.50 CAD, 1 EUR = 1.60 CAD
    p = create_portfolio(client, eur_to_base=1.60, usd_to_base=1.50)
    a = create_account(client, p["id"])

    # 10 shares at 100 USD each = 1000 USD * 1.50 = 1500 CAD
    create_holding(client, p["id"], a["id"],
                   name="US Equities", asset_type="equity",
                   quantity=10.0, price_per_unit=100.0, currency="USD")
    # 5 shares at 200 EUR each = 1000 EUR * 1.60 = 1600 CAD
    create_holding(client, p["id"], a["id"],
                   name="EU Bonds", asset_type="bond",
                   quantity=5.0, price_per_unit=200.0, currency="EUR")

    set_targets(client, p["id"], [
        {"category": "equity", "target_pct": 50.0, "dimension": "asset_type"},
        {"category": "bond", "target_pct": 50.0, "dimension": "asset_type"},
    ])

    resp = client.get(f"/api/portfolios/{p['id']}/rebalance?dimension=asset_type")
    assert resp.status_code == 200
    result = resp.json()

    # Total: 1500 + 1600 = 3100 CAD
    assert result["total_value"] == pytest.approx(3100.0, abs=0.01)
    assert result["base_currency"] == "CAD"

    by_cat = {s["category"]: s for s in result["suggestions"]}
    assert by_cat["equity"]["current_value"] == pytest.approx(1500.0, abs=0.01)
    assert by_cat["bond"]["current_value"] == pytest.approx(1600.0, abs=0.01)


def test_rebalance_with_account_filter(client):
    p = create_portfolio(client)
    a1 = create_account(client, p["id"], name="Account 1")
    a2 = create_account(client, p["id"], name="Account 2")

    # Account 1: 1000 CAD equity
    create_holding(client, p["id"], a1["id"],
                   name="Equities A1", asset_type="equity",
                   quantity=10.0, price_per_unit=100.0, currency="CAD")
    # Account 2: 2000 CAD bond
    create_holding(client, p["id"], a2["id"],
                   name="Bonds A2", asset_type="bond",
                   quantity=20.0, price_per_unit=100.0, currency="CAD")

    set_targets(client, p["id"], [
        {"category": "equity", "target_pct": 50.0, "dimension": "asset_type"},
        {"category": "bond", "target_pct": 50.0, "dimension": "asset_type"},
    ])

    # Filter to account 1 only — should see only 1000 CAD equity
    resp = client.get(
        f"/api/portfolios/{p['id']}/rebalance?dimension=asset_type&account_id={a1['id']}"
    )
    assert resp.status_code == 200
    result = resp.json()

    assert result["total_value"] == pytest.approx(1000.0, abs=0.01)
    by_cat = {s["category"]: s for s in result["suggestions"]}
    assert "equity" in by_cat
    assert by_cat["equity"]["current_value"] == pytest.approx(1000.0, abs=0.01)
    # bond target is set but no bond holdings in this account — still present with 0 value
    assert "bond" in by_cat
    assert by_cat["bond"]["current_value"] == pytest.approx(0.0, abs=0.01)
    assert by_cat["bond"]["target_pct"] == 50.0


def test_rebalance_sector_dimension(client):
    p = create_portfolio(client)
    a = create_account(client, p["id"])

    create_holding(client, p["id"], a["id"],
                   name="Tech Stock", asset_type="equity",
                   quantity=10.0, price_per_unit=100.0, currency="CAD",
                   sector="technology")
    create_holding(client, p["id"], a["id"],
                   name="Energy Stock", asset_type="equity",
                   quantity=5.0, price_per_unit=200.0, currency="CAD",
                   sector="energy")

    set_targets(client, p["id"], [
        {"category": "technology", "target_pct": 50.0, "dimension": "sector"},
        {"category": "energy", "target_pct": 50.0, "dimension": "sector"},
    ])

    resp = client.get(f"/api/portfolios/{p['id']}/rebalance?dimension=sector")
    assert resp.status_code == 200
    result = resp.json()

    # tech: 10 * 100 = 1000, energy: 5 * 200 = 1000, total 2000
    assert result["total_value"] == pytest.approx(2000.0, abs=0.01)
    by_cat = {s["category"]: s for s in result["suggestions"]}
    assert by_cat["technology"]["current_value"] == pytest.approx(1000.0, abs=0.01)
    assert by_cat["energy"]["current_value"] == pytest.approx(1000.0, abs=0.01)
    # Both exactly at target so diff should be ~0
    assert abs(by_cat["technology"]["diff_pct"]) < 0.01
    assert abs(by_cat["energy"]["diff_pct"]) < 0.01


# ── Error / Validation Cases ───────────────────────────────────────────────────

def test_portfolio_not_found(client):
    resp = client.get("/api/portfolios/99999")
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()
