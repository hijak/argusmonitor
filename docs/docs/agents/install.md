# Agent Install

The recommended host deployment is a native agent binary.

## High-level install flow

1. Copy the `vordr-agent` binary to the target host
2. Place it at `/usr/local/bin/vordr-agent`
3. Create an environment/config file
4. Install the systemd unit
5. Enable and start the service

## Typical file layout

```bash
/usr/local/bin/vordr-agent
/etc/vordr-agent/vordr-agent.env
/etc/systemd/system/vordr-agent.service
/var/lib/vordr-agent
```

## Recommended next step

Continue with [Systemd Deployment](./systemd).
