# Read-only Host Inspections

ArgusMonitor supports a model where the control plane can queue **bounded read-only inspection actions** for monitored hosts.

## Why this exists

Users often want answers to questions like:

- what are the largest files on this node?
- what are the biggest folders under `/var`?
- what is consuming space right now?

## Safety model

This should **not** become arbitrary remote shell execution.

The intended design is:

- action kinds are explicitly allow-listed
- target paths are bounded
- the agent runs read-only inspections only
- the result is returned to the control plane
- the copilot can present the result in-thread

## Example action

A safe first action is:

- `largest_paths`
