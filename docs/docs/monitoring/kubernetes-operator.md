# Kubernetes ownership operator

Vordr includes an early Kubernetes ownership operator for one specific problem: alerts are much more useful when they already know who owns the thing that is on fire.

The operator attaches ownership metadata to Kubernetes objects and carries that ownership into Vordr alert ingestion.

## What it does

The operator is a small control-plane bridge between Kubernetes resource ownership and Vordr alert routing.

At the moment, the prototype is built around:

- `OwnershipPolicy`
- `AlertOwnershipPolicy`
- watches on `Deployment`, `Service`, and `Namespace`

Its job is to resolve ownership for a workload, then pass that ownership forward so alerts can be routed with context instead of landing as anonymous noise.

## Why this matters

A monitoring system becomes much more credible when an alert can answer questions like:

- which team owns this service
- whether there is a secondary owner
- which escalation policy should apply
- whether the ownership came from a direct annotation or from a policy

Without that, operators still have to do the human glue work after the alert already fired.

With the operator, ownership can be attached before the alert reaches Vordr.

## Ownership resolution model

The current resolution order is:

1. explicit object annotations:
   - `ops.exnet.systems/owner-primary`
   - `ops.exnet.systems/owner-secondary`
2. the first matching `OwnershipPolicy`
3. the default owner from the first matching policy

After resolution, the operator writes resolved annotations back to the object:

- `ops.exnet.systems/resolved-primary`
- `ops.exnet.systems/resolved-secondary`
- `ops.exnet.systems/resolved-primary-type`
- `ops.exnet.systems/resolved-secondary-type`
- `ops.exnet.systems/resolved-escalation-policy`
- `ops.exnet.systems/resolution-source`

That gives you a visible and inspectable ownership result on the Kubernetes side before the alert is forwarded.

## Structured owner references

The operator uses structured owner references so routing intent is explicit rather than hidden in free-form labels.

```yaml
primary:
  type: user|team|policy
  ref: mr-a
secondary:
  type: user|team|policy
  ref: mr-b
escalationPolicyRef: payments-critical
```

## How ownership reaches alerts

The intended integration point is Vordr's alert ingest endpoint:

`POST /api/alerts/ingest`

Recommended payload shape:

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

Vordr normalizes that ownership payload and stores the ownership overlay on the alert instance.

In practice, that means the alert can carry:

- a primary owner
- an optional secondary owner
- an escalation policy reference
- the source of the ownership decision

This is the bit that turns a Kubernetes signal into an alert with actual routing context.

## Alert ownership policy layer

`AlertOwnershipPolicy` lets the controller express alert-routing intent separately from plain object ownership.

The resolver can combine:

- specific alert match rules
- inherited object ownership
- catch-all alert defaults

That gives the system a path to more precise routing without requiring every alert source to reinvent ownership logic.

## Installation and examples

The prototype operator assets live in the repository under:

- `operator/ownership-operator/`
- install manifest: `operator/ownership-operator/config/default/install.yaml`
- example resources: `operator/ownership-operator/examples/test.yaml`

There is also a minimal sender bridge at:

- `operator/ownership-operator/cmd/vordr-alert-sender`

That sender posts directly to:

- `POST /api/alerts/ingest`

It exists as a small bridge so the ownership result can be pushed into Vordr from a controller path, webhook path, or another alert translation layer.

## Current scope

This is currently an ownership-focused operator, not a general Kubernetes management layer.

Its value is in making alerts more actionable by giving them ownership and escalation context before they land in Vordr.

If you are evaluating the platform, the operator story is simple:

1. define ownership close to the workload
2. resolve ownership through policy or annotation
3. ingest alerts into Vordr with that ownership attached
4. inspect and route alerts with less manual guesswork

That is the core reason it exists.