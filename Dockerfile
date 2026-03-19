# Stage 1: Build Next.js frontend
FROM node:22-slim AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Stage 2: Production image
FROM python:3.12-slim

# Install Node.js 22 runtime (for Next.js standalone server)
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl supervisor && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Install Python dependencies
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# Copy backend
COPY backend/ backend/

# Copy Next.js standalone build + static assets
COPY --from=frontend-builder /app/frontend/.next/standalone/ frontend/
COPY --from=frontend-builder /app/frontend/.next/static frontend/.next/static
COPY --from=frontend-builder /app/frontend/public frontend/public

# Copy supervisord config
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Create data directory for SQLite
RUN mkdir -p /app/data

# Environment
ENV DATABASE_PATH=/app/data/portfolio.db
ENV QUESTRADE_TOKEN_PATH=/app/data/questrade_token.json
# Optional: Fernet key for encrypting Questrade tokens at rest.
# If unset, auto-generated on startup (logged once; save it for restarts).
# ENV QUESTRADE_ENCRYPTION_KEY=

EXPOSE 3000
VOLUME /app/data

CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
