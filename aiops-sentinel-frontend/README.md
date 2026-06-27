# AI-Ops Sentinel — Frontend

A production-quality frontend for **AI-Ops Sentinel**, an AI-powered incident
management & observability platform. Dark-theme SaaS UI inspired by Datadog,
Grafana Cloud, Linear, Vercel, and New Relic.

> Frontend only. The app ships with a mock data layer and a simulated real-time
> stream, so it runs fully standalone — no backend required.

## Tech Stack

- **Next.js 15** (App Router) + **React 19**
- **TypeScript**
- **Tailwind CSS** + custom dark design system (glassmorphism, gradients)
- **shadcn/ui**-style primitives (Radix UI)
- **Lucide** icons
- **Recharts** for analytics
- **Framer Motion** for animations
- **Socket.IO Client** (live stream, simulated offline)

## Getting Started

```bash
# Node 18.18+ / 20+ required
npm install
npm run dev
```

Open http://localhost:3000 — the root redirects to `/dashboard`.

```bash
npm run build && npm run start   # production build
```

## Connecting a real-time backend (optional)

The UI uses a simulated stream by default. To wire a live Socket.IO gateway,
set the env var and the client in `src/services/socket.ts` will target it:

```bash
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

## Pages

| Route                 | Description                                              |
| --------------------- | -------------------------------------------------------- |
| `/dashboard`          | KPI cards, incident feed, AI root cause, service health  |
| `/incidents`          | Searchable / filterable incident list                    |
| `/incidents/[id]`     | Deep-dive: Overview, Logs, Timeline, Comments + AI RCA   |
| `/services`           | Service summary cards + table with latency sparklines    |
| `/services/[id]`      | Availability, error rate, latency, deps, recent incidents|
| `/golden-records`     | Curated remediation knowledge base                       |
| `/assistant`          | Streaming AI assistant with suggested prompts            |
| `/analytics`          | Incident trends, MTTR, root causes, golden-record usage  |
| `/settings`           | Profile, notifications, integrations, real-time          |

## Folder Structure

```text
src/
 ├─ app/                 # App Router pages ((app) group wraps the shell)
 ├─ components/
 │   ├─ ui/              # shadcn-style primitives
 │   ├─ layout/          # Sidebar, Topbar, AppShell
 │   ├─ charts/          # Recharts wrappers
 │   ├─ common/          # KPI card, badges, sparkline, code block
 │   ├─ dashboard/       # Assistant widget
 │   └─ brand/           # Logo
 ├─ hooks/               # use-live-data (simulated realtime)
 ├─ lib/                 # utils (cn, formatters)
 ├─ mock/                # mock data layer
 ├─ services/            # socket.io client
 └─ types/               # shared TypeScript types
```

## Assets

The bull-shield brand mark and full lockup are cropped from the provided
source art into `public/logo-mark.png`, `public/logo-full.png`, and
`public/favicon.png`.
