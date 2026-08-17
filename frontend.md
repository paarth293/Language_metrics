# Language Metrics — Frontend Design & Build Specification

**Purpose:** This document is the complete frontend blueprint for the Language Metrics platform makeover. It is written so that (a) the company owner can review it and be convinced the product will look world-class, and (b) an engineer can build the entire frontend from it without further design input.

**Status:** Design + implementation spec (no code committed yet — build to follow).
**Design direction (approved):** Bold, modern redesign · premium polished tier · full **light + dark** theming.
**Stack (existing, keep):** Next.js 16 (App Router, React 19) · Tailwind CSS v4 · framer-motion · lucide-react · axios · zod · Prisma (backend already scaffolded).

---

## 0. How to read this document

- **Sections 1–6** define the *design system* — the shared language every screen is built from. Build these first; every page depends on them.
- **Sections 7–13** are the *screen-by-screen* specs (marketing, auth, student, teacher, admin, live class, notifications).
- **Sections 14–18** cover *motion, accessibility, performance, responsiveness, and the demo plan*.
- Anything marked **[DEMO-CRITICAL]** must look flawless for the owner walkthrough. Anything marked **[MOCKABLE]** can run on seeded/fake data for the demo.

---

## 1. Product vision for the frontend

Language Metrics is a two-sided marketplace: **students** discover and book live language classes paid via an in-app coin currency; **teachers** manage availability, deliver sessions, and track earnings; **admins** oversee verification, payments, and analytics.

The frontend must communicate three things instantly:

1. **Trust** — real money and live video are involved. The UI must feel secure, verified, and professional.
2. **Warmth** — language learning is human and cultural. The UI should feel inviting, not sterile.
3. **Momentum** — booking a class should feel effortless and delightful, with clear next steps at every stage.

**Design north star:** the polish of Linear/Vercel/Stripe, the warmth of Duolingo/Preply, and the credibility of a fintech dashboard — unified under one cohesive brand.

---

## 2. Brand & design language

### 2.1 Concept: "Scholar, reimagined"

We keep the recognizable **navy + gold** brand equity (the client likes it) but rebuild it into a bolder, more modern system with a proper dark mode. Gold becomes an *accent used with restraint* (CTAs, highlights, focus), navy becomes the structural anchor in dark mode, and a refreshed neutral scale carries most of the surface area.

### 2.2 Color system (design tokens)

All colors are defined as CSS variables and consumed through Tailwind v4 `@theme`. Every token has a **light** and **dark** value. Never hardcode hex in components — always use a token.

#### Brand / accent (shared across themes)
| Token | Light | Dark | Use |
|---|---|---|---|
| `--brand-gold` | `#c7982f` | `#e0b24a` | Primary accent, CTAs, focus ring |
| `--brand-gold-soft` | `#d8b45e` | `#f0cf7e` | Gradient stops, glows |
| `--brand-gold-pale` | `#edd99a` | `#4a3d1a` | Subtle gold fills / dark gold surfaces |
| `--brand-navy` | `#16223f` | `#16223f` | Logo, deep surfaces |
| `--brand-accent-2` | `#3b6bdb` | `#5a86f5` | Secondary accent (info, links, live) — NEW, adds modern energy |

> **Why a second accent?** A single gold accent reads "classic/editorial." Introducing a controlled electric-blue as a secondary accent (for "live," links, and interactive data-viz) is what pushes the palette from *traditional* to *modern premium* without abandoning the brand.

#### Semantic surfaces & text (theme-aware)
| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#f8f4ea` (warm ivory) | `#0d1424` (deep navy-black) | Page background |
| `--bg-subtle` | `#f2ecdd` | `#131c31` | Secondary background |
| `--surface` | `#ffffff` | `#18233c` | Cards, panels |
| `--surface-2` | `#faf7ef` | `#1e2b48` | Elevated / hovered card |
| `--surface-inset` | `#f2ecdd` | `#0f1728` | Wells, inputs, code |
| `--border` | `rgba(22,34,63,0.10)` | `rgba(248,244,234,0.10)` | Hairlines |
| `--border-strong` | `rgba(22,34,63,0.18)` | `rgba(248,244,234,0.18)` | Emphasized borders |
| `--text` | `#16223f` | `#f3efe4` | Primary text |
| `--text-muted` | `#5a6478` | `#9aa6bd` | Secondary text |
| `--text-subtle` | `#8a93a6` | `#6b7688` | Tertiary / captions |

#### Status colors (theme-aware, WCAG AA on both surfaces)
| Token | Light | Dark |
|---|---|---|
| `--success` | `#0f9d6b` | `#34d399` |
| `--warning` | `#c7982f` | `#e0b24a` |
| `--danger` | `#dc4c4c` | `#f87171` |
| `--info` | `#3b6bdb` | `#5a86f5` |

