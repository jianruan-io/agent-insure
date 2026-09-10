---
version: alpha
name: Northbeam Portal
description: Northbeam's interface is ordinary, competent B2B treasury software — the app an accounts-payable team actually uses, not an insurer's. Airbnb's shape and spacing system (full rounding, soft low-opacity shadows, tight micro-density with airy macro spacing) is kept intact and recolored around a deep teal accent instead of Rausch coral. Plus Jakarta Sans (a freely-licensed, geometric rounded grotesque) replaces Airbnb Cereal VF for the same warm-but-precise character; JetBrains Mono is added for wallet addresses, ENS names, and transaction hashes — content Airbnb's system never had to render. Dashboard-dense in the data (stat tiles, tables, status pills), airy in the macro spacing between sections.
colors:
  primary: "#1F6F5C"
  primary-strong: "#17564A"
  ink: "#171A1F"
  body: "#5A6270"
  muted-light: "#9AA2AD"
  disabled: "#C7CCD3"
  surface: "#FFFFFF"
  surface-muted: "#F1F3F6"
  hairline: "#D8DEE6"
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
  primary: "#2FA68A"
  on-primary: "#08201F"
  ink: "#F5F6F7"
  body: "#9AA3B0"
  surface: "#161A20"
  surface-muted: "#1D232B"
  hairline: "#2A2D33"
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
  button-destructive:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.destructive}"
    borderColor: "{colors.destructive}"
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
  avatar:
    rounded: "{rounded.full}"
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
  table-row:
    borderColor: "{colors.hairline}"
    borderWidth: 1px
    typography: "{typography.body}"
---

# Northbeam Portal

## Overview

Northbeam is the insured company's own app — a wholesale distributor's accounts-payable console, not an insurer's product. It borrows Airbnb's shape and spacing discipline wholesale (full rounding, soft low-opacity elevation, a tight 2–16px micro-spacing scale under a loose 48/96px macro rhythm) because that discipline is what keeps a data-dense dashboard from reading as cold or cluttered — the exact failure mode the first undifferentiated draft of this build had. What changes from Airbnb is the accent (`{colors.primary}` — deep teal `#1F6F5C`, not Rausch coral), the typeface (Plus Jakarta Sans, a freely-licensed rounded geometric grotesque standing in for the proprietary Airbnb Cereal), and the addition of a monospace track (`{typography.data-mono}`, JetBrains Mono) for the one category of content Airbnb never had to render: wallet addresses, ENS names, and transaction hashes, where ambiguity is a real cost.

