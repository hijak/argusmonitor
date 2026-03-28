package controllers

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"

	ownershipv1alpha1 "github.com/jack/k8s-ownership-operator/api/v1alpha1"
)

type AlertOwnershipPolicyReconciler struct {
	client.Client
	Scheme *runtime.Scheme
}

func (r *AlertOwnershipPolicyReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	var policy ownershipv1alpha1.AlertOwnershipPolicy
	if err := r.Get(ctx, req.NamespacedName, &policy); err != nil {
		return ctrl.Result{}, client.IgnoreNotFound(err)
	}
	policy.Status.ObservedGeneration = policy.Generation
	policy.Status.RuleCount = len(policy.Spec.Rules)
	_ = r.Status().Update(ctx, &policy)
	return ctrl.Result{}, nil
}

func (r *AlertOwnershipPolicyReconciler) SetupWithManager(mgr ctrl.Manager) error {
	return ctrl.NewControllerManagedBy(mgr).
		For(&ownershipv1alpha1.AlertOwnershipPolicy{}).
		Complete(r)
}
