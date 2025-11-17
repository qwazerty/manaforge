FROM node:20-bullseye AS frontend-builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY app/static/css ./app/static/css
COPY app/static/js/svelte ./app/static/js/svelte
COPY tools ./tools

RUN npm run build:css
RUN npm run build:svelte

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN useradd -m -s /bin/sh user
RUN apt-get update && apt-get upgrade -y \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .
COPY --from=frontend-builder /app/app/static/css/dist/manaforge.css app/static/css/dist/manaforge.css
COPY --from=frontend-builder /app/app/static/js/ui/components app/static/js/ui/components

# Expose port
EXPOSE 8000

# Run the application
# Default command runs uvicorn without dev reload
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
USER user