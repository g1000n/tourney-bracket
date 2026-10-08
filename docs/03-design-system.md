# Design system

The look is "family computer, 1998": a beige CRT-plastic page, a green screen
for the home page, and chunky outlined tiles and buttons with hard shadows, in
the colours of the logo. Everything below lives as CSS custom properties in
`client/src/styles.css`, and each component has its own CSS Module.

## Colour

| Name in code | Hex | Used for |
|---|---|---|
| `--color-screen` | `#12994A` | screen green: the home "monitor", large areas (ink text only) |
| `--color-primary` | `#0E7A3B` | green deep: primary buttons (white text) |
| `--color-text` / `--color-edge` | `#0B1A12` | ink: text, outlines, hard shadows |
| `--color-link` / `--color-blue` | `#2B5BD7` | royal blue: links, the focus ring |
| `--color-red` | `#E0383C` | tile red: decoration and large text only |
| `--color-accent` | `#C42E32` | red deep: danger buttons, error text |
| `--color-yellow` | `#F5C542` | sun yellow: the champion, highlights |
| `--color-swoosh` | `#6A4BC4` | purple: the swoosh under the wordmark only |
| `--color-bg` | `#E9E5D8` | plastic: the page |
| `--color-surface` | `#F6F3EA` | paper: cards and inputs |
| `--color-line` | `#CFC9B6` | hairline dividers inside cards |
| `--color-text-soft` | `#4B5A50` | secondary text |
| tints | `#E3F3E9`, `#DDE6FB`, `#FBE2E1`, `#FCF0CC` | green, blue, red and yellow backgrounds |

**Contrast (WCAG minimum 4.5:1 for normal text):**

| Pair | Ratio |
|---|---|
| Ink on screen green | 4.85:1 |
| White on green deep | 5.4:1 |
| White on blue | 5.9:1 |
| White on red deep | 5.6:1 |
| Ink on yellow | 11:1 |
| Blue links on paper | 5.3:1 |
| Blue links on plastic | 4.65:1 |

The bright tile red is only 4.1:1 with ink, so text on red uses red deep with
white instead.

## Type

| Name | Family | Size |
|---|---|---|
| Page title | Gloock (`--font-heading`) | 34–46 px, scaling with the screen |
| Section heading | Gloock | 26 px |
| Card heading | Gloock | 20 px |
| Body | Nunito (`--font-body`), 400–800 | 16 px, line height 1.5 |

Both fonts come from Google Fonts, with Georgia and Trebuchet MS as fallbacks.

## Spacing

One scale: `--space-1` 8 px, `--space-2` 16 px, `--space-3` 24 px, `--space-4` 32 px.

## Shape

- Corners: `--radius` 4 px, `--radius-lg` 10 px.
- Hard shadows: 2, 3 and 5 px offsets in ink (`--shadow-hard-sm`, `--shadow-hard`,
  `--shadow-hard-lg`).

## Components and their states

| Component | Normal | Hover | Focused | Disabled | Loading |
|---|---|---|---|---|---|
| Button | outlined tile, hard shadow | lifts 1 px, bigger shadow; pressed, it sinks into its shadow | 3 px blue outline, 2 px offset | 45% opacity, no shadow, not-allowed cursor | label changes, e.g. "Logging in…" |
| Input / dropdown (`Combobox`) | paper, 2 px ink outline | – | blue outline | plastic background, soft text | – |
| Tournament card | paper tile, hard shadow | – | blue outline | – | – |
| Match card | paper tile; **Live** tag while scoring | – | blue outline on its controls | greyed while not ready to play | – |

Focus is never removed: every focusable element gets the 3 px blue outline from
`:focus-visible`.

## States

| State | What it looks like |
|---|---|
| Loading | a line of text, e.g. "Loading tournaments…" |
| Empty | a sentence saying what to do next, e.g. "No tournaments yet. Start one with New tournament." |
| Error | a bar under the header: "Couldn't load data: …" with a retry button |
| Data | the normal screen |
