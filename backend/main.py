from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from .database import Base, engine
from .routers import portfolios, holdings, targets, questrade


def _migrate(engine):
    """Add columns that don't exist yet (lightweight migration for SQLite)."""
    inspector = inspect(engine)
    cols = {c["name"] for c in inspector.get_columns("holdings")}
    if "allocation_breakdown" not in cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE holdings ADD COLUMN allocation_breakdown TEXT"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _migrate(engine)
    yield


app = FastAPI(title="Portfolio Rebalancer", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(portfolios.router)
app.include_router(holdings.router)
app.include_router(targets.router)
app.include_router(questrade.router)
