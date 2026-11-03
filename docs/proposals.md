# Feature proposals — awaiting approval

Ideas that would make Tigmi better at helping a family live together, beyond a classic
dashboard. **None of these is built.** Each needs the module it depends on (see the roadmap) and
your go-ahead, because some imply product choices, external services or privacy decisions.

Status legend: 💡 proposed · ✅ approved (move to the roadmap) · ❌ declined

| #   | Proposal                         | Status |
| --- | -------------------------------- | ------ |
| 1   | Living home dashboard            | 💡     |
| 2   | Shopping run mode                | 💡     |
| 3   | Budget envelopes                 | 💡     |
| 4   | Fair chore rotation              | 💡     |
| 5   | Bill autopilot                   | 💡     |
| 6   | Moroccan family calendar         | 💡     |
| 7   | Bilingual quick add              | 💡     |
| 8   | Warranty vault                   | 💡     |
| 9   | Weekly family recap              | 💡     |
| 10  | Mobile widgets and quick actions | 💡     |

---

### 1. Living home dashboard

**Problem.** Dashboards full of cards feel like work, not home.
**Idea.** The household dashboard opens on the 3D/isometric home (the sign-in house, now made of
rooms). Rooms light up from **real signals only**: the kitchen glows when a shopping list is in
progress, the office when a bill is due within 3 days, the living room for today's events. Tap a
room → its module. The accessible equivalent (a plain list of the same signals) is always present.
**Depends on.** Phase 3 dashboard + modules providing the signals (Phases 4–6). Three.js on
desktop, SVG on phones (same approach as the sign-in hero).
**Cost/risk.** Moderate; must stay fast (render on demand) and never be the only way to navigate.

### 2. Shopping run mode

**Problem.** In the shop, a phone in one hand and a basket in the other.
**Idea.** Full-screen list with huge rows, swipe right to tick (haptic on mobile), items grouped
by aisle, running total vs. estimate, and live sync: family members see ticks instantly and can
add "while you're there" items.
**Depends on.** Phase 5 shopping, Phase 8 mobile; live sync needs a realtime channel (SSE or
WebSocket) — an architecture addition.
**Cost/risk.** Moderate; offline support is the hard part (queue + conflict rules).

### 3. Budget envelopes

**Problem.** Numbers in a table do not tell you "can we still afford this?".
**Idea.** Each category budget is an envelope that fills as money is spent; colour shifts at 80 %
and 100 %; month-over-month comparison; tap to see the transactions. Computed from transactions
(no duplicated data, as the brief requires).
**Depends on.** Phase 4 budgets. Visual in SVG/CSS (no 3D needed).

### 4. Fair chore rotation

**Problem.** The same person ends up doing everything.
**Idea.** Recurring tasks can rotate automatically among chosen members; a gentle balance view
shows who did what this month (counts, never rankings or shaming).
**Depends on.** Phase 5 tasks + Phase 7 jobs (rotation at each recurrence).
**Decision needed.** Whether children have accounts (roles/age policy).

### 5. Bill autopilot

**Problem.** Late fees and "did someone pay the electricity?".
**Idea.** Reminders 3 days before and on the due date (email/push, respecting preferences); "mark
as paid" straight from the reminder; next occurrence created automatically for recurring bills.
**Depends on.** Phase 4 bills + Phase 7 jobs/notifications.

### 6. Moroccan family calendar

**Problem.** Family life follows several calendars.
**Idea.** Hijri dates alongside Gregorian, Ramadan and Eid periods highlighted, Moroccan public and
school holidays, birthdays with reminders.
**Depends on.** Phase 5 calendar.
**Decision needed.** Data source for holidays (static yearly dataset maintained by us vs. external
API); Hijri dates can be computed locally (`Intl` islamic calendar) — moon-sighting differences
must be explained to users.

### 7. Bilingual quick add

**Problem.** Typing on a phone is slow.
**Idea.** One field that understands "2 kg tomates", "حليب" or "facture eau 150 dh le 10" and
creates the right item (shopping, bill, task). Optional voice input using the browser's speech
recognition.
**Depends on.** Phases 4–5. **Privacy decision:** browser speech recognition may send audio to the
browser vendor; would be opt-in and clearly labelled.

### 8. Warranty vault

**Problem.** The receipt is lost exactly when the fridge breaks.
**Idea.** Photograph the receipt and the appliance label; warranty end reminders 30 days before.
**Depends on.** Phase 6 inventory. **Infrastructure decision:** file storage (S3-compatible
service or local disk with backups) and image size limits.

### 9. Weekly family recap

**Problem.** Nobody has the full picture.
**Idea.** A short Sunday summary (in each member's language): bills due next week, tasks done,
spending vs. budget, upcoming events — email and in-app.
**Depends on.** Phase 7 jobs + notifications, and the modules it summarises.

### 10. Mobile widgets and quick actions

**Problem.** Opening the app to add one item is friction.
**Idea.** Home-screen quick actions ("Ajouter aux courses", "Nouvelle dépense") and a shopping-list
widget in the Expo app.
**Depends on.** Phase 8 mobile; widgets need native modules (Expo config plugins).

---

**Not proposed on purpose:** AI-generated artwork dependent on an external API (the interface must
work without paid services), and features that need data Tigmi does not collect yet.
