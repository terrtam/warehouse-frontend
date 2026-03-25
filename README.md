# Frontend

## Overview

React + Vite admin UI for the Warehouse Management System. It consumes the backend REST API and WebSocket topics for realtime updates.

Repository:

- Backend: [warehouse-backend](https://github.com/terrtam/warehouse-backend)

## Tech Stack

- React 19 + TypeScript
- Vite
- TanStack Router + TanStack Query + TanStack Table
- Tailwind CSS + Shadcn UI + Radix UI
- Zustand
- React Hook Form + Zod
- AG Grid and Recharts
- STOMP (SockJS)

## Features

- Sign-in flow that calls `/auth/login` and stores a JWT
- Dashboard with inventory and order KPIs plus report charts
- Products, categories, customers, and suppliers management screens
- Sales and purchase order workflows (create, confirm/order, ship/receive, cancel)
- Inventory adjustments and transaction history
- Realtime updates via STOMP topics (products, categories, inventory, orders, customers, suppliers, communications)
- User management screen backed by local data

## Project Structure

- `src/routes` - file-based routes (auth, errors, authenticated app)
- `src/features` - feature screens and domain UI
- `src/services` - API clients, repositories, realtime transport
- `src/stores` - Zustand stores (auth and UI state)
- `src/components` - reusable UI components
- `src/context` and `src/hooks` - shared state and hooks
- `src/styles` - global styles
- `templatefeatures` and `templateroutes` - template UI and routes

## Setup Instructions

1. Install dependencies:

```bash
pnpm install
```

2. Start the dev server:

```bash
pnpm dev
```

## Configuration

Copy `frontend/.env.example` to `frontend/.env` and set values:

```env
VITE_API_URL=http://localhost:8080
VITE_API_BASE_URL=http://localhost:8080
VITE_WS_URL=http://localhost:8080/ws
VITE_USE_WMS_MOCK=false
VITE_CLERK_PUBLISHABLE_KEY=
```

Notes:

- `VITE_USE_WMS_MOCK=true` enables the in-memory WMS repository in dev mode.
- `VITE_CLERK_PUBLISHABLE_KEY` is only used by the Clerk template routes.
