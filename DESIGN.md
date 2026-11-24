---
version: alpha
name: Settle Down Grove
description: Settle Down Finance's "Grove" design system. The logo's world carried into the app and the website, a calm family-budget app on cream paper with white cards, one deep green hero card per screen, a Fraunces serif for headings and big numbers, and liquid glass only on the controls that float above the content.

colors:
  light:
    background: "#F6F4EE"   # cream paper
    card: "#FFFFFF"
    text: "#17221D"
    secondary-text: "#56615A"
    separator: "#ECE9E1"
    track: "#EEECE5"
    tint: "#1F5B3F"         # deep green, replaces stock iOS blue
    on-tint: "#FFFFFF"
    tint-soft: "#E3F1E6"
    hero: "#1F5B3F"
    hero-text: "#F3F7EF"
    hero-muted: "#C9DCCF"
    leaf: "#8FD19E"
    sun: "#F6C04E"
    good: "#2F7A4D"         # on track
    warn: "#E9A92B"         # heading over
    bad: "#C4472D"          # over budget (clay red)
    good-text: "#2A6E45"
    warn-text: "#875600"
    bad-text: "#A93A22"
  dark:
    background: "#0D1712"
    card: "#16241D"
    text: "#E9EEEA"
    secondary-text: "#A9B4AD"
    separator: "#24332B"
    track: "#24332B"
    tint: "#8FD19E"         # leaf
    on-tint: "#0D1712"
    tint-soft: "#1D3527"
    hero: "#1A3A2A"
    hero-text: "#F3F7EF"
    hero-muted: "#A9C4B2"
    good: "#6CC287"
    warn: "#F6C04E"
    bad: "#FF8A70"
    good-text: "#8FD19E"
    warn-text: "#F6C04E"
    bad-text: "#FF9C86"

typography:
  large-title: { fontFamily: Fraunces, fontWeight: 600, fontSize: 32, lineHeight: 38, letterSpacing: -0.64 }
  intro-title: { fontFamily: Fraunces, fontWeight: 600, fontSize: 28, lineHeight: 33, letterSpacing: -0.5 }
  section-title: { fontFamily: Fraunces, fontWeight: 600, fontSize: 21, lineHeight: 26, letterSpacing: -0.3 }
  display-number: { fontFamily: Fraunces, fontWeight: 600, fontSize: 34, lineHeight: 1.12, letterSpacing: -0.02em, fontVariant: tabular-nums }
  body: { fontFamily: system, fontSize: 17 }
  intro-body: { fontFamily: system, fontSize: 16, lineHeight: 23 }
  button: { fontFamily: system, fontWeight: 600, fontSize: 17 }
  footnote: { fontFamily: system, fontSize: 13, lineHeight: 18 }
  quiet-label: { fontFamily: system, fontWeight: 600, fontSize: 13, letterSpacing: 0.2 }

spacing: { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 }
radius: { control: 14, card: 22, hero: 28, pill: 999 }
---

# Settle Down Grove

This file tells AI agents (and people) how Settle Down Finance should look and feel. It describes the design that is already in the code. **The code is the source of truth:** tokens live in `constants/Colors.ts`, shared components and the spacing and radius scales live in `components/ui.tsx`. If this file and the code disagree, follow the code and fix this file in the same PR.

The format follows the DESIGN.md convention (front matter tokens, then prose) used by collections such as VoltAgent's awesome-design-md. Those files describe other companies' brands; use them only as a reference for structure and vocabulary, never copy their colors, fonts or signature components into this app.

## Overview

Settle Down is a budget app for a household. It should feel calm, warm and trustworthy, like paper on a kitchen table, not like a trading terminal. Each screen answers one question, and the answer sits in a deep green hero card at the top. Everything else is grouped into white cards on cream paper below it.

- iOS first (Expo / React Native), with the same design on the web app and the marketing site in `site/`.
- Light and dark mode are both first class. Every text color passes WCAG AA (4.5:1) on both `card` and `background`.
- Money is the content. Numbers are large, serif and tabular; decoration is minimal.

## Colors

