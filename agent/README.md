# Vordr Agent

Standalone host agent for Vordr. It collects local system metrics, optionally tails log files, and sends data to the backend.

## Features

- Registers or updates a host record through `/api/agent/heartbeat`
- Sends CPU, memory, disk, uptime, and network counters
- Ships new log lines to `/api/logs/ingest/batch` (starts at EOF on first run to avoid replaying old logs)
- Runs as a simple polling daemon
- Can be bundled into a single-file binary with PyInstaller

## Configuration

Set these environment variables before starting the agent:

```bash
export VORDR_AGENT_SERVER_URL=http://localhost:8000
export VORDR_AGENT_TOKEN=vordr-agent-dev-token
export VORDR_AGENT_HOSTNAME=$(hostname)
export VORDR_AGENT_LOG_FILES=/var/log/syslog,/var/log/auth.log
# Optional richer collectors
# export VORDR_POSTGRES_DSN=postgresql://argus:arguspass@127.0.0.1:5432/appdb
# export VORDR_MYSQL_DSN=mysql://argus:arguspass@127.0.0.1:3306/appdb
# export VORDR_REDIS_URL=redis://127.0.0.1:6379/0
# export VORDR_RABBITMQ_API_URL=http://127.0.0.1:15672
# export VORDR_RABBITMQ_API_USERNAME=argus
# export VORDR_RABBITMQ_API_PASSWORD=arguspass
```

Optional settings:

- `VORDR_AGENT_INTERVAL_SECONDS` default `30`
- `VORDR_AGENT_SERVICE_NAME` default `host-agent`
- `VORDR_AGENT_HOST_TYPE` default `server`
- `VORDR_AGENT_TAGS` comma-separated tags
- `VORDR_AGENT_VERIFY_TLS` default `true`
- `VORDR_AGENT_DISK_PATH` default `/` (set this to a host root bind mount like `/hostfs` when running in Docker)
- `VORDR_AGENT_IP_ADDRESS` explicit IPv4 address to report to Vordr; useful for Docker/bridge deployments where auto-detection sees the container namespace instead of the host LAN IP
- `VORDR_POSTGRES_DSN` enables richer PostgreSQL detection against a configured DSN (currently used for endpoint-aware probing)
- `VORDR_POSTGRES_METRICS_URL` optional postgres-exporter `/metrics` endpoint; when set, the Postgres plugin reads richer health signals from exporter metrics

## Run

```bash
cd agent
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m vordr_agent.main
```

## Build A Single Binary

Build on the same OS/architecture you plan to run. For example, build on Linux for a Linux binary.

```bash
cd agent
chmod +x build.sh
./build.sh
```

Output:

```bash
agent/dist/vordr-agent
```

Run the binary:

```bash
export VORDR_AGENT_SERVER_URL=http://localhost:8000
export VORDR_AGENT_TOKEN=vordr-agent-dev-token
./dist/vordr-agent
```

Notes:

- PyInstaller produces a single executable, but it is still platform-specific.
- Build separate artifacts for `linux-amd64`, `linux-arm64`, `windows-amd64`, and so on.
- If you disable TLS verification for internal testing, set `VORDR_AGENT_VERIFY_TLS=false`.

## systemd deployment

Files:

- `systemd/vordr-agent.service`
- `systemd/vordr-agent.env.example`
- `systemd/install-systemd.sh`

Example install on a Linux host after building the binary:

```bash
cd agent
sudo ./systemd/install-systemd.sh ./dist/vordr-agent ./systemd/vordr-agent.env.example ./systemd/vordr-agent.service
sudoedit /etc/vordr-agent/vordr-agent.env
sudo systemctl restart vordr-agent
sudo systemctl status vordr-agent --no-pager
```

Notes:

- The service uses `/etc/vordr-agent/vordr-agent.env` for configuration.
- `VORDR_AGENT_LOG_FILES` may require root-readable paths, so a system service is the preferred deployment.
- When running natively on the host, leave `VORDR_AGENT_DISK_PATH=/`.
- When running in Docker, set `VORDR_AGENT_DISK_PATH` to the host root bind mount (for example `/hostfs`).
- For containerized agents, prefer setting `VORDR_AGENT_IP_ADDRESS` to the host LAN IP if you are not using `--network host`.

## Backend

The backend must have the same shared token configured:

```bash
export VORDR_AGENT_SHARED_TOKEN=vordr-agent-dev-token
```
