# Threat Model

## Project Overview

PantrySwipe is a cooking and pantry-management application built as a pnpm monorepo with an Expo client in `artifacts/pantryswipe/` and an Express API in `artifacts/api-server/`. The user-facing deployment is public (`https://pantryswipe.app`). The mobile/web client is mostly frontend-driven and stores most user state in AsyncStorage, but the production attack surface also includes a public backend for authentication, recipe retrieval, barcode lookup, and AI-powered receipt/pantry/party-planning features.

The mockup sandbox is development-only and should be ignored unless production reachability is demonstrated. Platform-managed TLS is assumed in production.

## Assets

- **User account records** — names, email addresses, password hashes, and issued login tokens handled by the API server. Compromise enables account takeover and user enumeration.
- **Billable AI/API credentials** — Anthropic integration credentials, UPC lookup keys, and any other provider secrets available to the server or committed to the repository. Abuse can create financial loss and unauthorized third-party access.
- **User-submitted images and prompts** — pantry photos, receipt photos, and free-form AI prompts sent to server-side AI routes. These inputs are untrusted and can be used to drive expensive operations.
- **Application data stores** — PostgreSQL recipe/product data and file-backed `data/users.json` user records on the API server. Unauthorized reads or writes would expose or corrupt user and business data.
- **Local device state** — AsyncStorage data such as pantry contents, profile preferences, saved recipes, and auth token material. This is user-controlled and must never be trusted as an authorization source.

## Trust Boundaries

- **Client ↔ API boundary** — Requests from the Expo/web client to `/api/*` cross from an untrusted client into trusted server code. Every request body, query string, route param, and header is attacker-controlled.
- **API ↔ external AI/API providers** — Server routes call Anthropic and barcode lookup providers using privileged credentials. User-controlled inputs can trigger paid or sensitive outbound requests.
- **API ↔ database/filesystem** — Server code reads/writes PostgreSQL and `artifacts/api-server/data/users.json`. Injection and unsafe persistence at this boundary can expose or corrupt stored data.
- **Public ↔ authenticated boundary** — The app has login/registration flows, but server-side protected surfaces must be treated carefully because the client is untrusted and tokens stored client-side are not proof of authorization by themselves.
- **Development-only ↔ production boundary** — `artifacts/mockup-sandbox/`, test files, coverage output, and local build scripts are normally out of scope unless production reachability is shown.

## Scan Anchors

- **Production entry points:** `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, Expo routes under `artifacts/pantryswipe/app/`.
- **Highest-risk code areas:** server routes under `artifacts/api-server/src/routes/`, auth/user storage in `artifacts/api-server/src/routes/auth.ts` and `artifacts/api-server/src/lib/users-store.ts`, environment files in project root and `artifacts/api-server/`.
- **Public surfaces:** `/api/auth/*`, `/api/barcode/*`, `/api/vision/*`, `/api/recipes/*`, `/api/party-planner`.
- **Current auth nuance:** the backend currently issues JWTs but does not appear to enforce them on any protected production route; treat token-related findings as latent unless a server route actually consumes identity from them.
- **Usually dev-only / ignore unless proven reachable:** `artifacts/mockup-sandbox/`, coverage artifacts, tests, local build scripts, attached assets.

## Threat Categories

### Spoofing

The app exposes login and registration routes and issues JWTs, so the backend must ensure that any route relying on user identity validates server-issued credentials with a production secret that is never guessable or hardcoded. The client stores tokens locally, so the server must treat every claimed identity as untrusted until verified on each protected request.

### Tampering

All server endpoints must validate request bodies, query params, and route params before using them in database queries, AI prompts, or filesystem operations. Client-side state such as pantry contents, dietary restrictions, and profile data must never be trusted for security decisions because users can modify local storage freely.

### Information Disclosure

The API handles account data, provider credentials, user-submitted images, and AI prompts. Secrets must not be committed to source control, leaked via logs, or exposed in responses. Error paths must avoid disclosing stack traces, raw provider failures, or internal storage details.

### Denial of Service

Several public routes trigger expensive work: AI model calls, large image parsing, barcode lookups, and recipe queries. Production guarantees must ensure that expensive endpoints have effective per-route abuse controls, not just coarse global throttling, so attackers cannot drive excessive model usage, infrastructure load, or cost.

### Elevation of Privilege

If any route exposes user-specific or privileged actions, authorization must be enforced server-side rather than implied by frontend state or possession of unverified client storage. Database access and token handling must avoid patterns that let attackers turn public endpoints into broader access to account or business data.
