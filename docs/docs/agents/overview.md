# Agent Overview

Vordr uses lightweight agents to collect host-level signals and report them to the control plane.

## What the agent is for

The agent is the normal path to host visibility in Vordr.

It is responsible for:

- host health reporting
- CPU, memory, disk, and uptime collection
- local service-discovery enrichment in supported cases
- bounded read-only inspection actions

## Why the agent matters

Without an agent, the control plane can still manage some monitoring workflows, but it cannot provide the same level of host-state visibility.

The agent is what gives Vordr its direct operational view of a node.

## Deployment philosophy

The preferred deployment model is:

- native Linux binary
- managed with `systemd`

This is the default recommendation because it gives predictable startup behaviour, direct host visibility, and a more normal operating model for infrastructure monitoring than hiding the agent inside another container layer.

## Trust and scope

The agent should be treated as trusted software in your environment.

Its scope should stay practical and bounded:

- monitoring and host-state collection
- safe reporting to the control plane
- read-only inspection workflows where explicitly supported

It is not intended to become an arbitrary remote shell.
