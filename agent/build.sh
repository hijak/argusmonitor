#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${ROOT_DIR}/.build-venv"

python3 -m venv "${VENV_DIR}"
source "${VENV_DIR}/bin/activate"

python -m pip install --upgrade pip
python -m pip install -r "${ROOT_DIR}/requirements.txt" -r "${ROOT_DIR}/requirements-build.txt"

cd "${ROOT_DIR}"
pyinstaller --clean --noconfirm argus-agent.spec

echo "Built binary at ${ROOT_DIR}/dist/argus-agent"
