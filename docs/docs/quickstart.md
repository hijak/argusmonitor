---
sidebar_position: 2
---

# Quickstart

This is the fastest way to understand the ArgusMonitor deployment model.

## Hosted model

In the hosted model, ArgusMonitor runs the control plane and you install lightweight agents on the infrastructure you want monitored.

Typical flow:

1. Create an ArgusMonitor account
2. Add a node in the control plane
3. Install the agent on the target host
4. Start the agent with systemd
5. Confirm the host appears in the dashboard
6. Enable service discovery and alerts
7. Use the AI copilot for investigation workflows

## Self-hosted model

In the self-hosted model, you run the backend/UI yourself and still deploy the same lightweight agents to your nodes.

This is a good fit when you want:

- maximum control
- local-only data
- low-cost evaluation
- homelab usage

## Recommended first steps

1. Read [Hosted vs Self-Hosted](./hosted-vs-self-hosted)
2. Read [Agent Install](./agents/install)
3. Read [Systemd Deployment](./agents/systemd)
4. Read [Service Discovery](./monitoring/service-discovery)
5. Read [AI Copilot](./monitoring/copilot)
