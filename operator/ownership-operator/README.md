# k8s-ownership-operator

Minimal Kubernetes operator for attaching ownership metadata to workloads so alerts can route to the right human/team/policy.

## Phase 2 prototype

### CRDs
- `OwnershipPolicy`
- `AlertOwnershipPolicy`

### Watches
- `Deployment`
- `Service`
- `Namespace`

### Resolution order for objects
1. explicit object annotations `ops.exnet.systems/owner-primary|secondary`
2. first matching `OwnershipPolicy` rule
3. first policy default owner

### Resolved annotations written to objects
- `ops.exnet.systems/resolved-primary`
- `ops.exnet.systems/resolved-secondary`
- `ops.exnet.systems/resolved-primary-type`
- `ops.exnet.systems/resolved-secondary-type`
- `ops.exnet.systems/resolved-escalation-policy`
- `ops.exnet.systems/resolution-source`

### Structured owner refs
```yaml
primary:
  type: user|team|policy
  ref: mr-a
secondary:
  type: user|team|policy
  ref: mr-b
escalationPolicyRef: payments-critical
```

### Alert policy status
The controller now stores alert-routing intent in `AlertOwnershipPolicy`, and the helper resolver can combine:
- specific alert match rules
- inherited object ownership
- alert catch-all defaults

## Vordr integration contract

The intended ingestion target is Vordr's alert ingest endpoint:

`POST /api/alerts/ingest`

Recommended payload shape from operator/webhook bridge:

```json
{
  "message": "payments-api error rate > 5%",
  "severity": "critical",
  "service": "payments-api",
  "host": "edge-lon-1",
  "metadata": {
    "alert_name": "HighErrorRate",
    "namespace": "payments",
    "source": "k8s-operator"
  },
  "ownership": {
    "primary": { "type": "team", "ref": "payments-primary" },
    "secondary": { "type": "user", "ref": "mr-b" },
    "escalationPolicyRef": "payments-critical",
    "source": "k8s-operator"
  }
}
```

Vordr normalizes this and stores the ownership overlay on each alert instance.

## Vordr sender bridge

A minimal sender CLI is included for bridging resolved ownership into Vordr's ingest endpoint.

Location:
- `cmd/vordr-alert-sender`

Example:

```bash
export VORDR_BASE_URL=http://127.0.0.1:8000
export VORDR_TOKEN=<bearer-token>

go run ./cmd/vordr-alert-sender \
  --message "payments-api error rate > 5%" \
  --severity critical \
  --service payments-api \
  --host edge-lon-1 \
  --namespace payments \
  --alert-name HighErrorRate \
  --primary-type team \
  --primary-ref payments-primary \
  --secondary-type user \
  --secondary-ref mr-b \
  --escalation-policy payments-critical
```

This posts directly to:
- `POST /api/alerts/ingest`

The sender is intentionally small so it can be embedded later into:
- a controller reconcile path
- an alert webhook receiver
- a Prometheus/Alertmanager bridge

## Example
See `examples/test.yaml`.
