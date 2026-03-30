# Agent Install

The supported public distribution path for node onboarding binaries is **GitHub Releases for this repository**.

Each tagged release publishes packaged agent archives for supported platforms plus a shared `checksums-sha256.txt` manifest.

## Supported release assets

| Platform | Architecture | Asset |
| --- | --- | --- |
| Linux | amd64 | `vordr-agent_linux_amd64.tar.gz` |
| Linux | arm64 | `vordr-agent_linux_arm64.tar.gz` |
| macOS | amd64 | `vordr-agent_darwin_amd64.tar.gz` |
| macOS | arm64 | `vordr-agent_darwin_arm64.tar.gz` |
| Windows | amd64 | `vordr-agent_windows_amd64.zip` |
| All | checksum manifest | `checksums-sha256.txt` |

## Download URL pattern

```text
https://github.com/<owner>/<repo>/releases/download/<tag>/<asset-name>
```

Example:

```text
https://github.com/<owner>/<repo>/releases/download/v0.1.0/vordr-agent_linux_amd64.tar.gz
```

## What each archive contains

Linux archives contain:

```text
vordr-agent_linux_amd64/
  vordr-agent
  README.md
  systemd/
    install-systemd.sh
    vordr-agent.env.example
    vordr-agent.service
```

macOS archives contain:

```text
vordr-agent_darwin_arm64/
  vordr-agent
  README.md
```

Windows archives contain:

```text
vordr-agent_windows_amd64/
  vordr-agent.exe
  README.md
```

## Linux install flow from a release

1. Download the archive and checksum manifest from the release page.
2. Verify the archive checksum.
3. Extract the archive.
4. Install the binary and `systemd` unit.
5. Edit the environment file and start the service.

Example:

```bash
curl -fsSLO https://github.com/<owner>/<repo>/releases/download/<tag>/vordr-agent_linux_amd64.tar.gz
curl -fsSLO https://github.com/<owner>/<repo>/releases/download/<tag>/checksums-sha256.txt
grep ' vordr-agent_linux_amd64.tar.gz$' checksums-sha256.txt | sha256sum -c -
tar -xzf vordr-agent_linux_amd64.tar.gz
cd vordr-agent_linux_amd64
sudo ./systemd/install-systemd.sh \
  ./vordr-agent \
  ./systemd/vordr-agent.env.example \
  ./systemd/vordr-agent.service
sudoedit /etc/vordr-agent/vordr-agent.env
sudo systemctl restart vordr-agent
sudo systemctl status vordr-agent --no-pager
```

## Hosted control plane onboarding

For hosted or same-origin onboarding flows, the Vordr UI can still generate a per-host install command from the Infrastructure page.
That flow remains a convenience layer on top of the packaged agent binary and install script.

## Self-hosted note

The self-hosted backend endpoint `/api/hosts/{host_id}/agent-binary` is useful for same-origin install flows, but it is **not** the canonical public distribution channel.
Public release documentation and CI publishing should point to GitHub Releases.

## Recommended next step

Continue with [Systemd Deployment](./systemd).