Each status also has a `-bg` (tinted background) and `-border` variant.

### 2.3 Typography

Keep the current expressive pairing, tighten the scale.

- **Display / headings — `Fraunces`** (variable, optical sizing). Editorial, premium-education feel. Use for h1–h3 and large numbers (stats, coin balance).
- **Body / UI — `Manrope`** (variable). Clean, legible, modern.
- **Script accent — `Caveat`** — decorative only (floating language words, eyebrow flourishes). Never in UI chrome.
- **Numeric / tabular — `Manrope` with `font-variant-numeric: tabular-nums`** for ledgers, prices, timers.

**Type scale** (rem, 16px base):
| Role | Size / line-height | Weight | Font |
|---|---|---|---|
| Display XL (hero) | `clamp(2.75rem, 6vw, 5rem)` / 1.02 | 640 | Fraunces |
| H1 | `2.25rem` / 1.1 | 620 | Fraunces |
| H2 | `1.75rem` / 1.15 | 600 | Fraunces |
| H3 | `1.375rem` / 1.2 | 600 | Fraunces |
| Body-lg | `1.125rem` / 1.6 | 400 | Manrope |
| Body | `1rem` / 1.6 | 400 | Manrope |
| Body-sm | `0.875rem` / 1.5 | 450 | Manrope |
| Caption | `0.75rem` / 1.4 | 500 | Manrope |
| Overline | `0.6875rem` / 1.3, tracking `0.14em`, uppercase | 600 | Manrope |

**Load fonts via `next/font`** (not the current `@import` in globals.css) for zero layout shift and self-hosting — see §16.

### 2.4 Spacing, radius, elevation

- **Spacing scale:** 4px base — `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128`. Section vertical rhythm: `py-20 md:py-28 lg:py-32`. Content max width: `1240px`; text max width: `68ch`.
- **Radius:** `--r-sm: 8px`, `--r-md: 12px`, `--r-lg: 16px`, `--r-xl: 24px`, `--r-2xl: 32px`, `--r-pill: 999px`. Cards use `lg`/`xl`; buttons use `pill`; inputs use `md`.
- **Elevation (theme-aware shadows):** in light mode use soft navy-tinted shadows; in dark mode shadows are near-invisible, so **elevation is expressed through `--surface` lightness + subtle inner borders + optional glow**, not drop shadows.
  - `--shadow-sm`, `--shadow-md`, `--shadow-lg` (light only, navy-tinted)
  - `--glow-gold`, `--glow-blue` (accent glows, used sparingly on primary CTAs / live indicators)

### 2.5 Signature visual motifs (the "wow" layer)

These are what make the redesign feel bold and premium. Use deliberately, not everywhere.

1. **Aurora mesh gradients** — soft, animated multi-stop radial gradients (gold + blue + navy) behind the hero and section headers. Very slow drift. GPU-friendly (`background`, `transform` only).
2. **Glassmorphism panels** — frosted `backdrop-blur` cards over gradient/image backgrounds (hero stat card, live-class controls, floating nav on scroll). Use only where there is something behind to blur.
3. **Grain/noise overlay** — a 3–4% opacity noise texture over large gradient areas to kill banding and add a tactile, premium feel.
4. **Floating language script** — the existing drifting words (`Bonjour`, `你好`, `Namaste`) kept as a low-opacity cultural motif, now parallax-linked to scroll.
5. **Gradient-border cards** — 1px gradient (gold→blue) borders on featured/pricing cards via masked background.
6. **Depth via layered orbs** — blurred color orbs behind content for atmosphere (already present; refine placement + parallax).

---

## 3. Design tokens — reference implementation

Target file: `src/app/globals.css`. Structure (illustrative — build to match):

