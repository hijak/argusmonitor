import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Vordr Docs',
  tagline: 'Monitoring, alerts, agents, and AI-assisted operations.',
  favicon: 'img/favicon.ico',
  future: {
    v4: true,
  },
  url: 'https://vordr.systems',
  baseUrl: '/',
  organizationName: 'hijak',
  projectName: 'vordr',
  onBrokenLinks: 'throw',
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/hijak/vordr/tree/main/docs/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Vordr Docs',
      hideOnScroll: true,
      logo: {
        alt: 'Vordr Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {
          to: '/docs/quickstart',
          label: 'Quickstart',
          position: 'left',
        },
        {
          to: '/docs/architecture',
          label: 'Architecture',
          position: 'left',
        },
        {
          href: 'https://github.com/hijak/vordr',
          label: 'GitHub',
          position: 'right',
        },
        {
          href: 'mailto:plutus.ghost@gmail.com?subject=Vordr%20Demo',
          label: 'Book Demo',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Get started',
          items: [
            {label: 'Introduction', to: '/docs/intro'},
            {label: 'Quickstart', to: '/docs/quickstart'},
            {label: 'Architecture', to: '/docs/architecture'},
          ],
        },
        {
          title: 'Operate',
          items: [
            {label: 'Alerts', to: '/docs/monitoring/alerts'},
            {label: 'AI Copilot', to: '/docs/monitoring/copilot'},
            {label: 'Production Operations', to: '/docs/production-operations'},
          ],
        },
        {
          title: 'Project',
          items: [
            {label: 'Hosted vs Self-Hosted', to: '/docs/hosted-vs-self-hosted'},
            {label: 'Security and Data', to: '/docs/security-and-data'},
            {label: 'GitHub', href: 'https://github.com/hijak/vordr'},
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} Vordr — calm observability, less noise.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
