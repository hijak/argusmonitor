# Vordr Website

Marketing site for **Vordr**, vendored into the main product repo under `website/`.

## Purpose

This directory contains the public-facing landing site for the product:
- product split across Self-Hosted, Cloud, and Enterprise
- feature overview and product positioning
- AI copilot messaging
- pricing and upgrade path
- launch/demo CTA surface

It is intentionally styled to match the main Vordr app:
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

## Positioning notes

The marketing site should tell one coherent story:

- **Self-Hosted** gives you the product
- **Cloud** removes the operational burden
- **Enterprise** adds organizational control

Avoid making the open-source edition feel fake or making Enterprise sound like basic security is paywalled.

## Notes

- Keep branding/copy visually consistent with the product dashboard.
- Prefer real product screenshots and docs links as they become available.
- Keep the product split honest and easy to explain.
