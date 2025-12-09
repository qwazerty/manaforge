##########
# Stage 1
##########

FROM node:24-alpine AS frontend-builder
WORKDIR /app

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY app ./app
COPY tools ./tools
COPY tailwind.config.js ./tailwind.config.js
COPY tsconfig.json vite.config.ts ./

RUN pnpm run build

##########
# Stage 2
##########
FROM python:3.14-alpine AS backend

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
RUN adduser -D user

# Install Python dependencies as root so globally available
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .
COPY --from=frontend-builder /app/app/static/dist app/static/dist

# Expose port
EXPOSE 8000
USER user

# Run the application
# Default command runs uvicorn without dev reload
CMD ["uvicorn", "app.backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
