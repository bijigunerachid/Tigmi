# Design system

Premium, calm, dark interface (product brief): deep navy surfaces, premium blue for actions,
cyan used sparingly as an accent. No UI kit — small components in `apps/web/src/components/ui`,
styled with Tailwind 4 and the tokens below.

**See every component live:** run `npm run dev` and open http://localhost:5180/dev/ui
(development builds only; the gallery is not included in production builds).

## Tokens (`apps/web/src/index.css`, `@theme`)

| Token                                                                   | Value / use                                                        |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `canvas` `#080D18`                                                      | page background (with one faint blue glow at the top)              |
| `surface` `#111827` · `raised` `#172033`                                | cards · menus, dialogs, toasts                                     |
| `line` · `line-strong`                                                  | hairline borders · field and secondary-button borders              |
| `ink` `#F8FAFC` · `ink-muted` `#94A3B8` · `ink-subtle`                  | text: primary · secondary · placeholders (all ≥ 4.5:1)             |
| `brand` `#2563EB` · `brand-strong`                                      | primary actions · hover                                            |
| `accent` `#22D3EE`                                                      | focus rings, highlights, small details — never large areas         |
| `success` · `warning` · `danger` · `info`                               | status colours, always paired with text                            |
| `--font-sans` Inter · `--font-arabic` Noto Sans Arabic                  | self-hosted variable fonts; Arabic applies with `<html lang="ar">` |
| `--radius-control` 12px · `--radius-card` 16px · `--radius-dialog` 20px | shape scale                                                        |
| `--shadow-card` · `--shadow-raised`                                     | depth for cards · overlays                                         |
| `animate-fade-in` · `rise-in` · `slide-in-end` · `shimmer`              | 160–240 ms, eased; all disabled by `prefers-reduced-motion`        |
| `--z-header` 30 · `--z-dropdown` 40 · `--z-toast` 60 · `--z-tooltip` 70 | stacking order (dialogs use the browser top layer)                 |

Rules: use semantic tokens (`bg-surface`, `text-ink-muted`), not raw colours; use logical
properties (`ms-`, `pe-`, `start-`, `end-`, `text-start`) so layouts mirror in Arabic; flip
directional icons with `rtl:-scale-x-100`.

## Components