```css
@import "tailwindcss";
@source "..";

/* Fonts loaded via next/font in layout.tsx — no @import here */

@theme {
  /* brand */
  --color-gold: var(--brand-gold);
  --color-gold-soft: var(--brand-gold-soft);
  --color-navy: var(--brand-navy);
  --color-accent: var(--brand-accent-2);
  /* semantic (mapped to theme vars set on :root / [data-theme=dark]) */
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-border: var(--border);
  --color-text: var(--text);
  --color-text-muted: var(--text-muted);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-danger: var(--danger);
  --color-info: var(--info);

  --font-display: "Fraunces", Georgia, serif;
  --font-body: "Manrope", system-ui, sans-serif;
  --font-script: "Caveat", cursive;

  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;
}

:root {                 /* LIGHT (default) */
  --bg: #f8f4ea;  --bg-subtle: #f2ecdd;
  --surface: #ffffff; --surface-2: #faf7ef; --surface-inset: #f2ecdd;
  --border: rgba(22,34,63,.10); --border-strong: rgba(22,34,63,.18);
  --text: #16223f; --text-muted: #5a6478; --text-subtle: #8a93a6;
  --brand-gold: #c7982f; --brand-gold-soft: #d8b45e; --brand-navy: #16223f;
  --brand-accent-2: #3b6bdb;
  --success:#0f9d6b; --warning:#c7982f; --danger:#dc4c4c; --info:#3b6bdb;
  --shadow-sm: 0 4px 20px -4px rgba(22,34,63,.20);
  --shadow-md: 0 8px 40px -8px rgba(22,34,63,.30);
  --shadow-lg: 0 20px 60px -20px rgba(22,34,63,.50);
  --glow-gold: 0 0 30px rgba(199,152,47,.30);
  color-scheme: light;
}

[data-theme="dark"] {   /* DARK */
  --bg: #0d1424;  --bg-subtle: #131c31;
  --surface: #18233c; --surface-2: #1e2b48; --surface-inset: #0f1728;
  --border: rgba(248,244,234,.10); --border-strong: rgba(248,244,234,.18);
  --text: #f3efe4; --text-muted: #9aa6bd; --text-subtle: #6b7688;
  --brand-gold: #e0b24a; --brand-gold-soft: #f0cf7e;
  --brand-accent-2: #5a86f5;
  --success:#34d399; --warning:#e0b24a; --danger:#f87171; --info:#5a86f5;
  --shadow-sm: none; --shadow-md: 0 8px 40px -12px rgba(0,0,0,.6);
  --shadow-lg: 0 24px 70px -30px rgba(0,0,0,.7);
  --glow-gold: 0 0 40px rgba(224,178,74,.25);
  color-scheme: dark;
}
```

**Rule:** components reference semantic tokens (`bg-surface`, `text-muted`, `border-border`) so they work in both themes with zero per-component branching.

---

## 4. Theming: light / dark implementation

- **Mechanism:** `data-theme="light|dark"` on `<html>`. Default respects `prefers-color-scheme`; user choice persisted in `localStorage` under `lm-theme`.
- **No-flash:** inline a tiny blocking script in `layout.tsx` `<head>` that sets `data-theme` before paint (reads localStorage → falls back to media query). Prevents the white flash on load.
- **Toggle UI:** a segmented `Sun / Moon / Auto` control in the top-right of the navbar (marketing) and in the app top bar (dashboards). Animated icon crossfade + 200ms color transition on `:root` (transition `background-color`/`color` only; never transition `all`).
- **Theme context:** a light `ThemeProvider` (React context) exposing `theme` + `setTheme`, wrapping the app in `layout.tsx` alongside the existing `AuthProvider`.
- **Images/illustrations:** provide dark-appropriate variants or use CSS `filter`/opacity for decorative art. Screenshots in marketing use `<picture>` with theme-matched sources.

---

## 5. Component library (design system)

Build a proper primitives layer in `src/components/ui/` so every screen is consistent. Each component supports both themes automatically via tokens. Suggested inventory:

### 5.1 Primitives (atoms)
- **Button** — variants: `primary` (navy fill / gold-on-dark), `gold` (accent CTA), `outline`, `ghost`, `danger`; sizes `sm/md/lg`; states: hover-lift, `active:scale-[.98]`, `:focus-visible` gold ring, loading (spinner + disabled), icon-left/right. Pill radius.
- **Input / Textarea / Select** — floating or top label, helper text, error text, success check, prefix/suffix slots, `--surface-inset` fill, gold focus ring.
- **Badge / Pill** — status (success/warning/danger/info/neutral) + count variant. Replaces/extends existing `StatusBadge`.
- **Avatar** — image, initials fallback, size scale, optional online dot, optional country-flag corner.
- **Tag / Chip** — filter chips (selectable), language tags.
- **Icon** — `lucide-react` only, sizes 16/20/24.
- **Skeleton** — shimmer blocks (theme-aware) for loading states.
- **Spinner** — inline + full-page.
- **Tooltip**, **Divider**, **Kbd**, **ProgressBar**, **Rating (stars)**, **CoinAmount** (gold coin glyph + tabular number).

