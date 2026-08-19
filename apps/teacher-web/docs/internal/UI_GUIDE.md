# Language Metrics — UI Guide & Refinement Plan

This document captures the current design system and the concrete refinements applied (and
recommended) to make the product look more professional, market-standard, and clearly tied to the
language-learning domain — **while keeping the template the client already likes**.

---

## 1. Design language (the identity we're keeping)

**Palette — "Ivory & Navy Scholar"** (tokens in `app/globals.css` `@theme`):

| Token | Hex | Use |
|-------|-----|-----|
| `navy` | `#16223f` | Primary text, dark panels, primary button |
| `navy-2` / `navy-light` | `#1e2f52` / `#2a3f6f` | Hover/elevated navy surfaces |
| `gold` | `#c7982f` | Accent, CTAs, highlights, focus rings |
| `gold-soft` / `gold-pale` | `#d8b45e` / `#edd99a` | Gradients, glows |
| `cream` / `cream-2` / `cream-3` | `#f8f4ea` … | Page & card backgrounds |
| `muted` | `#5a6478` | Secondary text |

**Type system:**
- **Fraunces** (`font-display`) — headings. Warm, editorial, "premium education" feel.
- **Manrope** (`font-body`) — body/UI. Clean, highly legible.
- **Caveat** (`font-script`) — decorative floating language words only. Use sparingly.

**Motion:** framer-motion for entrance fades/slides; keep durations 0.3–0.7s and easing
`[0.2, 0.8, 0.2, 1]`. Motion should reinforce hierarchy, never distract.

---

## 2. Reusable patterns (use these instead of one-off styles)

- **Buttons:** `.btn-primary`, `.btn-gold`, `.btn-outline`, `.btn-outline-cream` — all pill-shaped
  with a lift-on-hover. Now include a **`:focus-visible` gold ring** for keyboard accessibility.
- **Cards:** `.lang-card` (hover lift), `.glass-card` (light glass), `.glass-dark` (on navy).
- **Inputs:** `.input-field` — consistent border, gold focus ring.
- **Status pill:** `components/ui/StatusBadge.tsx` — single source of truth for
  pending / approved / rejected states (teacher dashboard + admin queue).
- **Shadows:** `shadow-navy-sm|md|lg`, `shadow-gold-glow`. Prefer these over ad-hoc box-shadows.

---

## 3. What was refined in this pass

1. **Auth state everywhere** — the Navbar is now role-aware: signed-in users see **Dashboard** +
   **Sign out** (routed by role) instead of Sign in / Get Started. Removes the "logged in but the
   site acts logged out" feeling that reads as unfinished.
2. **Dashboards show real data** — student dashboard shows the actual language + proficiency; teacher
   dashboard drives its banner from the **real verification status** (pending/approved/rejected)
   instead of a hardcoded "pending" notice.
3. **New Admin panel** (`/admin/dashboard`) — a clean verification queue with summary stats, status
   filters, and Approve/Reject actions, styled with the same tokens so it feels native.
4. **Consistent status system** — one `StatusBadge` component; semantic colors (amber pending,
   emerald approved, red rejected) added alongside the navy/gold identity.
5. **Accessibility** — visible keyboard focus rings on all buttons/links/inputs.

---

## 4. Recommended next refinements (to reach top-tier polish)

These keep the template but raise perceived quality — prioritized:

1. **Spacing & rhythm audit** — standardize section vertical padding (e.g. `py-20 md:py-28`) and a
   max content width (`max-w-[1240px]`) across all landing sections for a calmer, more premium grid.
2. **Empty & loading states** — add skeleton loaders (cream shimmer) on dashboards instead of a bare
   spinner; every empty list should have an icon + one-line "why" + a next action (as the admin queue now does).
3. **Trust signals** — real teacher avatars/flags, verified badges, and a subtle "as seen in" or
   partner strip. The language-flag marquee is great; extend that cultural cue into cards.
4. **Micro-interactions** — button press (`active:scale-[0.98]`), input label float, and a success
   check animation after registration submit.
5. **Consistent iconography** — stick to `lucide-react` at 1 or 2 sizes (16/20px); avoid mixing emoji
   with line icons in primary UI (keep emoji for playful marketing sections only).
6. **Dark-on-navy contrast** — verify all `text-cream/40`–`/50` meet WCAG AA on navy; bump to `/60`
   where it fails.
7. **Forms** — inline field-level validation (green check when valid) rather than only a top error banner.
8. **Domain theming hook** — the proposal calls for the student app to adapt to the selected
   language's aesthetics. On web, a light touch: accent the chosen language's flag/color on the
   student dashboard header.

---

## 5. File map (where the UI lives)

- `app/globals.css` — tokens, buttons, cards, inputs, focus states.
- `app/layout.tsx` — fonts + `AuthProvider`.
- `components/layout/Navbar.tsx`, `Footer.tsx` — chrome.
- `components/home/*` — landing sections.
- `components/ui/StatusBadge.tsx` — shared status pill.
- `app/login`, `app/register/*`, `app/*/dashboard` — auth & app screens.
