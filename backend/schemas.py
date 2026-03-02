import json
from datetime import datetime
from pydantic import BaseModel, field_validator, model_validator


# ── Holdings ──────────────────────────────────────────────

class HoldingCreate(BaseModel):
    name: str
    ticker: str | None = None
    asset_type: str
    quantity: float
    price_per_unit: float
    currency: str = "CAD"
    account: str | None = None
    allocation_breakdown: dict[str, float] | None = None

    @model_validator(mode="after")
    def validate_managed(self):
        if self.asset_type == "managed":
            if not self.allocation_breakdown:
                raise ValueError("allocation_breakdown is required for managed holdings")
            total = sum(self.allocation_breakdown.values())
            if abs(total - 100) > 0.01:
                raise ValueError(f"allocation_breakdown must sum to 100% (got {total}%)")
        return self


class HoldingUpdate(BaseModel):
    name: str | None = None
    ticker: str | None = None
    asset_type: str | None = None
    quantity: float | None = None
    price_per_unit: float | None = None
    currency: str | None = None
    account: str | None = None
    allocation_breakdown: dict[str, float] | None = None

    @model_validator(mode="after")
    def validate_managed(self):
        if self.asset_type == "managed" and self.allocation_breakdown:
            total = sum(self.allocation_breakdown.values())
            if abs(total - 100) > 0.01:
                raise ValueError(f"allocation_breakdown must sum to 100% (got {total}%)")
        return self


class HoldingOut(BaseModel):
    id: int
    portfolio_id: int
    name: str
    ticker: str | None
    asset_type: str
    quantity: float
    price_per_unit: float
    currency: str
    account: str | None
    allocation_breakdown: dict[str, float] | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("allocation_breakdown", mode="before")
    @classmethod
    def deserialize_breakdown(cls, v):
        """Deserialize JSON string from DB into dict for API response."""
        if isinstance(v, str):
            return json.loads(v)
        return v


# ── Targets ───────────────────────────────────────────────

class TargetItem(BaseModel):
    category: str
    target_pct: float


class TargetOut(BaseModel):
    id: int
    portfolio_id: int
    category: str
    target_pct: float

    model_config = {"from_attributes": True}


# ── Portfolio ─────────────────────────────────────────────

class PortfolioCreate(BaseModel):
    name: str
    base_currency: str = "CAD"
    eur_to_base: float = 1.50
    usd_to_base: float = 1.44


class PortfolioUpdate(BaseModel):
    name: str | None = None
    base_currency: str | None = None
    eur_to_base: float | None = None
    usd_to_base: float | None = None


class PortfolioOut(BaseModel):
    id: int
    name: str
    base_currency: str
    eur_to_base: float
    usd_to_base: float
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PortfolioDetail(PortfolioOut):
    holdings: list[HoldingOut]
    targets: list[TargetOut]


# ── Rebalance ─────────────────────────────────────────────

class RebalanceSuggestion(BaseModel):
    category: str
    current_value: float
    current_pct: float
    target_pct: float
    diff_pct: float
    diff_value: float


class RebalanceResult(BaseModel):
    total_value: float
    base_currency: str
    suggestions: list[RebalanceSuggestion]