- **Cream paper** (`background`) is the canvas. **White cards** (`card`) hold all content.
- **Deep green** (`tint`) is the only accent for actions, selected states and links. It replaces stock iOS blue everywhere. In dark mode the tint becomes **leaf** green.
- **Hero green** (`hero`) is used for one card per screen, with `hero-text` and `hero-muted` on it.
- **Status tones** carry budget meaning and nothing else: `good` (on track), `warn` amber (heading over), `bad` clay red (over budget). Use the `*-text` variants when the color is text, and `toneColor` / `toneTextColor` in code.
- Text on a filled tint button uses `on-tint`. Never hard-code `#FFFFFF` for it, because the dark-mode tint is light.
- Always read colors from `useTheme()`. Don't add new hex values in screens; add a token to `constants/Colors.ts` if one is truly missing.

## Typography

- **Fraunces** (the serif from the logo wordmark) is for screen titles, section titles and big numbers. Use the `Display` component for numbers; it sets tabular figures and tight tracking.
- **System font** (SF Pro on iOS) is for everything else: body, rows, buttons, labels.
- Keep it to two families and a few weights. Don't use the serif for body copy or long text.
- On the website, Fraunces is self-hosted from `site/assets/fonts/fraunces.woff2` with a Georgia fallback.

## Layout

- 16pt screen gutter, 16pt card padding, 24pt between sections (`space.l`, `space.l`, `space.xl`). Stick to the 4/8 scale in `space`.
- Tab screens draw their own large serif title with an optional round glass action (the Settings gear) on the right. Pushed screens keep the native header.
- On wide screens the content sits in a single centered column (`columnStyle`), and the tab bar moves to the left.
- Leave room at the bottom for the floating tab bar; `Screen` already does this.
- Touch targets are at least 44pt.

## Elevation and depth

- Cards: white with a soft two-layer shadow in light mode; a hairline `separator` border instead of a shadow in dark mode.
- Hero card: a deep green glow underneath and a faint inner highlight on its top edge.
- **Liquid glass** is only for controls that float above the content: the tab bar, round icon buttons in a title row, the Activity filter menu, confirmation sheets, and the site nav. Use the `Glass` component, which uses the system material on iOS 26+ and a frosted stand-in elsewhere. Content cards stay solid so text is easy to read.

## Shapes

- `radius.card` 22 for cards, 28 for the hero card, `radius.control` 14 for fields, `radius.pill` for buttons, tags, pills and segmented controls.
- Progress and pace bars are 6pt tall with fully rounded ends on a `track` background.

## Components

Use the components in `components/ui.tsx` before building anything new:

- `Screen`: the scrolling cream page with title, eyebrow and action.
- `HeroCard`: the one green card at the top of a tab.
- `Section` / `Card`: titled white card groups. `quiet` turns the title into a small label for long day-grouped lists.
- `ListRow`, `Row`, `StatTile`, `IconChip`, `BucketChip`, `Tag`, `Pill`: rows and small data pieces.
- `ProgressBar`, `PaceBar`, `RangeBar`: budget progress, pace against the month, and projection ranges.
- `Button`: `primary` filled green pill (52pt tall) for the main action, `secondary` soft green pill, `destructive` filled red, `plain` text button with a 44pt target. `ai` adds the AI mark for actions that use credits.
- `Segmented`, `IconButton`, `SettingsButton`, `Glass`, `Intro`, `Notice`, `Gone`.

### Signature pieces

- **Home carousel:** three swipeable hero cards: Free to spend (per-day number), Spending trend, and The month ahead. The spending trend chart against last month, with its So far / Projected toggle, must always stay.
- **Bucket rows:** icon chip tinted by status, name, amount left, and a pace bar showing where spending should be by today.

## Do

- Put every hint, note and action inside a card (`Section`, `Row`, `Notice`). Nothing floats as loose text on the cream background.
- Use a filled primary button for the main action (Save, Add) and put destructive actions in their own card.
- Label buttons with a verb ("Add goal", "Link a bank"), not "OK" or "Submit".
- Show one important number per screen, big and serif, in the hero card.
- Check alignment carefully: edges of titles, cards and section labels line up on the same gutter.
- Check both light and dark mode, and a small phone (375pt wide), before calling a screen done.
- Use sample data from `src/data/demo.ts` for screenshots.

## Don't

- Don't use stock iOS blue, gradients, rainbow accents or neon.
- Don't put glass on content cards or long text.
- Don't introduce a new font, a new accent color or a new card style for one screen.
- Don't use red or amber for decoration; they mean "over" and "heading over".
- Don't use cartoon illustrations or emoji as empty states. An empty state is a card with one sentence and a button.
- Don't remove the spending trend chart or its projection toggle.
