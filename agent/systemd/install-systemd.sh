#!/usr/bin/env bash
set -euo pipefail

BIN_PATH="${1:-./dist/argus-agent}"
ENV_SRC="${2:-./systemd/argus-agent.env.example}"
SERVICE_SRC="${3:-./systemd/argus-agent.service}"

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo $0 [binary] [env-file] [service-file]" >&2
  exit 1
fi

install -d /etc/argus-agent /var/lib/argus-agent /usr/local/bin
install -m 0755 "$BIN_PATH" /usr/local/bin/argus-agent
if [[ ! -f /etc/argus-agent/argus-agent.env ]]; then
  install -m 0644 "$ENV_SRC" /etc/argus-agent/argus-agent.env
else
  echo "Keeping existing /etc/argus-agent/argus-agent.env"
fi
install -m 0644 "$SERVICE_SRC" /etc/systemd/system/argus-agent.service
systemctl daemon-reload
systemctl enable --now argus-agent.service
systemctl status --no-pager --full argus-agent.service || true
