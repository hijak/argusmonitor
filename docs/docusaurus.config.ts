import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'ArgusMonitor Docs',
  tagline: 'AI-powered infrastructure and service monitoring.',
  favicon: 'img/favicon.ico',
  future: {
    v4: true,
  },
  url: 'https://docs.argusmonitor.com',
  baseUrl: '/',
  organizationName: 'hijak',
  projectName: 'argusmonitor',
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
          editUrl: 'https://github.com/hijak/argusmonitor/tree/main/docs/',
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
      title: 'ArgusMonitor Docs',
      hideOnScroll: true,
      logo: {
        alt: 'ArgusMonitor Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://github.com/hijak/argusmonitor',
          label: 'GitHub',
          position: 'right',
        },
        {
          href: 'mailto:plutus.ghost@gmail.com?subject=ArgusMonitor%20Demo',
          label: 'Book Demo',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {label: 'Introduction', to: '/docs/intro'},
            {label: 'Quickstart', to: '/docs/quickstart'},
            {label: 'Alerts + Monitoring', to: '/docs/monitoring/alerts'},
          ],
        },
        {
          title: 'Platform',
          items: [
            {label: 'Monitoring + AI', to: '/docs/pricing-ai'},
            {label: 'Hosted vs Self-Hosted', to: '/docs/hosted-vs-self-hosted'},
            {label: 'GitHub', href: 'https://github.com/hijak/argusmonitor'},
          ],
        },
        {
          title: 'Build',
          items: [
            {label: 'Frontend', href: 'https://github.com/hijak/argusmonitor/tree/main/frontend'},
            {label: 'Backend', href: 'https://github.com/hijak/argusmonitor/tree/main/backend'},
            {label: 'Book Demo', href: 'mailto:plutus.ghost@gmail.com?subject=ArgusMonitor%20Demo'},
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} ArgusMonitor — calm observability, less noise.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
