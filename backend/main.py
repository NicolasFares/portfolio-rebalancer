import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from .database import Base, engine
from .questrade_auth import exchange_token, _read_token
from .routers import portfolios, holdings, targets, questrade, accounts

load_dotenv()


def _migrate(engine):
    """Idempotent migration: create accounts from strings, migrate cash, drop legacy columns."""
    inspector = inspect(engine)

    # Legacy column migrations (from before accounts existed)
    if "holdings" in inspector.get_table_names():
        holding_cols = {c["name"] for c in inspector.get_columns("holdings")}
        with engine.begin() as conn:
            if "allocation_breakdown" not in holding_cols:
                conn.execute(text("ALTER TABLE holdings ADD COLUMN allocation_breakdown TEXT"))
            if "sector" not in holding_cols:
                conn.execute(text("ALTER TABLE holdings ADD COLUMN sector TEXT"))
            if "geography" not in holding_cols:
                conn.execute(text("ALTER TABLE holdings ADD COLUMN geography TEXT"))

    if "allocation_targets" in inspector.get_table_names():
        target_cols = {c["name"] for c in inspector.get_columns("allocation_targets")}
        if "dimension" not in target_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE allocation_targets ADD COLUMN dimension TEXT NOT NULL DEFAULT 'asset_type'"))

    # Refresh inspector after table creation
    inspector = inspect(engine)
    if "holdings" not in inspector.get_table_names():
        return

    holding_cols = {c["name"] for c in inspector.get_columns("holdings")}

    # Phase 1: Add account_id column if not present and legacy columns exist
    if "account_id" not in holding_cols and "account" in holding_cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE holdings ADD COLUMN account_id INTEGER REFERENCES accounts(id)"))

        # Create Account records from distinct (account, portfolio_id) pairs
        with engine.begin() as conn:
            rows = conn.execute(text(
                "SELECT DISTINCT portfolio_id, account FROM holdings "
                "WHERE account IS NOT NULL AND account != '' AND account_id IS NULL"
            )).fetchall()

            for portfolio_id, account_name in rows:
                # Infer currency from the most common non-cash holding currency in this group
                cur_row = conn.execute(text(
                    "SELECT currency FROM holdings "
                    "WHERE portfolio_id = :pid AND account = :acct AND asset_type != 'cash' "
                    "GROUP BY currency ORDER BY COUNT(*) DESC LIMIT 1"
                ), {"pid": portfolio_id, "acct": account_name}).fetchone()
                currency = cur_row[0] if cur_row else "CAD"

                result = conn.execute(text(
                    "INSERT INTO accounts (portfolio_id, name, currency, cash_balance, created_at, updated_at) "
                    "VALUES (:pid, :name, :currency, 0.0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) "
                    "RETURNING id"
                ), {"pid": portfolio_id, "name": account_name, "currency": currency})
                account_id = result.fetchone()[0]

                conn.execute(text(
                    "UPDATE holdings SET account_id = :aid WHERE portfolio_id = :pid AND account = :acct"
                ), {"aid": account_id, "pid": portfolio_id, "acct": account_name})

            # Handle holdings with NULL/empty account — create "Unassigned" per portfolio
            orphan_pids = conn.execute(text(
                "SELECT DISTINCT portfolio_id FROM holdings "
                "WHERE account_id IS NULL AND (account IS NULL OR account = '')"
            )).fetchall()

            for (pid,) in orphan_pids:
                result = conn.execute(text(
                    "INSERT INTO accounts (portfolio_id, name, currency, cash_balance, created_at, updated_at) "
                    "VALUES (:pid, 'Unassigned', 'CAD', 0.0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) "
                    "RETURNING id"
                ), {"pid": pid})
                account_id = result.fetchone()[0]

                conn.execute(text(
                    "UPDATE holdings SET account_id = :aid WHERE portfolio_id = :pid AND account_id IS NULL"
                ), {"aid": account_id, "pid": pid})

    # Phase 2: Migrate cash holdings → account cash_balance
    # Refresh columns
    holding_cols = {c["name"] for c in inspect(engine).get_columns("holdings")}
    if "account_id" in holding_cols:
        with engine.begin() as conn:
            # Catch both asset_type='cash' and name='Cash' (mistyped cash holdings)
            cash_holdings = conn.execute(text(
                "SELECT id, account_id, quantity, price_per_unit FROM holdings "
                "WHERE (asset_type = 'cash' OR LOWER(name) = 'cash') AND account_id IS NOT NULL"
            )).fetchall()

            for h_id, acct_id, qty, price in cash_holdings:
                cash_value = qty * price
                conn.execute(text(
                    "UPDATE accounts SET cash_balance = cash_balance + :val WHERE id = :aid"
                ), {"val": cash_value, "aid": acct_id})
                conn.execute(text("DELETE FROM holdings WHERE id = :hid"), {"hid": h_id})

    # Phase 3: Recreate holdings table without legacy columns (portfolio_id, account)
    # SQLite can't DROP columns with FK constraints, so we recreate the table.
    holding_cols = {c["name"] for c in inspect(engine).get_columns("holdings")}
    if "portfolio_id" in holding_cols or "account" in holding_cols:
        with engine.begin() as conn:
            conn.execute(text("""
                CREATE TABLE holdings_new (
                    id INTEGER PRIMARY KEY,
                    account_id INTEGER NOT NULL REFERENCES accounts(id),
                    name TEXT NOT NULL,
                    ticker TEXT,
                    asset_type TEXT NOT NULL,
                    quantity FLOAT NOT NULL,
                    price_per_unit FLOAT NOT NULL,
                    currency TEXT NOT NULL DEFAULT 'CAD',
                    sector TEXT,
                    geography TEXT,
                    allocation_breakdown TEXT,
                    created_at DATETIME,
                    updated_at DATETIME
                )
            """))
            conn.execute(text("""
                INSERT INTO holdings_new
                    (id, account_id, name, ticker, asset_type, quantity, price_per_unit,
                     currency, sector, geography, allocation_breakdown, created_at, updated_at)
                SELECT id, account_id, name, ticker, asset_type, quantity, price_per_unit,
                       currency, sector, geography, allocation_breakdown, created_at, updated_at
                FROM holdings
            """))
            conn.execute(text("DROP TABLE holdings"))
            conn.execute(text("ALTER TABLE holdings_new RENAME TO holdings"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _migrate(engine)

    # Auto-connect Questrade if env token is set and no existing token file
    env_token = os.environ.get("QUESTRADE_REFRESH_TOKEN")
    if env_token and not _read_token():
        try:
            exchange_token(env_token)
            print("Questrade: auto-connected from QUESTRADE_REFRESH_TOKEN")
        except Exception as e:
            print(f"Questrade: auto-connect failed: {e}")

    yield


app = FastAPI(title="Portfolio Rebalancer", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(portfolios.router)
app.include_router(holdings.router)
app.include_router(targets.router)
app.include_router(questrade.router)
app.include_router(accounts.router)
