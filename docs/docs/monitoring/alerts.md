# Alerts

Vordr should ship with useful default alert packs instead of making users start from a blank page.

## Sensible defaults

Good default alerts include:

- host CPU above threshold
- host memory above threshold
- host disk above threshold
- service latency above threshold
- service uptime below threshold

Defaults should be useful enough to create value immediately, then editable later.

## Serious buyer foundations

Alerts only become enterprise-usable when they stop behaving like a panic machine.

That means the platform needs:

- **real delivery paths** so alerts can actually reach humans
- **on-call ownership** so alerts have a likely responder
- **maintenance windows** so planned work does not generate chaos
- **alert silences** for controlled suppression during noisy periods
- **audit logs** so alert-routing and configuration changes are traceable
- **workspace boundaries** so one team’s alerts do not leak into another team’s world

## Notification delivery

Phase 1 introduces real notification delivery foundations for:

- email via SMTP
- Slack webhooks
- generic webhooks

That is a meaningful step up from “test succeeded” placeholders because it lets the product demonstrate an actual response path.

## Next step

The next logical step after the current foundation is **suppression enforcement**:

- do not create or route alerts when a matching maintenance window is active
- do not notify when a matching silence is active
- surface why an alert was suppressed in the UI and audit trail