| Component                                              | File                          | Notes                                                                                                                                                                                                                           |
| ------------------------------------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`, `ButtonLink`                                 | `Button.jsx`                  | variants `primary/secondary/ghost/danger/danger-solid`, sizes `sm/md/lg/icon`; `loading` disables and shows progress; icon buttons need `aria-label`. `ButtonLink` = router link styled identically (shared `buttonClasses()`). |
| `TextField`, `PasswordField`, `TextArea`, `DatePicker` | `TextField.jsx`               | all built on `Field` (label + hint + error wired with `aria-describedby` / `aria-invalid`); `endAdornment` slot; `DatePicker` = native date input (localised, phone-native picker).                                             |
| `SelectField`                                          | `SelectField.jsx`             | native `<select>` with themed chevron.                                                                                                                                                                                          |
| `Card`, `CardHeader`                                   | `Card.jsx`                    | `as="section"` + `aria-labelledby` for landmarks.                                                                                                                                                                               |
| `Badge`                                                | `Badge.jsx`                   | tones `neutral/brand/accent/success/warning/danger`.                                                                                                                                                                            |
| `Alert`                                                | `Alert.jsx`                   | `role="alert"` for errors, `status` otherwise.                                                                                                                                                                                  |
| `Modal`, `Drawer`, `ConfirmDialog`                     | `Dialog.jsx`                  | native `<dialog>` + `showModal()`: focus contained, page inert, Escape closes, focus returns to the opener, backdrop click closes. Drawer slides from the end edge. ConfirmDialog focuses **Cancel** first (`data-autofocus`).  |
| `Dropdown`                                             | `Dropdown.jsx`                | WAI-ARIA menu button: arrows, Home/End, type-ahead, Escape returns focus, outside click closes.                                                                                                                                 |
| `Tooltip`                                              | `Tooltip.jsx`                 | hover **and** focus, `aria-describedby`, Escape hides (WCAG 1.4.13). Never the only source of information.                                                                                                                      |
| `Tabs`                                                 | `Tabs.jsx`                    | WAI-ARIA tabs, one tab stop, arrows follow the layout direction (reversed in RTL).                                                                                                                                              |
| `DataTable`                                            | `DataTable.jsx`               | `<table>` with `aria-sort` sortable headers on ≥ 768px; one card per row on phones; skeleton rows while loading; `empty` slot. Sorting is server-side.                                                                          |
| `Pagination`, `pageItems()`                            | `Pagination.jsx`              | `aria-current="page"`; compact "page X of Y" on phones.                                                                                                                                                                         |
| `ToastProvider`, `useToast()`                          | `Toast.jsx`                   | persistent polite live region named "Notifications"; max 3; pause on hover/focus; 5 s.                                                                                                                                          |
| `Skeleton`, `SkeletonText`                             | `Skeleton.jsx`                | decorative (`aria-hidden`) — pair with a text status.                                                                                                                                                                           |
| `LoadingSpinner`                                       | `LoadingSpinner.jsx`          | `role="status"` with a visible label.                                                                                                                                                                                           |
| `EmptyState`                                           | `EmptyState.jsx`              | icon, title, explanation, next action.                                                                                                                                                                                          |
| `Avatar`, `initials()`                                 | `Avatar.jsx`                  | decorative initials tile, stable colour per id (always next to the written name).                                                                                                                                               |
| `LanguageSwitcher`                                     | `shared/LanguageSwitcher.jsx` | Français / العربية, each labelled in its own language (`lang`), `aria-pressed`.                                                                                                                                                 |

## Identity and motion

- **Mark:** `BrandMark` / `BrandLockup` (`components/brand`) — a house outline lit blue → cyan
  ("tigmi" = house in Tamazight). The "Tigmi." wordmark is always LTR, also in Arabic.
- **Signature utilities** (`index.css`): `stagger` (children reveal once on page load, 60 ms
  apart via `--i`), `glass` (frosted blur — navigation only), `rim` (hairline top-edge light on
  cards and dialog panels; never on a `<dialog>` itself, it would break its fixed positioning).
- **Curves:** `--ease-out` cubic-bezier(0.23, 1, 0.32, 1) for enter/feedback,
  `--ease-drawer` (0.32, 0.72, 0, 1) for panels, `--ease-in-out` for on-screen movement.
- **Where motion is used — and why:**

| Interaction             | Motion                                                                                 | Purpose                                            |
| ----------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Press any button / card | scale 0.97 – 0.99, 150 ms                                                              | feedback that the tap registered                   |
| Page change             | 160 ms fade out, 260 ms fade + 6 px rise in (View Transitions); navigation stays still | spatial continuity                                 |
| Sign-in brand panel     | one orchestrated staggered reveal, 420 ms, 60 ms apart                                 | the single memorable moment — app pages stay quiet |
| Dialogs, menus          | rise-in 220 ms, origin-aware menus; drawers slide from the end edge 300 ms             | where the panel came from                          |
| Sign-in background      | static aurora that fades in once                                                       | atmosphere without CPU cost                        |

- **Not animated on purpose:** keyboard actions, typing, list updates, tab switches, section
  entrances inside the app, and hover lifts on cards (generic tells per the frontend-design
  guidance; spend boldness in one place).
- **Measured decision:** an endlessly drifting aurora doubled end-to-end test time (CPU) and
  would drain phone batteries; it is static now. Large `filter: blur()` layers were removed for
  the same reason (the radial gradients already fade).
- `prefers-reduced-motion`: all movement, page transitions and staggers collapse to instant.
- Hover effects only apply on devices that can hover (Tailwind 4 `hover:` is gated by
  `@media (hover: hover)`).

## 3D and gestures

- **Sign-in hero** (`components/illustrations/HeroHouse.jsx`): a real Three.js house on desktop
  with a **hardware** GPU (`HouseScene3D.jsx`, its own lazy chunk ~142 kB gzip). Software WebGL
  (no GPU, blocked driver, virtual desktop, headless browsers — detected by renderer name, since
  Chromium accepts SwiftShader even with `failIfMajorPerformanceCaveat`) gets the code-drawn isometric
  SVG (`IsoHouse.jsx`, no image file) on phones, without WebGL, and as the instant placeholder.
  The scene renders **on demand only** (intro settle + pointer easing, then 0 frames at rest),
  caps pixel ratio at 1.75, prefers the low-power GPU and disposes everything on unmount.
  Reduced motion → one static frame. Tested: phones and software-GPU browsers never download
  Three.js; the 3D path is tested with a development-only `localStorage["tigmi.hero"] = "3d"`
  override (ignored in production builds).
- **Bottom sheets** (`useSheetDrag.js`): on phones, centered dialogs become bottom sheets with a
  grab handle. Drag follows the finger 1:1, upward drags meet resistance, release closes on
  velocity > 0.11 px/ms or 30 % of the height, otherwise it springs back (iOS drawer curve).
  Escape, the close button and the backdrop still work; focus returns to the opener.
- **Illustrations** are decorative (`aria-hidden`) and never carry information.

## Right-to-left (Arabic)

- `<html lang dir>` follows the language; the sidebar, drawers, chevrons and arrows mirror.
- Use logical utilities only (`ms-/me-/ps-/pe-/start-/end-/text-start/border-e`).
- Wrap emails and other Latin data inside Arabic text in `<bdi>`; keep codes such as `MAD` or
  `Africa/Casablanca` in `dir="ltr"` elements.
- Single-column grids on phones use `grid-cols-[minmax(0,1fr)]` — otherwise one long email
  widens the whole column ("grid blowout", found and fixed in this phase).
- `Avatar` (initials, stable gradient per id) works with Arabic names ("أمينة بنعلي" → "أب").

## Accessibility checklist for new screens

- Every field has a visible `<label>`; errors are text, not only colour.
- Destructive actions go through `ConfirmDialog`.
- Touch targets ≥ 44px (`min-h-11`, `size-11`); focus is always visible (cyan ring).
- One `<h1>` per page; sections are `Card as="section"` with `aria-labelledby`.
- Test: Vitest + Testing Library for behaviour; Playwright + axe for real-browser checks at
  1366px and 390px (no sideways scrolling).
