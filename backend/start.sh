#!/bin/bash
set -e

echo "Waiting for PostgreSQL to be ready..."
until python3 -c "import socket; s=socket.socket(); s.settimeout(2); s.connect(('postgres',5432)); s.close(); print('connected')" 2>/dev/null; do
    echo "  ...waiting"
    sleep 2
done
echo "PostgreSQL is ready."

echo "Running database seed..."
python3 -m seed || echo "Seed skipped or already applied."

echo "Starting ArgusMonitor API..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --log-level info
