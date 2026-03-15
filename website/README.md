# ArgusMonitor Website

Marketing site for **ArgusMonitor**, vendored into the main product repo under `website/`.

## Purpose

This directory contains the public-facing landing site for the product:
- hosted/self-hosted positioning
- feature overview
- AI copilot messaging
- pricing and upgrade path
- launch/demo CTA surface

It is intentionally styled to match the main ArgusMonitor app:
- warm dark background
- amber primary accents
- cyan secondary accents
- compact card radius
- dashboard-like UI language

## Stack

- Vite
- React
- TypeScript
- Tailwind CSS
- shadcn/ui primitives
- Framer Motion

## Local development

```bash
cd website
npm install
npm run dev
```

## Build

```bash
cd website
npm run build
```

## Notes

- This site originated from a Lovable-generated prototype and was then integrated into the main repo.
- Keep branding/copy visually consistent with the product dashboard.
- Prefer real product screenshots and docs links as they become available.

## Next planned work

- add documentation pages / docs integration
- replace placeholder demo/contact links as needed
- add deployment config for production hosting
