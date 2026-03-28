package v1alpha1

import metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

type TargetRef struct {
	Type string `json:"type,omitempty"`
	Ref  string `json:"ref,omitempty"`
}

type OwnerRef struct {
	Primary             *TargetRef `json:"primary,omitempty"`
	Secondary           *TargetRef `json:"secondary,omitempty"`
	EscalationPolicyRef string     `json:"escalationPolicyRef,omitempty"`
}

type MatchRule struct {
	Namespace string            `json:"namespace,omitempty"`
	Kind      string            `json:"kind,omitempty"`
	Name      string            `json:"name,omitempty"`
	Labels    map[string]string `json:"labels,omitempty"`
}

type OwnershipRule struct {
	Match MatchRule `json:"match,omitempty"`
	Owner OwnerRef  `json:"owner,omitempty"`
}

type OwnershipPolicySpec struct {
	DefaultOwner OwnerRef        `json:"defaultOwner,omitempty"`
	Rules        []OwnershipRule `json:"rules,omitempty"`
}

type OwnershipPolicyStatus struct {
	ObservedGeneration int64 `json:"observedGeneration,omitempty"`
	RuleCount          int   `json:"ruleCount,omitempty"`
}

type AlertMatchRule struct {
	Namespace string            `json:"namespace,omitempty"`
	AlertName string            `json:"alertName,omitempty"`
	Severity  string            `json:"severity,omitempty"`
	Labels    map[string]string `json:"labels,omitempty"`
}

type AlertOwnershipRule struct {
	Match AlertMatchRule `json:"match,omitempty"`
	Owner OwnerRef       `json:"owner,omitempty"`
}

type AlertOwnershipPolicySpec struct {
	DefaultOwner               OwnerRef             `json:"defaultOwner,omitempty"`
	InheritFromObjectOwnership bool                 `json:"inheritFromObjectOwnership,omitempty"`
	Rules                      []AlertOwnershipRule `json:"rules,omitempty"`
}

type AlertOwnershipPolicyStatus struct {
	ObservedGeneration int64 `json:"observedGeneration,omitempty"`
	RuleCount          int   `json:"ruleCount,omitempty"`
}

// +kubebuilder:object:root=true
// +kubebuilder:subresource:status

type OwnershipPolicy struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   OwnershipPolicySpec   `json:"spec,omitempty"`
	Status OwnershipPolicyStatus `json:"status,omitempty"`
}

// +kubebuilder:object:root=true

type OwnershipPolicyList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []OwnershipPolicy `json:"items"`
}

// +kubebuilder:object:root=true
// +kubebuilder:subresource:status

type AlertOwnershipPolicy struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   AlertOwnershipPolicySpec   `json:"spec,omitempty"`
	Status AlertOwnershipPolicyStatus `json:"status,omitempty"`
}

// +kubebuilder:object:root=true

type AlertOwnershipPolicyList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []AlertOwnershipPolicy `json:"items"`
}
