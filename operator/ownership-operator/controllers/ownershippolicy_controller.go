package controllers

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"

	ownershipv1alpha1 "github.com/jack/k8s-ownership-operator/api/v1alpha1"
)

type OwnershipPolicyReconciler struct {
	client.Client
	Scheme *runtime.Scheme
}

func (r *OwnershipPolicyReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	var policy ownershipv1alpha1.OwnershipPolicy
	if err := r.Get(ctx, req.NamespacedName, &policy); err != nil {
		return ctrl.Result{}, client.IgnoreNotFound(err)
	}
	policy.Status.ObservedGeneration = policy.Generation
	policy.Status.RuleCount = len(policy.Spec.Rules)
	_ = r.Status().Update(ctx, &policy)
	return ctrl.Result{}, nil
}

func (r *OwnershipPolicyReconciler) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&ownershipv1alpha1.OwnershipPolicy{}).
		Complete(r)
}
