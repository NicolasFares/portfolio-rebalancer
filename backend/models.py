from datetime import datetime, date, timezone

from sqlalchemy import ForeignKey, Text, Float, Integer, Date, Index, UniqueConstraint
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
    exchange: Mapped[str | None] = mapped_column(Text)  # "TSX", "NYSE", "LSE", etc.
    asset_type: Mapped[str] = mapped_column(Text, nullable=False)  # equity | bond | crypto | cash | other | managed
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    price_per_unit: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(Text, nullable=False, default="CAD")
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


class PortfolioSnapshot(Base):
    __tablename__ = "portfolio_snapshots"
    __table_args__ = (
        UniqueConstraint("portfolio_id", "snapshot_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False)
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_value_base: Mapped[float] = mapped_column(Float, nullable=False)
    cash_value_base: Mapped[float] = mapped_column(Float, nullable=False)
    eur_to_base: Mapped[float] = mapped_column(Float, nullable=False)
    usd_to_base: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)

    allocations: Mapped[list["SnapshotAllocation"]] = relationship(
        back_populates="snapshot", cascade="all, delete-orphan"
    )
    holdings: Mapped[list["SnapshotHolding"]] = relationship(
        back_populates="snapshot", cascade="all, delete-orphan"
    )


class SnapshotAllocation(Base):
    __tablename__ = "snapshot_allocations"
    __table_args__ = (
        Index("ix_snapshot_allocations_snapshot_dimension", "snapshot_id", "dimension"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    snapshot_id: Mapped[int] = mapped_column(ForeignKey("portfolio_snapshots.id", ondelete="CASCADE"), nullable=False)
    dimension: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(Text, nullable=False)
    value_base: Mapped[float] = mapped_column(Float, nullable=False)
    pct: Mapped[float] = mapped_column(Float, nullable=False)

    snapshot: Mapped["PortfolioSnapshot"] = relationship(back_populates="allocations")


class SnapshotHolding(Base):
    __tablename__ = "snapshot_holdings"
    __table_args__ = (
        Index("ix_snapshot_holdings_snapshot_id", "snapshot_id"),
        Index("ix_snapshot_holdings_holding_id", "holding_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    snapshot_id: Mapped[int] = mapped_column(ForeignKey("portfolio_snapshots.id", ondelete="CASCADE"), nullable=False)
    holding_id: Mapped[int | None] = mapped_column(ForeignKey("holdings.id", ondelete="SET NULL"))
    account_id: Mapped[int | None] = mapped_column(ForeignKey("accounts.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(Text, nullable=False)
    ticker: Mapped[str | None] = mapped_column(Text)
    asset_type: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    price_per_unit: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(Text, nullable=False)
    value_base: Mapped[float] = mapped_column(Float, nullable=False)
    price_date: Mapped[date | None] = mapped_column(Date)

    snapshot: Mapped["PortfolioSnapshot"] = relationship(back_populates="holdings")
