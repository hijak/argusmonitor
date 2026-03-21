# Agent Overview

Vordr uses lightweight agents to collect host-level monitoring signals and report them back to the control plane.

## Agent responsibilities

The agent is responsible for:

- host health reporting
- CPU, memory, disk, and uptime collection
- log shipping
- service-related discovery support
- executing bounded read-only inspection actions

## Deployment philosophy

The preferred deployment model is:

- native Linux binary
- managed by `systemd`

This is the default recommendation because it gives better host visibility and more predictable lifecycle management than forcing the agent itself to run in a container.
