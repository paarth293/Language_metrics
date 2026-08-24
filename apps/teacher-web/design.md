# Language Metrics Teacher Web - Design Specification

This document defines the design system and screen layout for the Language Metrics teacher-web application. It captures the "Scholar, reimagined" premium identity and is structured for design system implementation and generation tools.
k


## Design System

### 1. Tokens

#### Colors (Light & Dark Themes)
- **Brand Gold**: `--brand-gold` (#c7982f light / #e0b24a dark) - Primary accent, CTAs, focus rings
- **Brand Navy**: `--brand-navy` (#16223f light / #16223f dark) - Deep surfaces, primary buttons in light mode
- **Brand Accent 2**: `--brand-accent-2` (#3b6bdb light / #5a86f5 dark) - Info, links, live indicators
- **Background**: `--bg` (#f8f4ea ivory / #0d1424 deep navy-black)
- **Surface**: `--surface` (#ffffff light / #18233c dark) - Cards and panels
- **Surface Inset**: `--surface-inset` (#f2ecdd light / #0f1728 dark) - Wells, inputs
- **Text**: `--text` (#16223f light / #f3efe4 dark) - Primary text
- **Text Muted**: `--text-muted` (#5a6478 light / #9aa6bd dark)
- **Status Colors**:
  - Success: `--success` (#0f9d6b / #34d399)
  - Warning: `--warning` (#c7982f / #e0b24a)
  - Danger: `--danger` (#dc4c4c / #f87171)
  - Info: `--info` (#3b6bdb / #5a86f5)

#### Typography
- **Display/Headings**: `Fraunces` (Warm, premium education, editorial feel)
- **Body/UI**: `Manrope` (Clean, highly legible, modern)
- **Script Accent**: `Caveat` (Decorative floating language words only)
- **Tabular**: `Manrope` with tabular-nums for ledgers, prices, timers.

#### Spacing, Radius, & Elevation
- **Radius**: `--radius-md` (12px), `--radius-lg` (16px), `--radius-xl` (24px), pill (999px) for buttons.
- **Elevation**: Light mode uses soft navy-tinted shadows (`shadow-sm`, `shadow-md`, `shadow-lg`). Dark mode removes drop shadows, using surface lightness and accent glows (`--glow-gold`, `--glow-blue`).

### 2. Components

- **Button**: Variants include `primary` (navy/gold), `gold`, `outline`, `ghost`. Pill radius, hover lift `active:scale-[.98]`, gold `:focus-visible` ring.
- **Card**: `surface` background, hover-lift. Specialized variants: `StatCard` (icon + big number), `TeacherCard` (avatar + flags + rating).
- **Input**: Floating or top label, inset fill `--surface-inset`, gold focus ring. Includes inline validation states (green check / red border).
- **StatusBadge**: Semantic pill component for pending/approved/rejected states, utilizing status colors.
- **Avatar**: Rounded image with optional online dot or country flag corner.
- **AppShell**: Reusable layout wrapper used across all dashboards. Includes a persistent left Sidebar (collapsible) and TopBar (search, notifications, theme toggle).

---

## Screens & Layouts

### 1. Marketing Landing Page
- **Global Chrome**: Transparent navbar over hero that transitions to frosted glass (`backdrop-blur`) on scroll. Multi-column footer.
- **Hero**: Full viewport with aurora mesh gradient (gold/blue/navy), subtle grain noise, and floating script words. Large Fraunces headline, gold primary CTA button, and a floating glass "proof" card.
- **Feature Sections**: StatsBar (animated count-up), LanguageMarquee (flag chips), Bento grid of features with gradient-border highlights on key tiles.

### 2. Authentication (Login & Register)
- **Layout**: Split-screen on desktop. Left side is the form on a clean `surface`. Right side is a branded panel with aurora gradient, rotating testimonials, and floating script.
- **Components**: Inputs with inline validation. Multi-step **Stepper** for the teacher registration flow (Basics -> Languages/Rates -> Experience -> Documents).

### 3. Student Experience
- **Discover / Search**: Left filter rail (language flags, price slider, availability). Results grid of `TeacherCard`s showing avatar, rating, price, and a "Book demo" CTA.
- **Teacher Profile**: Header with large avatar, verified badge, and timezone-aware availability calendar widget.
- **Booking Flow**: A guided multi-step modal. (1) Select slot with 5-min hold countdown, (2) Review, (3) Pay with coins (with inline top-up), (4) Confirmation.
- **Wallet**: Big tabular coin balance, coin package cards, and a `DataTable` transaction ledger.
- **My Classes**: Next class card with a countdown and a "Join" button. Tabs for Upcoming / Past / Cancelled.

### 4. Teacher Portal
- **Dashboard**: Verification status banner. `StatCards` for earnings, classes taught, and active students. Today's schedule timeline.
- **Availability Calendar**: Week/month view with drag-to-create slots, timezone-aware rendering, highlighting open vs. booked slots.

### 5. Admin Portal
- **Overview Analytics**: KPI `StatCards` (DAU, revenue) and lazy-loaded theme-aware charts for trends.
- **Verification Queue**: `DataTable` with summary stats, status filters, and approve/reject actions. Detail drawer for documents.
- **Ledgers**: Sortable, filterable tables for users, bookings, and coin transactions.

### 6. Live Class (LiveKit)
- **Lobby**: Camera/mic preview, device selector, mic level meter.
- **In-Call Stage**: Video grid layout with rounded tiles. Active speaker has a gold ring.
- **Control Bar**: Floating frosted glass panel with mic, camera, screen share, and leave buttons. Includes a `--glow-blue` LIVE indicator and countdown timer.
- **Side Panel**: Drawer for chat (data channel) and participants.
