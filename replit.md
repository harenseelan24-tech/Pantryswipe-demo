# PantrySwipe

AI-powered cooking ecosystem — Tinder-style recipe swipe discovery, smart pantry management, meal planner, social feed, AI chef chat, party planner, gamification, and notifications.

## Run & Operate

- `pnpm --filter @workspace/pantryswipe run dev` — run the Expo mobile app (via workflow)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo SDK 54, expo-router v6, React Native 0.81
- State: React Context + AsyncStorage (frontend-only, no backend DB needed)
- Gestures: PanResponder (NOT gesture-handler) for swipe cards
- UI: @expo/vector-icons (Feather), react-native-reanimated, expo-haptics
- API server: Express 5, Drizzle ORM (unused for main app flow)

## Where things live

- `artifacts/pantryswipe/` — Expo mobile app (all app logic)
- `artifacts/pantryswipe/app/` — Expo Router screens
- `artifacts/pantryswipe/app/(tabs)/` — 5-tab navigation (Home, Pantry, Planner, Social, Profile)
- `artifacts/pantryswipe/context/AppContext.tsx` — global app state (pantry, recipes, profile, stats)
- `artifacts/pantryswipe/data/mockData.ts` — all recipe, pantry, social mock data
- `artifacts/pantryswipe/components/SwipeCard.tsx` — Tinder-style swipe card (PanResponder)
- `artifacts/pantryswipe/constants/colors.ts` — brand palette (light + dark)
- `artifacts/api-server/` — Express API server (unused for core features currently)

## Brand Colors

- Saffron (primary): #F5A623
- Herb Green (secondary): #4CAF76
- Skip Red: #E84040
- Save Blue: #5B8EF5
- Light Background: #FAFAF8
- Dark Background: #141210

## Navigation Flow

- First launch: `/` → checks AsyncStorage → `/welcome` → `/onboarding` → `/(tabs)`
- Return user: `/` → checks AsyncStorage → `/(tabs)` directly
- Stack screens: welcome, onboarding, recipe/[id], ai-chef, party-planner, notifications

## Architecture Decisions

- Frontend-only: All state lives in AsyncStorage via AppContext. No DB or server required for the app to function.
- PanResponder for swipes: Using React Native's PanResponder (not gesture-handler) as required by expo skill guidelines.
- Mock AI: AI Chef uses pattern-matched mock responses; can be wired to real LLM API via the api-server in a follow-up.
- Expo Router file-based routing with tab groups; NativeTabs on iOS 26+ (liquid glass), classic BlurView tabs otherwise.
- Image assets: Static require() at bundle time — all images must exist before Metro bundling.

## Product

- **Discover**: Tinder-style recipe swipe deck. Swipe right to cook, left to skip, up to save. Shows pantry match %.
- **Pantry**: Ingredient management with categories, expiry tracking, AI suggestions, pantry intelligence.
- **Planner**: Weekly meal plan grid with auto-generation, nutrition summary, shopping list CTA.
- **Social**: Instagram-style food social feed with likes, saves, recipe links, discovery tabs.
- **Profile**: User stats, cooking streak, XP/level system, achievement badges, saved/cooked recipe grids.
- **AI Chef**: Chat interface with pantry-aware mock responses and quick prompt chips.
- **Party Planner**: Multi-step wizard for event type, guest count, serving style, budget; generates full menu + timeline.
- **Cook Mode**: Full-screen step-by-step guided cooking with integrated timers.

## User Preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- All image assets used via `require()` must exist on disk before Metro bundling — create placeholders if needed.
- recipe-bowl.png was temporarily replaced with recipe-salmon.png as a placeholder (regenerate when available).
- useNativeDriver warnings on web are expected (web doesn't support native animations).
- shadow* style deprecation warnings on web are expected (use boxShadow for web).
- The `app/index.tsx` root guard checks AsyncStorage to route first-time vs. returning users.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `expo` skill for Expo-specific guidelines
