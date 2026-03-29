# Alerts

Alerts are where a monitoring product either becomes useful or becomes noise.

Vordr’s alerting model is aimed at practical operational response rather than endless red dots.

## Core alert workflow

The platform supports:

- alert rules
- severity levels
- acknowledgement
- resolution
- alert history
- notification delivery foundations
- maintenance windows and silences

## What good alerting looks like

In practice, a usable alerting system needs more than threshold checks.

It also needs:

- clear ownership
- a way to acknowledge work in progress
- a way to resolve or close the loop
- suppression controls for planned work and known noise
- enough auditability to explain why routing or behaviour changed

## Default alerts

Vordr should ship with sensible defaults so users do not start from a blank page.

Typical examples include:

- host CPU above threshold
- host memory above threshold
- host disk above threshold
- service latency above threshold
- service availability below threshold

## Notification delivery

The platform includes the foundations for real delivery rather than placeholder-only testing.

That matters because a monitoring product is only credible when alerts can reach an actual human through a real path.

## Suppression controls

Maintenance windows and alert silences exist to keep planned work and known-noisy conditions from turning into chaos.

A serious deployment should be able to demonstrate:

- a maintenance window being created
- a silence being created
- alert handling during those states

## Public-demo guidance

For a buyer-facing or public review environment, make sure you can show the full loop:

1. an alert appears
2. it is acknowledged
3. it can be resolved
4. a notification path exists
5. suppression controls are documented and visible
