from datetime import datetime, timezone

from sqlalchemy import ForeignKey, Text, Float, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Portfolio(Base):
    __tablename__ = "portfolios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    base_currency: Mapped[str] = mapped_column(Text, nullable=False, default="CAD")
    eur_to_base: Mapped[float] = mapped_column(Float, nullable=False, default=1.50)
    usd_to_base: Mapped[float] = mapped_column(Float, nullable=False, default=1.44)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=_utcnow, onupdate=_utcnow)

    accounts: Mapped[list["Account"]] = relationship(
        back_populates="portfolio", cascade="all, delete-orphan"
    )
    targets: Mapped[list["AllocationTarget"]] = relationship(
        back_populates="portfolio", cascade="all, delete-orphan"
    )

    @property
    def holdings(self) -> list["Holding"]:
        return [h for a in self.accounts for h in a.holdings]


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolios.id"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    institution: Mapped[str | None] = mapped_column(Text)
    account_type: Mapped[str | None] = mapped_column(Text)
    account_number: Mapped[str | None] = mapped_column(Text)
    currency: Mapped[str] = mapped_column(Text, nullable=False, default="CAD")
    cash_balance: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=_utcnow, onupdate=_utcnow)

    portfolio: Mapped["Portfolio"] = relationship(back_populates="accounts")
    holdings: Mapped[list["Holding"]] = relationship(
        back_populates="account_rel", cascade="all, delete-orphan"
    )


class Holding(Base):
    __tablename__ = "holdings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    ticker: Mapped[str | None] = mapped_column(Text)
    asset_type: Mapped[str] = mapped_column(Text, nullable=False)  # equity | bond | crypto | cash | other | managed
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    price_per_unit: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(Text, nullable=False, default="CAD")
    avg_buy_price: Mapped[float | None] = mapped_column(Float, nullable=True, default=None)
    sector: Mapped[str | None] = mapped_column(Text)        # "defense", "technology", "gold", "energy", etc.
    geography: Mapped[str | None] = mapped_column(Text)     # "US", "EU", "Global", etc.
    allocation_breakdown: Mapped[str | None] = mapped_column(Text)  # JSON: {"equity": 60, "bond": 40}
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=_utcnow, onupdate=_utcnow)

    account_rel: Mapped["Account"] = relationship(back_populates="holdings")


class AllocationTarget(Base):
    __tablename__ = "allocation_targets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolios.id"), nullable=False)
    category: Mapped[str] = mapped_column(Text, nullable=False)  # equity | bond | crypto | cash
    target_pct: Mapped[float] = mapped_column(Float, nullable=False)  # 0-100
    dimension: Mapped[str] = mapped_column(Text, nullable=False, default="asset_type")  # "asset_type" | "sector" | "geography"

    portfolio: Mapped["Portfolio"] = relationship(back_populates="targets")