### 5.2 Molecules
- **Card** (`surface`, hover-lift, optional gradient border), **StatCard** (icon + big number + label + delta), **EmptyState** (icon + title + subtext + action), **Toast** (success/error/info, stacked, auto-dismiss), **Modal / Dialog** (focus-trapped, backdrop blur), **Drawer / Sheet** (mobile filters, notifications), **Tabs**, **Accordion**, **Pagination**, **SearchBar** (with recent + suggestions), **DateTime / TimezonePicker**, **FileDropzone** (teacher docs/materials), **Stepper** (multi-step forms & booking).
- **DataTable** — sortable, filterable, paginated, sticky header, row actions, responsive → cards on mobile (used heavily in admin).

### 5.3 Organisms / layout
- **MarketingNav** (transparent → frosted-on-scroll, theme toggle, auth-aware).
- **AppShell** — persistent left **Sidebar** (collapsible, role-aware nav) + **TopBar** (search, notifications bell, theme toggle, avatar menu). One shell reused by student/teacher/admin with different nav items. Mobile: sidebar → bottom tab bar or slide-in drawer.
- **Footer** (marketing).
- **NotificationCenter** (dropdown + full page).
- **CommandPalette** (⌘K) — optional but high-"wow": quick nav + search teachers.

> **Consolidation note:** the current code has three near-identical hand-rolled sidebars (student/teacher/admin dashboards). Replace all three with **one `<AppShell>`** driven by a role→nav config. This is both a quality and a performance/maintenance win.

---

## 6. Iconography, imagery & illustration

- **Icons:** `lucide-react` exclusively, 1.75px stroke, sizes 16/20/24. No emoji in product chrome (emoji allowed only in playful marketing microcopy).
- **Country/language flags:** a consistent flag set (rounded-square) for language tags, teacher cards, and the marquee.
- **Photography:** teacher avatars real (or high-quality seeded portraits for demo). Marketing uses warm, authentic classroom/1-on-1 imagery with a subtle duotone (navy shadows / gold highlights) to unify.
- **Illustration:** light custom line-art (globe, speech bubbles, coins) for empty states and onboarding, tinted with theme tokens.
- **OG/meta images:** branded social cards per key route.

---

## 7. Marketing / landing pages [DEMO-CRITICAL]

Route group: `src/app/(public)/`. Keep the section order but rebuild each for the bold, dual-theme look.

### 7.1 Global marketing chrome
- **Navbar:** transparent over hero → frosted glass (`backdrop-blur`, `bg-surface/80`) on scroll. Links: For Students, For Teachers, How It Works, Pricing. Right: theme toggle, Sign in, **Get Started** (gold CTA). Auth-aware (Dashboard + Sign out when logged in). Mobile: full-screen sheet.
- **Footer:** multi-column (Product, For Teachers, Company, Legal), language marquee strip, socials, theme-aware, newsletter input, trust/compliance line (DPDP, secure payments via Razorpay).

### 7.2 Hero
- Full-viewport, **aurora mesh gradient + grain + floating script words** (parallax on scroll). Left-weighted or centered composition.
- Eyebrow (script accent) → **Display XL headline** ("Find your perfect language teacher — and actually book them in minutes"). Gold gradient on a key phrase.
- Sub-headline (1–2 lines). Primary CTA **Find a Teacher** (gold), secondary **Teach on Language Metrics** (outline).
- **Floating glass "proof" card**: mini teacher card + "Booked a French demo · ₹49 · starts in 10 min" — hints at the product's real UI.
- Trust row: Verified Teachers · Custom Video · Secure Payments · Rated 4.9/5.
- Scroll indicator. Entrance: staggered fade-up (framer-motion, 0.3–0.7s, ease `[0.2,0.8,0.2,1]`).

### 7.3 Supporting sections (rebuild existing)
1. **StatsBar** — animated count-up (teachers, languages, classes delivered, avg rating). Tabular nums.
2. **LanguageMarquee** — infinite dual-row flag+name marquee, pauses on hover; each chips links to filtered discovery.
3. **HowItWorks** — 3–4 step horizontal timeline (Discover → Book → Pay with coins → Join live). Scroll-linked progress line; illustrated.
4. **Features** — bento grid (mixed tile sizes): verified teachers, custom LiveKit video, coin wallet, timezone-smart scheduling, ratings, materials. Gradient-border on the headline tile.
5. **TeacherSpotlight** — carousel/grid of featured teacher cards (avatar, flag, rating, languages, price/coins, "Book demo"). [MOCKABLE with seed data]
6. **Pricing / Coins** — coin package cards (₹→coins, bonus tiers), demo-class ₹49 highlight, "most popular" gradient-border card, FAQ accordion.
7. **CTASection** — full-bleed navy/gradient band with grain, dual CTA. Dark-mode: brighter gradient.

