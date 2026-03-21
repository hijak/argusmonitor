#!/usr/bin/env bash
set -euo pipefail

# Example: run the Argus agent in Docker while reading host metrics/logs.
# Requires access to the Docker socket only if you later extend the agent to inspect containers.

docker run -d \
  --name vordr-agent \
  --restart unless-stopped \
  --pid host \
  -e VORDR_AGENT_SERVER_URL=http://YOUR_VORDR_SERVER:8000 \
  -e VORDR_AGENT_TOKEN=vordr-agent-dev-token \
  -e VORDR_AGENT_HOSTNAME=$(hostname) \
  -e VORDR_AGENT_IP_ADDRESS=10.13.37.43 \
  -e VORDR_AGENT_HOST_TYPE=k8s-node \
  -e VORDR_AGENT_TAGS=k3s,homelab \
  -e VORDR_AGENT_VERIFY_TLS=false \
  -e VORDR_AGENT_DISK_PATH=/hostfs \
  -e VORDR_AGENT_LOG_FILES=/hostfs/var/log/syslog,/hostfs/var/log/auth.log \
  -v /:/hostfs:ro \
  vordr-agent:latest
