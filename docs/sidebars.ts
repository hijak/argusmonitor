import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    'quickstart',
    'architecture',
    'hosted-vs-self-hosted',
    'security-and-data',
    'pricing-ai',
    {
      type: 'category',
      label: 'Agents',
      items: [
        'agents/overview',
        'agents/install',
        'agents/systemd',
      ],
    },
    {
      type: 'category',
      label: 'Monitoring',
      items: [
        'monitoring/service-discovery',
        'monitoring/prometheus-compatibility',
        'monitoring/alerts',
        'monitoring/kubernetes-operator',
        'monitoring/copilot',
        'monitoring/read-only-inspections',
      ],
    },
    {
      type: 'category',
      label: 'Operations',
      items: [
        'production-operations',
        'backup-restore',
        'upgrades',
      ],
    },
    {
      type: 'category',
      label: 'Enterprise Foundations',
      items: [
        'api-versioning',
        'scim-saml',
        'enterprise-stage-3',
        'stage-4-auth-provisioning',
      ],
    },
    'faq',
  ],
};

export default sidebars;