### 7.4 SEO & performance
- Marketing pages are **Server Components** (static/ISR) for fast first paint + SEO. Client interactivity (marquee, count-up, nav) isolated into small `"use client"` leaves. Per-route `metadata`, JSON-LD (`Organization`, `Course`), sitemap, robots.

---

## 8. Authentication & onboarding

Routes: `src/app/login`, `src/app/register/student`, `src/app/register/teacher`, plus `verify-email`, `forgot-password`, `reset-password`.

### 8.1 Layout
- **Split-screen** on desktop: left = form (`surface`), right = branded panel (aurora gradient + rotating testimonial/value props + floating script). Single column on mobile. Consistent across all auth screens.
- Theme toggle present. Logo top-left links home.

### 8.2 Screens
- **Login** — email + password (show/hide), "remember me", forgot-password link, primary CTA, optional Google OAuth button, link to register. Inline field validation + top error banner for auth failures. Rate-limit-aware messaging.
- **Register – Student** — name, email, password (strength meter), language to learn (searchable select w/ flags), proficiency level (segmented), timezone (auto-detected, editable). **Success animation** (check draw) → redirect to student dashboard/onboarding.
- **Register – Teacher** — multi-step **Stepper**: (1) account basics, (2) languages taught + hourly rate in coins, (3) experience type + bio, (4) document upload (education/proficiency cert via FileDropzone), (5) review & submit. Clear "what happens next" (review → interview → ₹399 activation on approval). Progress persisted between steps.
- **Verify email / reset password** — minimal centered card, clear status, resend w/ cooldown timer.

### 8.3 Form UX standards (apply everywhere)
- Labels always visible; helper text under field; errors inline + red border + icon; success = green check.
- zod schemas power both client and server validation (shared where possible).
- Disabled submit until valid; loading state on submit; never lose entered data on error.

---

## 9. Student experience [DEMO-CRITICAL]

App shell (Sidebar: Discover, My Classes, Wallet, Messages, Profile). This is the core demo path: **Discover → Teacher profile → Book → Pay with coins → Join live class.**

### 9.1 Discover / search
- **Filter rail** (left on desktop, drawer on mobile): language (flag chips), price/coin range slider, rating, availability (today / this week / time-of-day), teacher type, sort (relevance, price, rating, soonest available).
- **Search bar** with suggestions + recent searches; URL-synced filters (shareable).
- **Results grid** of **TeacherCard**s: avatar + online dot, name, country flag(s), languages, star rating + review count, coins/hour, next-available badge, "Book demo ₹49" + "View profile." Hover-lift, gradient border on featured.
- **States:** skeleton grid while loading; rich empty state (adjust filters); infinite scroll or pagination; "X teachers found" live count.

