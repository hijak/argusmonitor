# Vordr Agent

**The standalone host agent for Vordr.**

The Vordr Agent collects host telemetry, optionally tails logs, and reports back to the Vordr backend. It is designed for simple deployment on Linux servers, local test boxes, and packaged binary distribution.

## What it does

- registers or updates a host via `/api/agent/heartbeat`
- sends CPU, memory, disk, uptime, and network counters
- can ship appended log lines to the backend
- runs as a lightweight polling daemon
- can be bundled into a single-file binary with PyInstaller

## Typical use cases

- onboard a server into Vordr without installing the full product stack on that machine
- report host health from edge nodes or small VMs
- collect operational telemetry in a self-hosted environment
- package a simple downloadable binary for operators

## Configuration

Set the basics before starting the agent:

```bash
export VORDR_AGENT_SERVER_URL=http://localhost:8000
export VORDR_AGENT_TOKEN=vordr-agent-dev-token
export VORDR_AGENT_HOSTNAME=$(hostname)
export VORDR_AGENT_LOG_FILES=/var/log/syslog,/var/log/auth.log
```

### Optional settings

| Variable | Description |
|----------|-------------|
| `VORDR_AGENT_INTERVAL_SECONDS` | Polling interval. Default: `30` |
| `VORDR_AGENT_SERVICE_NAME` | Service name reported to Vordr. Default: `host-agent` |
| `VORDR_AGENT_HOST_TYPE` | Host type label. Default: `server` |
| `VORDR_AGENT_TAGS` | Comma-separated host tags |
| `VORDR_AGENT_VERIFY_TLS` | TLS verification toggle. Default: `true` |
| `VORDR_AGENT_DISK_PATH` | Disk path to inspect. Default: `/` |
| `VORDR_AGENT_IP_ADDRESS` | Explicit IPv4 address to report |
| `VORDR_AGENT_PLUGINS_REPO` | Optional local plugins checkout |
| `VORDR_POSTGRES_DSN` | Enables PostgreSQL-aware discovery |
| `VORDR_POSTGRES_METRICS_URL` | Optional postgres-exporter metrics endpoint |
| `VORDR_MYSQL_DSN` | Enables MySQL-aware discovery |
| `VORDR_REDIS_URL` | Enables Redis-aware discovery |
| `VORDR_RABBITMQ_API_URL` | Enables RabbitMQ-aware discovery |
| `VORDR_RABBITMQ_API_USERNAME` | RabbitMQ API username |
| `VORDR_RABBITMQ_API_PASSWORD` | RabbitMQ API password |
| `VORDR_PROMETHEUS_URL` | Optional Prometheus endpoint |
| `VORDR_KUBERNETES_API` | Optional Kubernetes API endpoint |
| `VORDR_KUBERNETES_BEARER_TOKEN` | Kubernetes bearer token |
| `VORDR_KUBERNETES_VERIFY_SSL` | Kubernetes SSL verification toggle |

## Run from source

```bash
cd agent
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m vordr_agent.main
```

## Build a single binary

Build on the same OS and architecture you plan to ship.

```bash
cd agent
chmod +x build.sh
./build.sh
```

Output:

```bash
agent/dist/vordr-agent
```

Run the packaged binary:

```bash
export VORDR_AGENT_SERVER_URL=http://localhost:8000
export VORDR_AGENT_TOKEN=vordr-agent-dev-token
./dist/vordr-agent
```

## Public release assets

The intended public distribution path is **GitHub Releases**.

Expected assets per tagged release:

- `vordr-agent_linux_amd64.tar.gz`
- `vordr-agent_linux_arm64.tar.gz`
- `vordr-agent_darwin_amd64.tar.gz`
- `vordr-agent_darwin_arm64.tar.gz`
- `vordr-agent_windows_amd64.zip`
- `checksums-sha256.txt`

Download pattern:

```text
https://github.com/<owner>/<repo>/releases/download/<tag>/<asset-name>
```

Linux archives are expected to include:

- the agent binary
- this README
- the `systemd/` install files

## systemd deployment

Included files:

- `systemd/vordr-agent.service`
- `systemd/vordr-agent.env.example`
- `systemd/install-systemd.sh`

### Install after building locally

```bash
cd agent
sudo ./systemd/install-systemd.sh ./dist/vordr-agent ./systemd/vordr-agent.env.example ./systemd/vordr-agent.service
sudoedit /etc/vordr-agent/vordr-agent.env
sudo systemctl restart vordr-agent
sudo systemctl status vordr-agent --no-pager
```

### Install from a GitHub release asset

```bash
curl -fsSLO https://github.com/<owner>/<repo>/releases/download/<tag>/vordr-agent_linux_amd64.tar.gz
curl -fsSLO https://github.com/<owner>/<repo>/releases/download/<tag>/checksums-sha256.txt
grep ' vordr-agent_linux_amd64.tar.gz$' checksums-sha256.txt | sha256sum -c -
tar -xzf vordr-agent_linux_amd64.tar.gz
cd vordr-agent_linux_amd64
sudo ./systemd/install-systemd.sh ./vordr-agent ./systemd/vordr-agent.env.example ./systemd/vordr-agent.service
sudoedit /etc/vordr-agent/vordr-agent.env
sudo systemctl restart vordr-agent
sudo systemctl status vordr-agent --no-pager
```

## Backend requirement

The backend must be configured with the same shared token:

```bash
export VORDR_AGENT_SHARED_TOKEN=vordr-agent-dev-token
```

## Notes

- Keep `VORDR_AGENT_VERIFY_TLS=true` in normal deployments.
- For Dockerised agents, set `VORDR_AGENT_DISK_PATH` to a host root bind mount such as `/hostfs`.
- If the detected IP is wrong inside containers, set `VORDR_AGENT_IP_ADDRESS` explicitly.
- If you ship logs from privileged paths, a system service is usually the cleanest deployment mode.
