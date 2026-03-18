# Portfolio Rebalancer

A self-hosted tool for tracking investment portfolios and computing rebalancing suggestions across asset types, sectors, and geographies.

## Features

- Multi-account portfolio management
- Multi-dimensional rebalancing (asset type, sector, geography)
- Multi-currency support with configurable exchange rates (CAD/USD/EUR)
- Managed/balanced fund support with allocation breakdown
- Questrade API integration for auto-syncing holdings
- Single-container Docker deployment

## Quick Start (Docker)

```bash
docker run -p 3000:3000 -v portfolio-data:/app/data ghcr.io/nicolasfares/portfolio-rebalancer:latest
```

Open [http://localhost:3000](http://localhost:3000)

## Local Development

**Prerequisites:** Python 3.12+, Node.js 22+, [uv](https://docs.astral.sh/uv/)

**Backend:**

```bash
uv sync
uv run uvicorn backend.main:app --reload --port 8000
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — Next.js proxies `/api/*` to the backend.

## Docker Build

```bash
docker build -t portfolio-rebalancer .
docker run -p 3000:3000 -v portfolio-data:/app/data portfolio-rebalancer
```

Single container runs both backend (port 8000 internal) and frontend (port 3000 exposed) via supervisord. SQLite database is persisted in the `portfolio-data` volume at `/app/data`.

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_PATH` | SQLite database file path | `data/portfolio.db` |
| `QUESTRADE_REFRESH_TOKEN` | Auto-connect Questrade on startup | — |
| `QUESTRADE_TOKEN_PATH` | Path to store Questrade OAuth tokens | `data/questrade_token.json` |

## Tech Stack

- **Backend:** FastAPI, SQLAlchemy, SQLite, Pydantic
- **Frontend:** Next.js 16 (App Router), shadcn/ui, Tailwind v4, TypeScript
- **Deployment:** Docker (multi-stage build), supervisord, GitHub Actions (arm64 images to ghcr.io)

## Testing

```bash
uv run pytest tests/ -v
```

26 tests: 19 API integration + 7 rebalancer unit tests.

## Release Process

Create a GitHub Release with a semver tag (e.g., `v1.0.0`). GitHub Actions builds an arm64 Docker image and pushes to `ghcr.io/nicolasfares/portfolio-rebalancer`.

## License

[MIT](LICENSE)
