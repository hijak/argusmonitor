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

## Example
See `examples/test.yaml`.
