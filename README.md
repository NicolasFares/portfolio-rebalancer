# Portfolio Rebalancer

A lightweight web app for tracking investment portfolio allocations and generating rebalancing suggestions. Supports direct holdings (ETFs, stocks, crypto, cash) and **managed assets** like discretionary bank portfolios with custom allocation breakdowns.

## Features

- **Multi-portfolio management** — create and manage multiple portfolios with different base currencies
- **Holdings tracking** — add holdings with name, ticker, quantity, price, currency, and account
- **Managed assets** — enter a single managed position (e.g. private bank portfolio) with an allocation breakdown (60% equity, 40% bond), and the rebalancer splits the value across categories automatically
- **Allocation targets** — set target percentages per asset class (equity, bond, crypto, cash)
- **Rebalancing suggestions** — see how far each category is from target and get buy/sell suggestions
- **Multi-currency** — supports CAD, EUR, USD with configurable exchange rates
- **Allocation chart** — visual bar chart of current allocation by asset type

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | FastAPI, SQLAlchemy 2.0, Pydantic v2, SQLite |
| Frontend | React 19, TypeScript, React Router, Vite |
| Package managers | [uv](https://docs.astral.sh/uv/) (Python), npm (JS) |

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 18+
- [uv](https://docs.astral.sh/uv/) (`curl -LsSf https://astral.sh/uv/install.sh | sh`)

### Backend

```bash
uv sync
uv run uvicorn backend.main:app --reload --port 8000
```

API available at http://localhost:8000 — interactive docs at http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Project Structure

```
├── backend/
│   ├── main.py              # FastAPI app, lifespan, CORS
│   ├── database.py          # SQLAlchemy engine + session
│   ├── models.py            # Portfolio, Holding, AllocationTarget
│   ├── schemas.py           # Pydantic request/response schemas
│   ├── routers/
│   │   ├── portfolios.py    # CRUD + detail endpoint
│   │   ├── holdings.py      # CRUD for holdings
│   │   └── targets.py       # Set/get allocation targets
│   └── services/
│       └── rebalancer.py    # Core rebalancing logic
├── frontend/
│   └── src/
│       ├── api.ts            # Typed API client
│       ├── types.ts          # TypeScript interfaces
│       └── pages/
│           ├── PortfolioList.tsx
│           ├── PortfolioDetail.tsx
│           └── Rebalance.tsx
├── data/                     # SQLite database (gitignored)
├── pyproject.toml
└── uv.lock
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/portfolios` | List all portfolios |
| POST | `/api/portfolios` | Create a portfolio |
| GET | `/api/portfolios/{id}` | Get portfolio with holdings + targets |
| PUT | `/api/portfolios/{id}` | Update portfolio |
| DELETE | `/api/portfolios/{id}` | Delete portfolio |
| POST | `/api/portfolios/{id}/holdings` | Add a holding |
| PUT | `/api/holdings/{id}` | Update a holding |
| DELETE | `/api/holdings/{id}` | Delete a holding |
| PUT | `/api/portfolios/{id}/targets` | Set allocation targets |
| GET | `/api/portfolios/{id}/rebalance` | Get rebalancing suggestions |

## Managed Assets

For holdings where you don't control individual positions (e.g. a private bank discretionary mandate), use `asset_type: "managed"` with an `allocation_breakdown`:

```json
{
  "name": "Private Bank Portfolio",
  "asset_type": "managed",
  "quantity": 1,
  "price_per_unit": 50000,
  "currency": "EUR",
  "allocation_breakdown": { "equity": 60, "bond": 40 }
}
```

The rebalancer and allocation chart will split the value proportionally (e.g. 30,000 EUR to equity, 20,000 EUR to bond) instead of bucketing it under a single "managed" category.

## License

MIT