**Key Characteristics:**
- Teal (`{colors.primary}` — #1F6F5C) is the single saturated accent — reserved for primary buttons, active nav state, and the policy-status indicator
- Full rounding carried over from Airbnb's scale — cards, buttons, and badges are all pill-adjacent, nothing sharp
- Soft, low-opacity shadow only (`{components.card}`), never a hard border-and-drop-shadow combo
- Dashboard-dense content (stat tiles, tables, status badges) inside airy macro spacing — tight micro, loose macro, same as Airbnb
- Sponsor tags (`{colors.hedera}`, `{colors.ens}`, `{colors.world}`) are fixed across both Northbeam and Agent Insure and never restyled to match the app's own accent — they identify a sponsor touchpoint, not the brand
- Full light/dark support (`colors-dark`) — a deliberate departure from Airbnb's light-only system, since this is a tool people may run at any hour

## Colors

Northbeam's palette stays as neutral as Airbnb's — white/near-black ink, cool grey surfaces — with teal as the one point of saturation, plus the three fixed sponsor hues that appear as tags, never as backgrounds.

### Brand & Accent
- **Northbeam Teal** (`{colors.primary}` — #1F6F5C): reads as "operations, ledger, steady business" in fintech ops tooling — reserved for the Lock Rules button, the active sidebar item, and the ACTIVE policy-status pill.
- **Teal Strong** (`{colors.primary-strong}` — #17564A): pressed/hover state.
- **Success** (`{colors.success}` — #1E8F55): OK activity rows, Approved claim status.
- **Warning** (`{colors.warning}` — #D6900B): Pending policy status, unresolved states.
- **Destructive** (`{colors.destructive}` — #D22B2B): Flagged payments, the "simulate attack" action.

### Surface & Text
- **Surface** (`{colors.surface}` — #FFFFFF): cards, sidebar, table rows.
- **Surface Muted** (`{colors.surface-muted}` — #F1F3F6): badges, table stripe, inactive nav background.
- **Ink** (`{colors.ink}` — #171A1F): primary text.
- **Body** (`{colors.body}` — #5A6270): secondary text, captions, muted labels.
- **Hairline** (`{colors.hairline}` — #D8DEE6): the universal 1px border.

### Sponsor Tags (shared, fixed — see Agent Insure HQ doc for the identical values)
- **Hedera** (`{colors.hedera}` — #7C5CFF on `{colors.hedera-fill}` #F1EDFF)
- **ENS** (`{colors.ens}` — #4C82FB on `{colors.ens-fill}` #EAF1FF)
- **World** (`{colors.world}` — #E0A825 on `{colors.world-fill}` #FFF6E0)

### Dark Mode
Northbeam's dark surface (`colors-dark.surface` — #161A20) and lifted teal (`colors-dark.primary` — #2FA68A, paired with near-black `colors-dark.on-primary`) exist because — unlike Airbnb — this is operational software with no fixed hours. Applies to every token identically; only lightness shifts, never hue.

## Typography

**Font family:** Plus Jakarta Sans for all UI text; JetBrains Mono (`{typography.data-mono}`) exclusively for addresses, ENS names, and transaction hashes.

The size/weight ladder is lifted directly from Airbnb's scale (22px display down to 11px caps labels) — that scale was already well-considered, so it's kept rather than reinvented. What changes is weight: Airbnb tops out at 500 for emphasis; Northbeam pushes to 700 for `{typography.display-lg}`, `{typography.title-md}`, and `{typography.label-caps}`, since a dashboard's numbers (coverage limit, claim counts) need to win the page the way Airbnb's photography did.

## Layout

Spacing and rounding scales are identical to Airbnb's, unchanged: 2–16px micro-spacing for cards and table cells, 48/96px macro gaps between page sections, and the full `{rounded}` ramp from 4px inputs to fully-circular avatars. The layout unit itself differs — no swipeable carousels; content is a fixed sidebar (240px) plus a scrolling main column of stat tiles, cards, and tables.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| Flat | No shadow, hairline border only | Table rows, sidebar |
| Card | `{components.card}` — 1px shadow, 0.04 opacity | Stat tiles, content cards |
| Elevated | `{components.card-elevated}` — 12px 32px shadow, 0.16 opacity | The Selfie Check modal |

Same philosophy as Airbnb: soft and infrequent. Most of the UI is flat; only the modal genuinely floats.

## Shapes

Identical to Airbnb's radius scale — `{rounded.sm}` 4px through `{rounded.full}` 9999px — carried over unmodified. No sharp corners anywhere.

## Components

`{components.button-primary}` (teal fill), `{components.button-outline}` (hairline border, used for "Simulate normal invoice"), `{components.button-destructive}` (red outline, used for "Simulate poisoned invoice"), `{components.input}`, `{components.card}` / `{components.card-elevated}`, `{components.stat-tile}` (Coverage limit, Policy status, Claims filed, Claims paid), `{components.badge}` (OK / Flagged / Approved status), the three fixed `{components.sponsor-tag-*}` variants, `{components.sidebar-nav-item}` / `-active`, `{components.avatar}` (Guardian's initial), `{components.table-row}` (Activity Feed).

## Do's and Don'ts

### Do
- Reserve teal for primary actions and the active/locked state only — everything else stays neutral grey.
- Keep the sponsor tag colors exactly as specified, never recolored to match Northbeam's teal.
- Use JetBrains Mono for every address, ENS name, or hash — never render one in Plus Jakarta Sans.
- Keep every corner rounded, per the inherited Airbnb scale.

### Don't
- Don't give Agent Insure-facing content (claims already resolved elsewhere) an actionable button in this app — the resolution genuinely happens in another company's system.
- Don't introduce a second UI typeface.
- Don't skip the dark-mode block — unlike Airbnb, this tool has no fixed hours of use.

## Iteration Guide

1. **Change the accent via `{colors.primary}` and `{colors.primary-strong}` only.**
2. **Sponsor tags never change** — they're shared, fixed identity across both apps.
3. **Component variants compose from the token set** — a new button emphasis level reuses `{rounded.md}` and `{typography.button}`, never a bespoke size.
4. **Preserve both light and dark blocks** on every new token added.
