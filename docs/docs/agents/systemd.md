# Systemd Deployment

ArgusMonitor prefers a native host agent managed by `systemd`.

## Why systemd

This approach gives you:

- predictable startup and restart behavior
- direct host visibility
- easier journal integration
- less container overhead
- a more normal operational model for infrastructure monitoring

## Example layout

```bash
sudo install -d /etc/argus-agent /var/lib/argus-agent /usr/local/bin
sudo install -m 0755 ./argus-agent /usr/local/bin/argus-agent
sudo install -m 0644 ./argus-agent.env /etc/argus-agent/argus-agent.env
sudo install -m 0644 ./argus-agent.service /etc/systemd/system/argus-agent.service
sudo systemctl daemon-reload
sudo systemctl enable --now argus-agent.service
sudo systemctl status argus-agent.service --no-pager
```
