# Systemd Deployment

Vordr prefers a native host agent managed by `systemd`.

## Why systemd

This approach gives you:

- predictable startup and restart behavior
- direct host visibility
- easier journal integration
- less container overhead
- a more normal operational model for infrastructure monitoring

## Example layout

```bash
sudo install -d /etc/vordr-agent /var/lib/vordr-agent /usr/local/bin
sudo install -m 0755 ./vordr-agent /usr/local/bin/vordr-agent
sudo install -m 0644 ./vordr-agent.env /etc/vordr-agent/vordr-agent.env
sudo install -m 0644 ./vordr-agent.service /etc/systemd/system/vordr-agent.service
sudo systemctl daemon-reload
sudo systemctl enable --now vordr-agent.service
sudo systemctl status vordr-agent.service --no-pager
```
