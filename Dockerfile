##########
# Stage 1
##########

FROM node:22-bookworm AS frontend-builder
WORKDIR /app

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY app ./app
COPY tools ./tools
COPY tailwind.config.js ./tailwind.config.js

RUN pnpm run build:css
RUN pnpm run build:svelte

##########
# Stage 2
##########
FROM python:3.12-slim AS backend

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies and create runtime user
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl \
    && rm -rf /var/lib/apt/lists/*
RUN useradd -m -s /bin/sh user

# Install Python dependencies as root so globally available
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .
COPY --from=frontend-builder /app/app/static/css/dist/manaforge.css app/static/css/dist/manaforge.css
COPY --from=frontend-builder /app/app/static/js/ui/components app/static/js/ui/components

# Expose port
EXPOSE 8000
USER user

# Run the application
# Default command runs uvicorn without dev reload
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
