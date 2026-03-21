FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev curl wget gnupg ca-certificates openssh-client \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libdbus-1-3 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libasound2 libatspi2.0-0 libxshmfence1 fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && python -m playwright install chromium

COPY . .

RUN set -eux; \
    mkdir -p /app/agent-binary; \
    if [ -f "/app/agent-binary/argus-agent" ]; then \
      chmod +x /app/agent-binary/argus-agent; \
    else \
      echo "Agent binary not provided; endpoint /api/hosts/{id}/agent-binary will return 404" >&2; \
    fi

RUN chmod +x start.sh

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["./start.sh"]
