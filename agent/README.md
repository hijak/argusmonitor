# ArgusMonitor Agent

Standalone host agent for ArgusMonitor. It collects local system metrics, optionally tails log files, and sends data to the backend.

## Features

- Registers or updates a host record through `/api/agent/heartbeat`
- Sends CPU, memory, disk, uptime, and network counters
- Ships log lines to `/api/logs/ingest/batch`
- Runs as a simple polling daemon
- Can be bundled into a single-file binary with PyInstaller

## Configuration

Set these environment variables before starting the agent:

```bash
export ARGUS_AGENT_SERVER_URL=http://localhost:8000
export ARGUS_AGENT_TOKEN=argus-agent-dev-token
export ARGUS_AGENT_HOSTNAME=$(hostname)
export ARGUS_AGENT_LOG_FILES=/var/log/syslog,/var/log/auth.log
```

Optional settings:

- `ARGUS_AGENT_INTERVAL_SECONDS` default `30`
- `ARGUS_AGENT_SERVICE_NAME` default `host-agent`
- `ARGUS_AGENT_HOST_TYPE` default `server`
- `ARGUS_AGENT_TAGS` comma-separated tags
- `ARGUS_AGENT_VERIFY_TLS` default `true`

## Run

```bash
cd agent
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m argus_agent.main
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
agent/dist/argus-agent
```

Run the binary:

```bash
export ARGUS_AGENT_SERVER_URL=http://localhost:8000
export ARGUS_AGENT_TOKEN=argus-agent-dev-token
./dist/argus-agent
```

Notes:

- PyInstaller produces a single executable, but it is still platform-specific.
- Build separate artifacts for `linux-amd64`, `linux-arm64`, `windows-amd64`, and so on.
- If you disable TLS verification for internal testing, set `ARGUS_AGENT_VERIFY_TLS=false`.

## Backend

The backend must have the same shared token configured:

```bash
export ARGUS_AGENT_SHARED_TOKEN=argus-agent-dev-token
```
