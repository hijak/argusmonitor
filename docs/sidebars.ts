import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    'quickstart',
    'hosted-vs-self-hosted',
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
        'monitoring/alerts',
        'monitoring/copilot',
        'monitoring/read-only-inspections',
      ],
    },
  ],
};

export default sidebars;
