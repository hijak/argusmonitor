package bridge

import (
	ownershipv1alpha1 "github.com/jack/k8s-ownership-operator/api/v1alpha1"
	"github.com/jack/k8s-ownership-operator/pkg/vordr"
)

type ResolvedOwner struct {
	PrimaryType      string
	PrimaryRef       string
	SecondaryType    string
	SecondaryRef     string
	EscalationPolicy string
	Source           string
}

func targetFromRef(ref *ownershipv1alpha1.TargetRef) map[string]any {
	if ref == nil || (ref.Type == "" && ref.Ref == "") {
		return nil
	}
	return map[string]any{"type": ref.Type, "ref": ref.Ref}
}

func OwnerFromPolicy(ref ownershipv1alpha1.OwnerRef, source string) ResolvedOwner {
	owner := ResolvedOwner{Source: source, EscalationPolicy: ref.EscalationPolicyRef}
	if ref.Primary != nil {
		owner.PrimaryType = ref.Primary.Type
		owner.PrimaryRef = ref.Primary.Ref
	}
	if ref.Secondary != nil {
		owner.SecondaryType = ref.Secondary.Type
		owner.SecondaryRef = ref.Secondary.Ref
	}
	return owner
}

func BuildIngestPayload(message, severity, host, service, alertName, namespace string, owner ResolvedOwner, extra map[string]any) vordr.IngestPayload {
	metadata := map[string]any{}
	for k, v := range extra {
		metadata[k] = v
	}
	if alertName != "" {
		metadata["alert_name"] = alertName
	}
	if namespace != "" {
		metadata["namespace"] = namespace
	}
	ownership := map[string]any{
		"source": owner.Source,
	}
	if owner.PrimaryRef != "" {
		ownership["primary"] = map[string]any{"type": owner.PrimaryType, "ref": owner.PrimaryRef}
	}
	if owner.SecondaryRef != "" {
		ownership["secondary"] = map[string]any{"type": owner.SecondaryType, "ref": owner.SecondaryRef}
	}
	if owner.EscalationPolicy != "" {
		ownership["escalationPolicyRef"] = owner.EscalationPolicy
	}
	return vordr.IngestPayload{
		Message:   message,
		Severity:  severity,
		Host:      host,
		Service:   service,
		Metadata:  metadata,
		Ownership: ownership,
	}
}
