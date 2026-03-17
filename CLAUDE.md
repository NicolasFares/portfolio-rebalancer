# Portfolio Rebalancer

## Package Management
- Use `uv` as the Python package manager (not pip, not bare python)
- Run backend with: `uv run uvicorn backend.main:app --reload --port 8000`
- Frontend uses npm: `cd frontend && npm run dev`

## Project Structure
- Backend: FastAPI app in `backend/` (Python 3.12+, SQLAlchemy, SQLite)
- Frontend: React + Vite + TypeScript in `frontend/`