### 9.2 Teacher profile
- **Header:** large avatar, name, flags, rating, languages, verified badge, coins/hour, "Book a class" sticky CTA (sticky on scroll / bottom bar on mobile).
- **Body tabs/sections:** About/bio, languages & levels, intro video (LiveKit thumbnail or upload), reviews (rating breakdown + individual reviews), materials preview.
- **Availability widget:** timezone-aware calendar/slot picker (renders UTC slots in the student's local tz), highlights open slots, shows buffer.

### 9.3 Booking flow [DEMO-CRITICAL]
A guided **multi-step modal / dedicated route** with a **Stepper**:
1. **Select slot** — calendar + time list, tz shown explicitly, duration, price in coins. Slot is held (5-min TTL) — show a **countdown** "slot reserved for 4:59."
2. **Review** — teacher, date/time (local + teacher tz), duration, coins to be debited, cancellation policy summary.
3. **Pay** — coin balance shown; if sufficient → "Confirm & pay N coins"; if insufficient → inline **top-up** (Razorpay coin packages) without leaving the flow.
4. **Confirmation** — success animation, add-to-calendar (.ics/Google), "Join opens 10 min before," link to My Classes.
- **Failure/edge states:** slot expired (re-select), payment failed (retry), double-book prevented (server 409 → friendly "just got taken" message).

### 9.4 Coin wallet [DEMO-CRITICAL]
- **Balance hero card** — big tabular coin number + gold coin glyph, "Buy coins" CTA, `--glow-gold` accent.
- **Coin packages** — cards (₹→coins + bonus tiers), Razorpay Checkout launch (test mode for demo).
- **Transaction ledger** — DataTable: type (Purchase / Debit-Booking / Refund / Admin-Grant) with colored badges, amount (+/− colored), reference, date, running balance. Filter + export. This mirrors the immutable `CoinTransaction` ledger.
- **Receipts** — per-purchase receipt view/download.

### 9.5 My Classes dashboard
- Redesign current placeholder dashboard into a real hub:
  - **Welcome header** with language + level + streak.
  - **Next class card** — countdown, teacher, **Join** button (enabled in the join window), reschedule/cancel.
  - **Tabs:** Upcoming · Past · Cancelled — each a list of **BookingCard**s (status badge, teacher, time, coins, actions).
  - **Stats:** classes booked, hours learned, avg rating given, coins spent — real data, animated.
  - Rich empty states → funnel back to Discover.

### 9.6 Live class join screen → in-call → see §12.

### 9.7 Ratings & reviews
- Post-class prompt (modal or dedicated screen): star rating + optional comment + quick tags ("Patient," "Great accent"). Optimistic UI + toast.

### 9.8 Profile
- Avatar upload, name, bio, languages/levels, timezone, notification preferences, account (deactivate/delete + data export per DPDP), theme preference.

---

## 10. Teacher portal

App shell (Sidebar: Dashboard, Schedule/Availability, Bookings, Students, Earnings, Materials, Profile). Rebuild current single-page dashboard into a full portal.

### 10.1 Dashboard
- Verification-status banner (pending/approved/rejected) — keep the real-status logic, restyle to the new system.
- **StatCards:** earnings (coins → ₹ payout), classes taught, upcoming today, active students, rating. Real/animated.
- **Today's schedule** timeline + **next class** join card.
- Approved teachers see setup checklist (set availability, add bio, upload intro video) with progress ring.

### 10.2 Availability calendar [feature-rich]
- Week/month calendar, drag-to-create slots, recurring rules, buffer between sessions, **timezone-aware** (store UTC, render local). Blocked/booked slots visually distinct. Mobile: agenda list + quick-add.

### 10.3 Bookings & students
- **Bookings:** upcoming/past/cancelled lists, request handling, cancel/reschedule (policy-aware), attendance status.
- **Student roster:** DataTable of students, session history per student, notes.

### 10.4 Earnings
- Coins-earned → payout tracking, payout history, conversion rate display, exportable statement, simple earnings chart (theme-aware).

### 10.5 Materials
- Upload/manage session materials (FileDropzone), attach to sessions, preview list.

### 10.6 Profile & rates
- Edit bio/languages/rate (changes flagged for admin approval per spec), intro video, public-profile preview.

---

## 11. Admin portal

App shell (Sidebar: Overview/Analytics, Verification Queue, Users, Bookings, Payments & Ledger, Disputes, Content, Audit Log). The verification queue exists — expand into a full admin suite; heavy use of **DataTable**.

### 11.1 Analytics overview [DEMO-CRITICAL — impresses the owner]
- KPI **StatCards:** DAU, signups, bookings, revenue, active teachers, coin float.
- **Charts** (theme-aware, lazy-loaded): signups trend, revenue trend, bookings by language, DAU line. Use a lightweight charting lib (see §17). Date-range picker.
- Recent activity feed + alerts (spike in refunds/grants/failed logins).

### 11.2 Verification queue (evolve existing)
- Keep summary stats + status filters + approve/reject, restyle to new system. Add: detail drawer (documents, bio, interview notes), bulk actions, search.

### 11.3 Users, bookings, payments
- **Users:** searchable DataTable (role, status, verified), suspend/verify, detail view.
- **Bookings oversight:** all bookings, filters, manual cancel/refund.
- **Payments & coin ledger:** full audit trail (from `CoinTransaction` + `Payment`), exportable, refund action (writes AuditLog).
- **Manual coin grant:** modal (amount + reason) → always logged.

### 11.4 Disputes, content moderation, audit log
- Dispute/refund queue; review moderation (bios, photos, reported users); immutable **audit log** viewer (actor, action, target, metadata, timestamp) with filters.

---

## 12. Live class (LiveKit) UI [DEMO-CRITICAL — the differentiator]

Route: `src/app/(student|teacher)/session/[bookingId]/`. Two states: **lobby** → **in-call**.

### 12.1 Pre-join lobby
- Camera/mic preview, device selector, mic level meter, blur/background toggle, "Join" (enabled only in the allowed window: 10 min before → end). Shows class info + other participant.

### 12.2 In-call
- **Video stage:** speaker/grid layout, rounded video tiles, name + mute indicators, connection-quality dot, active-speaker gold ring.
- **Control bar (glass, floating):** mic, camera, screen share, chat toggle, participants, layout switch, **leave** (red). `--glow-blue` "LIVE" indicator + session timer (counts down to end).
- **Side panel (drawer):** chat (LiveKit data channel), participants, shared materials.
- **Screen share** takes the stage; self-view shrinks to PiP.
- **Post-call:** thank-you screen → rating prompt (student) / session summary (teacher).
- **States:** connecting, reconnecting (banner), permission-denied guidance, "class hasn't started"/"class ended" gates, network-degraded fallback (audio-only).
- **Security note (UI reflects it):** join button only calls the server token endpoint; UI never holds LiveKit secrets. Room names are opaque UUIDs, never shown as guessable IDs.

> For the demo this can run against a LiveKit test room / a mocked two-participant scene so the owner sees the full in-call experience end to end. **[MOCKABLE]**

---

## 13. Notifications

- **Bell in TopBar** with unread count → dropdown of recent items (booking confirmed, reminder, payment receipt, teacher approved, review request), each with icon, text, timestamp, deep link. "Mark all read," link to full **Notification Center** page (grouped by date, filters).
- **Toasts** for in-session events (payment success, slot expiring, errors).
- Reminder cues (24h / 1h before class) surfaced on dashboard + notifications.

---

## 14. Motion & micro-interactions

- **Library:** framer-motion. Durations 0.15–0.6s; easing `[0.2, 0.8, 0.2, 1]`. Motion reinforces hierarchy, never blocks input.
- **Patterns:** page/section entrance fade-up (staggered), card hover-lift, button `active:scale-[.98]`, input label float, count-up stats, success check-draw (booking/registration), skeleton→content crossfade, modal/drawer spring-in, marquee, aurora drift, parallax on hero motifs.
- **Live indicators:** pulsing dot for "LIVE," countdown timers with subtle tick.
- **Respect `prefers-reduced-motion`:** disable non-essential animation, keep opacity fades only. This is a hard requirement.

---

## 15. Accessibility (WCAG 2.1 AA — non-negotiable)

- **Contrast:** all text meets AA on both themes (verify muted text especially; the spec previously flagged low-contrast `cream/40`).
- **Keyboard:** every interactive element focusable & operable; visible gold `:focus-visible` ring; logical tab order; skip-to-content link.
- **Focus management:** modals/drawers trap focus + restore on close; ⌘K palette accessible.
- **Semantics:** proper landmarks, headings, labels, `aria-*` on custom widgets (tabs, accordions, sliders, calendar), `aria-live` for toasts/async results.
- **Forms:** label association, error `aria-describedby`, `aria-invalid`.
- **Media:** captions/transcripts where applicable; controls labeled.
- **Motion & color:** reduced-motion honored; never encode meaning by color alone (pair with icon/text).
- **Target size:** ≥44px touch targets on mobile.

---

## 16. Performance & optimization strategy

Targets: **Lighthouse ≥ 95** (perf/best-practices/SEO/a11y) on marketing; **LCP < 2.0s, CLS < 0.05, INP < 200ms**; initial route JS well under budget.

- **RSC-first:** marketing + as much of the app as possible as Server Components; push `"use client"` to small interactive leaves (nav, marquee, forms, charts, live call). The current dashboards are fully client-side — split data-fetch (server) from interactivity (client).
- **Fonts:** migrate from CSS `@import` to **`next/font`** (self-hosted, `display: swap`, preloaded, subset). Eliminates render-blocking font requests + layout shift.
- **Images:** `next/image` everywhere (AVIF/WebP, responsive `sizes`, lazy below fold, blur placeholders). Compress marketing photography; serve theme-matched via `<picture>`.
- **Code-splitting:** `next/dynamic` for heavy/rare UI (charts, calendar, LiveKit room, command palette, modals). Never ship the video SDK on the marketing bundle.
- **Data & caching:** ISR/static for marketing; cache teacher search results (SWR/React Query optional) with skeletons; debounce search; URL-synced filters. Optimistic UI for ratings/cancel.
- **Rendering discipline:** memoize expensive lists, virtualize long tables/ledgers, avoid layout thrash, animate only `transform`/`opacity`.
- **Assets:** grain/noise as tiny tiled asset or CSS, not large PNGs; SVG icons; tree-shake `lucide-react` (named imports).
- **CSS:** Tailwind v4 JIT; purge unused; token-driven so no duplicate style blocks; remove the three duplicated sidebar implementations (AppShell).
- **Monitoring:** wire Web Vitals reporting; Sentry (frontend) for errors; bundle-analyzer in CI budget.
- **Third-party:** load Razorpay Checkout script on-demand (only in wallet/booking-pay); LiveKit only on session routes.

---

## 17. Recommended libraries (additions)

Keep the stack lean; add only what earns its weight:
- **Charts:** `recharts` or `visx` (lazy-loaded) for admin/earnings — theme-aware via CSS vars.
- **Data/tables:** `@tanstack/react-table` (+ optional `react-virtual`) for ledgers/admin.
- **Calendar/slots:** build on `date-fns` + a lightweight calendar, timezone-aware (UTC store, local render).
- **Data fetching (optional):** `@tanstack/react-query` or `swr` for caching search/dashboards.
- **Live video:** `@livekit/components-react` + `livekit-client` (session routes only).
- **Payments:** Razorpay Checkout (dynamic script).
- **Utilities already present:** `clsx`, `tailwind-merge`, `framer-motion`, `lucide-react`, `zod`.
- **Toasts:** `sonner` (or small custom) — theme-aware.

> Every addition must be code-split and justified against bundle budget. Do not add a UI kit that fights the custom design system.

---

## 18. File / folder structure (frontend)

Build on the existing `src/` layout, add a real design-system layer:

```
src/
├── app/
│   ├── (public)/            # marketing (RSC, ISR) — home, pricing, about
│   ├── login/  register/    # auth (split-screen)
│   ├── (student)/           # discover, teacher/[id], booking, wallet, my-classes, session/[id], profile
│   ├── (teacher)/           # dashboard, availability, bookings, students, earnings, materials, profile
│   ├── (admin)/             # overview, verification, users, bookings, payments, disputes, audit
│   ├── layout.tsx           # fonts (next/font) + ThemeProvider + AuthProvider + no-flash script
│   └── globals.css          # tokens (light+dark) + base + primitive utilities
├── components/
│   ├── ui/                  # design-system primitives (Button, Input, Card, Badge, Modal, DataTable, ...)
│   ├── layout/              # MarketingNav, Footer, AppShell (Sidebar+TopBar), NotificationCenter
│   ├── home/                # marketing sections (rebuilt)
│   ├── student/ teacher/ admin/   # feature composites
│   └── live/                # LiveKit lobby + in-call
├── hooks/                   # use-auth, use-theme, use-toast, use-media-query, ...
├── lib/                     # api client, theme, formatters (coins, tz, dates)
└── types/  validators/      # shared TS types + zod schemas
```

---

## 19. Demo plan — the owner walkthrough [DEMO-CRITICAL]

A scripted "golden path" that proves the whole product, runnable on seeded data:

1. **Landing** — load in light, toggle to **dark** live (instant "wow"), scroll through hero → stats → how-it-works → features → teacher spotlight → pricing.
2. **Sign up as student** — quick, polished form + success animation.
3. **Discover** — filter by language, see teacher cards, open a **teacher profile**.
4. **Book a demo class** — stepper, slot hold countdown, **buy coins** (Razorpay test), pay, confirmation + add-to-calendar.
5. **My Classes** — next-class card with countdown → **Join** → **live call** (lobby + in-call with a second seeded participant) → leave → rate.
6. **Teacher portal** — availability calendar, bookings, earnings dashboard.
7. **Admin portal** — analytics dashboard (charts), verification queue approve/reject, coin ledger + manual grant (audit log entry appears).
8. Toggle theme again anywhere to show it holds across every screen.

**Seed data** to prepare: ~12 teachers (avatars, languages, ratings, availability), a few students, sample bookings/transactions/reviews, one live session. Mark clearly which flows are mocked vs live so the owner understands scope.

---

## 20. Build order (recommended)

1. **Design system + theming** (§2–6, §14–15): tokens, light/dark, `next/font`, primitives, AppShell. *Everything depends on this.*
2. **Marketing rebuild** (§7) — biggest first impression, mostly static/fast.
3. **Auth + AppShell shells** (§8).
4. **Student core path** (§9) — discover → profile → booking → wallet → my-classes. *The demo spine.*
5. **Live class UI** (§12).
6. **Teacher portal** (§10).
7. **Admin portal + analytics** (§11).
8. **Notifications, polish, a11y + performance pass** (§13, §15, §16).

---

## 21. Definition of done (frontend)

- [ ] Every screen works in **light and dark** with no hardcoded colors (tokens only).
- [ ] One shared **design system** + one **AppShell** (no duplicated sidebars).
- [ ] All states covered per screen: loading (skeleton), empty, error, success.
- [ ] Fully **responsive** (mobile bottom-nav / drawers, tablet, desktop).
- [ ] **WCAG AA** verified; `prefers-reduced-motion` honored; keyboard-complete.
- [ ] **Lighthouse ≥ 95** on marketing; LCP < 2.0s, CLS < 0.05, INP < 200ms.
- [ ] Fonts via `next/font`; images via `next/image`; heavy modules code-split.
- [ ] Booking, wallet, and live-call flows demoable end-to-end on seed data.
- [ ] Theme choice + auth state persist correctly; no flash of wrong theme.
```
