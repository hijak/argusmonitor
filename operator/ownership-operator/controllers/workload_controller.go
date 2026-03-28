package controllers

import (
	"context"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/runtime"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

type WorkloadReconciler struct {
	client.Client
	Scheme *runtime.Scheme
}

func (r *WorkloadReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	for _, obj := range []client.Object{&appsv1.Deployment{}, &corev1.Service{}, &corev1.Namespace{}} {
		if err := r.Get(ctx, req.NamespacedName, obj); err == nil {
			owner, err := resolveOwner(ctx, r.Client, obj)
			if err != nil {
				return ctrl.Result{}, err
			}
			if applyResolvedAnnotations(obj, owner) {
				if err := r.Update(ctx, obj); err != nil {
					return ctrl.Result{}, err
				}
			}
			return ctrl.Result{}, nil
		}
	}
	return ctrl.Result{}, nil
}

func (r *WorkloadReconciler) SetupWithManager(mgr ctrl.Manager) error {
	if err := ctrl.NewControllerManagedBy(mgr).
		For(&appsv1.Deployment{}).
		Complete(r); err != nil {
		return err
	}
	if err := ctrl.NewControllerManagedBy(mgr).
		For(&corev1.Service{}).
		Complete(r); err != nil {
		return err
	}
	if err := ctrl.NewControllerManagedBy(mgr).
		For(&corev1.Namespace{}).
		Complete(r); err != nil {
		return err
	}
	return nil
}
