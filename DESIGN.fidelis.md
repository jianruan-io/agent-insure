---
version: alpha
name: Fidelis Portal
description: Fidelis's interface is an actual insurer's claims desk — institutional and a shade more formal than Northbeam's, because it's the counterparty whose judgment the payout depends on. Same inherited system as Northbeam (Airbnb's full rounding and soft low-opacity elevation, Plus Jakarta Sans, JetBrains Mono for ledger data) recolored around a deep plum accent — legacy-insurer gravitas without reading as an alert color, and distinct enough from navy that it won't blend into the ENS sponsor tag every Fidelis screen shows beside it.
colors:
  primary: "#5B3A78"
  primary-strong: "#452C5E"
  ink: "#171A1F"
  body: "#5A6270"
  muted-light: "#9AA2AD"
  disabled: "#C7CCD3"
  surface: "#FFFFFF"
  surface-muted: "#F3F1F6"
  hairline: "#DCD5E3"
  success: "#1E8F55"
  warning: "#D6900B"
  destructive: "#D22B2B"
  on-primary: "#FFFFFF"
  hedera: "#7C5CFF"
  hedera-fill: "#F1EDFF"
  ens: "#4C82FB"
  ens-fill: "#EAF1FF"
  world: "#E0A825"
  world-fill: "#FFF6E0"
colors-dark:
  primary: "#B79BD6"
  on-primary: "#1E1428"
  ink: "#F5F6F7"
  body: "#9AA3B0"
  surface: "#161A20"
  surface-muted: "#241D2E"
  hairline: "#332A40"
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.3px
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: 700
    lineHeight: 1.25
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.25
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.45
  body-strong:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.3
  button:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.5
  caption:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.25
  micro:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.35
  label-caps:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: 700
    lineHeight: 1.2
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: 4px
  md: 8px
  lg: 12px
  xl: 20px
  2xl: 32px
  pill: 9999px
  full: 9999px
spacing:
  xs: 2px
  sm: 4px
  md: 6px
  base: 8px
  lg: 10px
  xl: 12px
  2xl: 14px
  3xl: 16px
  section: 48px
  section-lg: 96px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 10px 16px
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    borderWidth: 1px
    typography: "{typography.button}"
    rounded: "{rounded.md}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    borderWidth: 1px
    typography: "{typography.body-strong}"
    rounded: "{rounded.md}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    boxShadow: rgba(0, 0, 0, 0.04) 0px 1px 2px 0px
  card-elevated:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    boxShadow: rgba(0, 0, 0, 0.16) 0px 12px 32px 0px
  stat-tile:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    labelTypography: "{typography.label-caps}"
    valueTypography: "{typography.display-lg}"
  badge:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.ink}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.full}"
  verdict-badge:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.full}"
  sponsor-tag-hedera:
    backgroundColor: "{colors.hedera-fill}"
    textColor: "{colors.hedera}"
    rounded: "{rounded.full}"
  sponsor-tag-ens:
    backgroundColor: "{colors.ens-fill}"
    textColor: "{colors.ens}"
    rounded: "{rounded.full}"
  sponsor-tag-world:
    backgroundColor: "{colors.world-fill}"
    textColor: "{colors.world}"
    rounded: "{rounded.full}"
  sidebar-nav-item:
    textColor: "{colors.body}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
  sidebar-nav-item-active:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.md}"
  queue-item:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    borderColor: "{colors.hairline}"
    borderWidth: 1px
  queue-item-active:
    backgroundColor: "{colors.primary}"
    textColorOpacity: 0.05
    borderColor: "{colors.primary}"
    borderWidth: 1px
  step-row-done:
    textColor: "{colors.ink}"
    checkColor: "{colors.success}"
  step-row-pending:
    textColor: "{colors.body}"
---

# Fidelis Portal

## Overview

