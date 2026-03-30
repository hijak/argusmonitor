# Vordr Frontend

This is the main **React + Vite + TypeScript** application for the Vordr product UI.

It provides the dashboard and operator-facing experience for monitoring, services, alerts, incidents, logs, and settings.

## Stack

- React 18
- Vite
- TypeScript
- Tailwind CSS
- shadcn/ui

## Local development

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server runs on:

- <http://localhost:8080>

During development, `/api` requests are proxied to:

- <http://localhost:8000>

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run test
```

## Purpose

This app is responsible for the main product surface, including:

- overview dashboards
- infrastructure and services views
- transactions and AI workflows
- alerts and incidents
- logs and settings

## Notes

The frontend is designed to work cleanly in local development and in a production setup where the backend API is exposed under the same origin via `/api`.
