package controllers

import (
	"context"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"

	ownershipv1alpha1 "github.com/jack/k8s-ownership-operator/api/v1alpha1"
)

const (
	AnnOwnerPrimary      = "ops.exnet.systems/owner-primary"
	AnnOwnerSecondary    = "ops.exnet.systems/owner-secondary"
	AnnResolvedPrimary   = "ops.exnet.systems/resolved-primary"
	AnnResolvedSecondary = "ops.exnet.systems/resolved-secondary"
	AnnPrimaryType       = "ops.exnet.systems/resolved-primary-type"
	AnnSecondaryType     = "ops.exnet.systems/resolved-secondary-type"
	AnnEscalationPolicy  = "ops.exnet.systems/resolved-escalation-policy"
	AnnResolutionSource  = "ops.exnet.systems/resolution-source"
)

type resolvedOwner struct {
	primaryType      string
	primaryRef       string
	secondaryType    string
	secondaryRef     string
	escalationPolicy string
	source           string
}

type metaObject interface {
	client.Object
	metav1.Object
}

func objectKind(obj client.Object) string {
	switch obj.(type) {
	case *appsv1.Deployment:
		return "Deployment"
	case *corev1.Service:
		return "Service"
	case *corev1.Namespace:
		return "Namespace"
	default:
		return "Unknown"
	}
}

func ownerFromStructuredRef(ref ownershipv1alpha1.OwnerRef, source string) resolvedOwner {
	owner := resolvedOwner{source: source, escalationPolicy: ref.EscalationPolicyRef}
	if ref.Primary != nil {
		owner.primaryType = ref.Primary.Type
		owner.primaryRef = ref.Primary.Ref
	}
	if ref.Secondary != nil {
		owner.secondaryType = ref.Secondary.Type
		owner.secondaryRef = ref.Secondary.Ref
	}
	return owner
}

func resolveOwner(ctx context.Context, c client.Client, obj client.Object) (resolvedOwner, error) {
	anns := obj.GetAnnotations()
	if anns != nil && (anns[AnnOwnerPrimary] != "" || anns[AnnOwnerSecondary] != "") {
		return resolvedOwner{
			primaryType:   "user",
			primaryRef:    anns[AnnOwnerPrimary],
			secondaryType: "user",
			secondaryRef:  anns[AnnOwnerSecondary],
			source:        "annotation",
		}, nil
	}

	var policies ownershipv1alpha1.OwnershipPolicyList
	if err := c.List(ctx, &policies); err != nil {
		return resolvedOwner{}, err
	}

	kind := objectKind(obj)
	labels := obj.GetLabels()
	for _, policy := range policies.Items {
		for _, rule := range policy.Spec.Rules {
			if rule.Match.Namespace != "" && rule.Match.Namespace != obj.GetNamespace() && rule.Match.Namespace != obj.GetName() {
				continue
			}
			if rule.Match.Kind != "" && rule.Match.Kind != kind {
				continue
			}
			if rule.Match.Name != "" && rule.Match.Name != obj.GetName() {
				continue
			}
			matched := true
			for k, v := range rule.Match.Labels {
				if labels[k] != v {
					matched = false
					break
				}
			}
			if !matched {
				continue
			}
			return ownerFromStructuredRef(rule.Owner, "policy"), nil
		}
	}

	for _, policy := range policies.Items {
		if policy.Spec.DefaultOwner.Primary != nil || policy.Spec.DefaultOwner.Secondary != nil || policy.Spec.DefaultOwner.EscalationPolicyRef != "" {
			return ownerFromStructuredRef(policy.Spec.DefaultOwner, "default"), nil
		}
	}

	return resolvedOwner{source: "none"}, nil
}

func resolveAlertOwner(ctx context.Context, c client.Client, namespace string, alertName string, severity string, labels map[string]string, inherited resolvedOwner) (resolvedOwner, error) {
	var policies ownershipv1alpha1.AlertOwnershipPolicyList
	if err := c.List(ctx, &policies); err != nil {
		return resolvedOwner{}, err
	}

	for _, policy := range policies.Items {
		for _, rule := range policy.Spec.Rules {
			if rule.Match.Namespace != "" && rule.Match.Namespace != namespace {
				continue
			}
			if rule.Match.AlertName != "" && rule.Match.AlertName != alertName {
				continue
			}
			if rule.Match.Severity != "" && rule.Match.Severity != severity {
				continue
			}
			matched := true
			for k, v := range rule.Match.Labels {
				if labels[k] != v {
					matched = false
					break
				}
			}
			if matched {
				return ownerFromStructuredRef(rule.Owner, "alert-policy"), nil
			}
		}
	}

	for _, policy := range policies.Items {
		if policy.Spec.InheritFromObjectOwnership && (inherited.primaryRef != "" || inherited.secondaryRef != "") {
			inherited.source = "object-inherit"
			return inherited, nil
		}
		if policy.Spec.DefaultOwner.Primary != nil || policy.Spec.DefaultOwner.Secondary != nil || policy.Spec.DefaultOwner.EscalationPolicyRef != "" {
			return ownerFromStructuredRef(policy.Spec.DefaultOwner, "alert-default"), nil
		}
	}

	return inherited, nil
}

func applyResolvedAnnotations(obj client.Object, owner resolvedOwner) bool {
	anns := obj.GetAnnotations()
	if anns == nil {
		anns = map[string]string{}
	}
	changed := false
	set := func(key, value string) {
		if anns[key] != value {
			anns[key] = value
			changed = true
		}
	}
	set(AnnResolvedPrimary, owner.primaryRef)
	set(AnnResolvedSecondary, owner.secondaryRef)
	set(AnnPrimaryType, owner.primaryType)
	set(AnnSecondaryType, owner.secondaryType)
	set(AnnEscalationPolicy, owner.escalationPolicy)
	set(AnnResolutionSource, owner.source)
	obj.SetAnnotations(anns)
	return changed
}