Fidelis is the insurer's own app — a claims desk, not a marketing product. It's the counterparty whose judgment the entire payout depends on, so its interface carries slightly more institutional weight than Northbeam's: same inherited shape system (Airbnb's full rounding, soft low-opacity elevation, tight micro / loose macro spacing) and same typography (Plus Jakarta Sans, JetBrains Mono for ledger data), but recolored around a deep garnet (`{colors.primary}` — #8B3A46) instead of Northbeam's teal. Garnet is a deliberate echo of the navy-and-deep-red premium pairing legacy insurers like Chubb use for gravitas — without reusing navy itself, which would visually blend into the ENS sponsor tag that appears on nearly every Fidelis screen next to the brand chrome.

**Key Characteristics:**
- Garnet (`{colors.primary}` — #8B3A46) is the single saturated accent — reserved for primary actions, the active queue item, and the active sidebar state
- Case-file voice: "Claim #1," "Verdict," "Investigation" — procedural, third-person, not a personal dashboard
- The Claims Queue is the signature surface: a list + detail split, checklisted investigation steps, a signed verdict badge, a visible reserve-pool balance that actually decrements on payout
- Same full-rounding, soft-shadow, sponsor-tag-fixed system as Northbeam — see that doc for the shared rationale

## Colors

Identical structure to Northbeam's palette — neutral surfaces, one saturated accent, three fixed sponsor hues — with garnet standing in for teal.

### Brand & Accent
- **Fidelis Garnet** (`{colors.primary}` — #8B3A46): reserved for the Run Investigation / Run Payout buttons and the active claim in the queue.
- **Garnet Strong** (`{colors.primary-strong}` — #6E2D37): pressed/hover state.
- **Success** (`{colors.success}` — #1E8F55): Paid status, completed investigation/payout steps.
- **Warning** (`{colors.warning}` — #D6900B): Investigated-but-unpaid status.
- **Destructive** (`{colors.destructive}` — #D22B2B): also doubles as the VERDICT: FRAUD badge fill (`{components.verdict-badge}`) — the one place destructive red carries informational, not just error, meaning.

### Surface & Text
Identical values to Northbeam: `{colors.surface}` #FFFFFF, `{colors.surface-muted}` a garnet-tinted #F6F1F2 (warmer than Northbeam's teal-tinted #F1F3F6 — the only surface-level difference between the two apps), `{colors.ink}` #171A1F, `{colors.body}` #5A6270, `{colors.hairline}` #D8DEE6.

### Sponsor Tags (shared, fixed — identical to Northbeam)
- **Hedera** (`{colors.hedera}` — #7C5CFF on #F1EDFF)
- **ENS** (`{colors.ens}` — #4C82FB on #EAF1FF)
- **World** (`{colors.world}` — #E0A825 on #FFF6E0) — appears rarely here; World's touchpoint lives mostly in Northbeam's claim-filing flow, not Fidelis's investigation.

### Dark Mode
`colors-dark.primary` (#C96B78) is a lighter garnet tuned for dark surfaces, paired with a near-black `colors-dark.on-primary` (#20090C) rather than white — a lightness-driven contrast flip, not a hue change.

## Typography

Identical scale and rationale to Northbeam's doc: Plus Jakarta Sans for UI, JetBrains Mono (`{typography.data-mono}`) reserved for the one genuinely technical string on this side — the demo Hedera transaction hash shown after a payout.

## Layout

Same sidebar-plus-main shell as Northbeam, but Fidelis's main content is narrower in practice — two nav items (Overview, Claims Queue) instead of four — and its signature screen is a two-pane split (`queue-item` list at 220px, detail panel filling the rest) rather than a single scrolling column.

## Elevation & Depth

Identical table to Northbeam's — flat rows, `{components.card}` for stat tiles and the queue detail panel, `{components.card-elevated}` reserved for any future modal (none currently in this app, unlike Northbeam's Selfie Check).

## Shapes

Identical radius scale to Northbeam's, unchanged.

## Components

`{components.button-primary}` (garnet fill, "Run Investigation" / "Run Payout"), `{components.button-outline}`, `{components.card}` / `{components.card-elevated}`, `{components.stat-tile}` (Reserve pool, Claims filed, Claims paid, Active policies), `{components.badge}` (New / Investigated / Paid queue status), `{components.verdict-badge}` (the FRAUD verdict — the one badge that borrows destructive red rather than the app's own garnet), the three fixed `{components.sponsor-tag-*}` variants, `{components.sidebar-nav-item}` / `-active`, `{components.queue-item}` / `-active`, `{components.step-row-done}` / `-pending` (the checklisted Investigator/Payout steps).

## Do's and Don'ts

### Do
- Reserve garnet for actions that actually move the case forward (investigate, pay) — not for informational badges.
- Keep the VERDICT badge in destructive red regardless of app accent — it's a severity signal, not a brand moment.
- Show the reserve pool balance decrementing live on payout — it's the one piece of state that has to feel real.

### Don't
- Don't reuse navy for the accent, even though it's the more "traditional insurer" color — it collides visually with the ENS sponsor tag.
- Don't let Fidelis's garnet bleed into Northbeam's screens or vice versa; the accent is the one visual signal that these are two separate companies.

## Iteration Guide

1. **Change the accent via `{colors.primary}` and `{colors.primary-strong}` only** — same rule as Northbeam.
2. **The verdict badge stays destructive-red, never garnet** — severity color, not brand color.
3. **Sponsor tags never change** across either app.
4. **New case-detail components follow the `queue-item` / `step-row` pattern** — list-plus-detail, checklisted steps — rather than introducing a new layout primitive.
