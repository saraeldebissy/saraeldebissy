# Design

## Theme

Cyberpunk HUD on true black. Not "dark mode" — a machine readout. The page should look like instrumentation someone is operating, not a document someone is reading.

## Color Strategy

Committed, two-role. **Orange is signal**: live status, active streaks, the surname, anything the eye should land on first. **Purple is structure**: secondary indices, archive panels, supporting labels. Nothing else gets a color. Restraint here is what keeps it from reading as generic neon.

## Palette

- `--void`: `#050509` — true black page ground
- `--panel`: `#0b0b14` — panel fill, barely lifted off the void
- `--panel2`: `#101020` — secondary/archive panel fill
- `--line`: `#23233a` — hairline borders, row dividers
- `--line2`: `#2e2e4a` — emphasized borders (tags, pipeline steps)
- `--orange`: `#ff7a2f` — primary signal
- `--orange-hi`: `#ffa45c` — lit pipeline step text
- `--purple`: `#a06bff` — structure, secondary indices
- `--purple-hi`: `#c9a3ff` — agent names, record values
- `--ink`: `#e9e6f5` — primary text
- `--dim`: `#7a7490` — comments, labels, descriptions

## Typography

Monospace throughout: `"SF Mono", ui-monospace, Menlo, Consolas, monospace`. Scale: 62px hero name, 21px section titles (uppercase, 1.5px tracking), 17-19px body, 13px labels (uppercase, wide tracking). Labels are always uppercase and letterspaced; body never is.

## Structure

- **Chamfered panels**: corners cut via `clip-path` polygon, 14px inset. Never rounded — rounded reads as consumer software.
- **Corner brackets**: 13px L-shaped marks in orange or purple, positioned at panel corners. Applied selectively (two corners for most panels, four for the hero and telemetry) so they stay an accent rather than a frame.
- **Numbered indices**: every section carries a two-digit chip (`01`-`09`), orange for primary sections, purple for secondary. These make the page read as a system with order.
- **Rules and rulers**: 1px lines flex-filling the space between title and right-hand comment; tick rulers (repeating 1px marks) as divider texture.

## Components

- **Status chips**: bordered rectangles, not pills. `LIVE` in orange with inset glow, `REPO` in purple, `INTERNAL`/`WIP` in muted grey.
- **Readout rows**: key in dim uppercase on the left, value right-aligned and bold. Used in the hero telemetry and the signal panel.
- **Pipeline steps**: chamfered boxes, numbered, with the final two (SHIP, MEASURE) lit orange to show where the work actually lands.
- **Waveform**: 21 bars, square-rooted scale, dim purple for history and orange for the active streak tail.
- **Marquee strips**: solid orange (top) and purple (bottom) bands with repeating letterspaced text, bleeding full width.

## Texture

Scanline overlay at very low opacity (`rgba(255,255,255,.014)`, 3px period) across the whole composite. Barcode strip in the hero at 28% opacity. Both baked into the rendered PNG, since GitHub strips CSS from markdown.

## Data

The telemetry panel is generated, not authored. `.github/workflows/telemetry.yml` fetches the real contributions calendar daily and re-renders from `.github/render/template.html`. Never hardcode streak numbers into the template — they go stale and misrepresent.

## Motion

None. The artifact is a static PNG by necessity.
