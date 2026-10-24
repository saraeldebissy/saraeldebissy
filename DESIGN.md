# Design

## Theme

Dark CRT terminal. Scene: a developer/designer glancing at a profile link at night, phone or laptop, dim ambient light, expecting something that looks hand-built rather than templated.

## Color Strategy

Committed. One saturated violet carries structure and headers; coral is the secondary glow/accent used sparingly for emphasis and live-status indicators.

## Palette (OKLCH)

- `--bg-void`: oklch(14% 0.015 290) — near-black, violet-tinted base
- `--bg-panel`: oklch(18% 0.02 290) — slightly lifted panel background
- `--border`: oklch(28% 0.03 290) — hairline panel borders
- `--ink`: oklch(92% 0.015 290) — primary text, warm off-white
- `--muted`: oklch(60% 0.02 290) — secondary text, comments
- `--violet`: oklch(68% 0.16 290) — primary accent, headers, prompts
- `--coral`: oklch(72% 0.14 40) — secondary accent, glow, live/status
- `--green-ok`: oklch(75% 0.14 150) — success/live indicators only

## Typography

Monospace throughout: `"SF Mono", ui-monospace, Menlo, Consolas, monospace`. Scale: 13px body, 15px section titles, 30px display (cover ASCII). Weight contrast (400 body / 700 titles) carries hierarchy, not just size.

## Texture

Scanline overlay (repeating horizontal lines, low opacity, multiply blend) + radial vignette darkening toward edges. Baked into the rendered PNG, not live CSS, since GitHub READMEs strip animations and most CSS.

## Components

- **Terminal panel**: dark panel, 1px violet-tinted border, no shadow (flat against void background, since shadows read as light-mode affordance).
- **Section header**: `>_` chevron in violet + title in ink + right-aligned `// comment` in muted.
- **Pills/tags**: no pill shapes. Replaced with bracketed labels `[live]` `[repo]` in monospace, colored by state (coral=live, violet=repo, muted=internal).
- **Badges (stack)**: flat bracketed tokens, not rounded chips, to stay terminal-native rather than dashboard-native.

## Motion

None required (static image export). If ever rendered as live HTML, cursor-blink only, no other animation.
