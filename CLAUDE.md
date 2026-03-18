# Portfolio Rebalancer

## Package Management
- Use `uv` as the Python package manager (not pip, not bare python)
- Run backend with: `uv run uvicorn backend.main:app --reload --port 8000`
- Frontend uses npm: `cd frontend && npm run dev` (port 3000)

## Project Structure
- Backend: FastAPI app in `backend/` (Python 3.12+, SQLAlchemy, SQLite)
- Frontend: Next.js 16 + shadcn/ui + Tailwind v4 in `frontend/` (App Router)

## Docker
- Build: `docker build -t portfolio-rebalancer .`
- Run: `docker run -p 3000:3000 -v portfolio-data:/app/data portfolio-rebalancer`
- Single container runs both backend (port 8000 internal) and frontend (port 3000 exposed)
- Next.js rewrites proxy `/api/*` to the backend

## Release Process
- Create a GitHub Release with a semver tag (e.g. `v1.0.0`)
- GitHub Actions automatically builds an arm64 Docker image and pushes to ghcr.io
