import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Vordr Docs',
  tagline: 'AI-powered infrastructure and service monitoring.',
  favicon: 'img/favicon.ico',
  future: {
    v4: true,
  },
  url: 'https://docs.vordr.com',
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
          label: 'Docs',
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
            {label: 'GitHub', href: 'https://github.com/hijak/vordr'},
          ],
        },
        {
          title: 'Build',
          items: [
            {label: 'Frontend', href: 'https://github.com/hijak/vordr/tree/main/frontend'},
            {label: 'Backend', href: 'https://github.com/hijak/vordr/tree/main/backend'},
            {label: 'Book Demo', href: 'mailto:plutus.ghost@gmail.com?subject=Vordr%20Demo'},
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
