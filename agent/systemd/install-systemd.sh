#!/usr/bin/env bash
set -euo pipefail

BIN_PATH="${1:-./dist/vordr-agent}"
ENV_SRC="${2:-./systemd/vordr-agent.env.example}"
SERVICE_SRC="${3:-./systemd/vordr-agent.service}"

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo $0 [binary] [env-file] [service-file]" >&2
  exit 1
fi

install -d /etc/vordr-agent /var/lib/vordr-agent /usr/local/bin
install -m 0755 "$BIN_PATH" /usr/local/bin/vordr-agent
if [[ ! -f /etc/vordr-agent/vordr-agent.env ]]; then
  install -m 0644 "$ENV_SRC" /etc/vordr-agent/vordr-agent.env
else
  echo "Keeping existing /etc/vordr-agent/vordr-agent.env"
fi
install -m 0644 "$SERVICE_SRC" /etc/systemd/system/vordr-agent.service
systemctl daemon-reload
systemctl enable --now vordr-agent.service
systemctl status --no-pager --full vordr-agent.service || true
