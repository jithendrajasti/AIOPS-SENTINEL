# AI-Ops Sentinel Frontend Build Prompt

You are a senior frontend engineer and SaaS product designer.

Build a production-quality frontend for an AI-powered incident management platform called **AI-Ops Sentinel**.

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide Icons
- Socket.IO Client
- Recharts
- Framer Motion

## Design Requirements

- Dark Theme only
- Glassmorphism cards
- Subtle gradients
- Smooth animations
- Professional SaaS spacing
- Rounded corners
- Responsive design

Inspired by:
- Datadog
- Grafana Cloud
- Linear
- Vercel Dashboard
- New Relic

## Product Context

Application Logs
→ Node.js Collector
→ Kafka
→ AI Brain Service
→ Gemini API
→ Pinecone Vector Database
→ Frontend Dashboard

Features:
- Real-time monitoring
- Incident detection
- AI Root Cause Analysis
- Similar incident discovery
- Suggested fixes
- Golden Records knowledge base

## Global Layout

Sidebar:
- Dashboard
- Incidents
- Services
- Golden Records
- AI Assistant
- Analytics
- Settings

Top Navbar:
- Search
- Live Stream Badge
- Notifications
- User Profile

## Pages

### Dashboard (/dashboard)

- KPI Cards
- Incident Feed
- AI Root Cause Preview
- Service Health
- Incident Timeline
- Top Affected Endpoints
- AI Assistant Widget

### Incident Details (/incidents/[id])

Tabs:
- Overview
- Logs
- Timeline
- Comments

Sections:
- Incident Information
- AI Root Cause Analysis
- Similar Incidents
- Related Deployment
- Impact Metrics

Actions:
- Mark as Golden Record
- Dismiss
- Resolve Incident

### Services (/services)

Table:
- Service Name
- Status
- Health %
- Error Rate
- Latency

Details page:
- Availability
- Error Rate
- Latency
- Recent Incidents
- Dependency Graph
- Health Trends

### Golden Records (/golden-records)

- Search
- Filters
- Sort

Columns:
- Root Cause
- Service
- Tags
- Created By
- Date

### AI Assistant (/assistant)

Capabilities:
- Explain incidents
- Show similar incidents
- Explain stack traces
- Generate postmortems

Features:
- Streaming responses
- Suggested prompts
- Typing indicator

### Analytics (/analytics)

Charts:
- Incident Trends
- Incidents by Service
- MTTR Trend
- Top Root Causes
- Golden Record Usage

## Real-Time Updates

Use Socket.IO for:
- Incident Feed
- Service Health
- KPI Cards
- Timeline

## Folder Structure

```text
src/
 ├─ app/
 ├─ components/
 ├─ features/
 ├─ hooks/
 ├─ lib/
 ├─ services/
 ├─ types/
 ├─ mock/
 └─ utils/
```

## Deliverables

1. Complete Next.js folder structure
2. All page implementations
3. Reusable UI components
4. Mock API layer
5. Socket.IO integration
6. TypeScript types
7. Responsive layouts
8. Dark theme design system
9. Tailwind styling
10. Production-ready code

Focus on exceptional UI/UX quality and make it look like a modern observability SaaS platform.
