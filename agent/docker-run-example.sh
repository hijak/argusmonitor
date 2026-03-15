#!/usr/bin/env bash
set -euo pipefail

# Example: run the Argus agent in Docker while reading host metrics/logs.
# Requires access to the Docker socket only if you later extend the agent to inspect containers.

docker run -d \
  --name argus-agent \
  --restart unless-stopped \
  --network host \
  --pid host \
  -e ARGUS_AGENT_SERVER_URL=http://YOUR_ARGUS_SERVER:8000 \
  -e ARGUS_AGENT_TOKEN=argus-agent-dev-token \
  -e ARGUS_AGENT_HOSTNAME=$(hostname) \
  -e ARGUS_AGENT_HOST_TYPE=k8s-node \
  -e ARGUS_AGENT_TAGS=k3s,homelab \
  -e ARGUS_AGENT_VERIFY_TLS=false \
  -e ARGUS_AGENT_DISK_PATH=/hostfs \
  -e ARGUS_AGENT_LOG_FILES=/hostfs/var/log/syslog,/hostfs/var/log/auth.log \
  -v /:/hostfs:ro \
  argusmonitor-agent:latest
