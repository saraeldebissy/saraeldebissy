// Builds the profile as a single animated SVG.
//
// Why one SVG: GitHub puts paragraph spacing between <img> tags, which shows
// as white bands, and it strips CSS and JS from markdown. One full-width SVG
// has no seams, and SMIL animation survives the sanitizer where CSS does not.
//
// The pixel-art scene is base64-embedded rather than referenced. An SVG loaded
// via <img> renders in a restricted context and cannot fetch external files,
// so a relative href would come back blank on GitHub.

import { readFile, writeFile } from 'node:fs/promises';

const here = (p) => new URL(p, import.meta.url);
const stats = JSON.parse(await readFile(here('./stats.json'), 'utf8'));
const sceneB64 = (await readFile(here('../../assets/scene.jpg'))).toString('base64');
const agentsB64 = (await readFile(here('../../assets/agents.png'))).toString('base64');
const geistB64 = (await readFile(here('../../assets/geist-pixel.woff2'))).toString('base64');

const W = 1200;
const PAD = 34;
const ART_H = 401; // scene.jpg is 1200×401
const pad2 = (n) => String(n).padStart(2, '0');
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Palette pulled from the artwork itself (sampled, not invented) so the UI
// below the scene reads as the same world: sunset coral, twilight violet.
const C = {
  void: '#07060f',
  panel: '#0d0b1a',
  panel2: '#110e21',
  line: '#241f3d',
  line2: '#332a52',
  orange: '#ff8a4c', // sunset in the window
  orangeHi: '#ffb584',
  purple: '#9b7bf0', // twilight wall
  purpleHi: '#c4abff',
  ink: '#ece7f8',
  dim: '#857da3',
  faint: '#574f73',
};
const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";
// Pixel display face for section titles only — body copy stays monospace for
// legibility at small sizes. An embedded @font-face with a data: URI survives
// GitHub's raw-SVG content-security-policy (default-src 'none'): that policy
// blocks network fetches, but a data URI isn't one, so nothing is blocked.
// Verified by pushing a test SVG and diffing the rendered glyph shapes
// against the monospace fallback. Subset to only the glyphs the five section
// titles use (woff2, ~7.5KB) rather than embedding the full 3.6MB font file.
const PIXEL = 'GeistPixelGH';
// Measured in-browser against the embedded font: 32px + 2.5 tracking
// advances ~22.2px/glyph, close enough to the monospace estimate (21.5) that
// existing plate-width math doesn't need separate pixel-font constants.

// Monospace advance per glyph. Measured in-browser against the stack above:
// a 19px glyph with 2px tracking occupies 13.44px, i.e. size × 0.6 + tracking.
// Every plate and panel width below is derived from this rather than guessed.
const adv = (size, tracking = 0) => size * 0.6 + tracking;

let y = 0;
const out = [];
const push = (s) => out.push(s);

/** Chamfered panel path — the corner cut that makes a box read as machined. */
const chamfer = (x, yy, w, h, c = 14) =>
  `M${x + c},${yy} H${x + w - c} L${x + w},${yy + c} V${yy + h - c} L${x + w - c},${yy + h} H${x + c} L${x},${yy + h - c} V${yy + c} Z`;

/** L-shaped corner bracket. */
function bracket(x, yy, corner, color) {
  const L = 13;
  const d = {
    tl: `M${x},${yy + L} V${yy} H${x + L}`,
    tr: `M${x - L},${yy} H${x} V${yy + L}`,
    bl: `M${x},${yy - L} V${yy} H${x + L}`,
    br: `M${x - L},${yy} H${x} V${yy - L}`,
  }[corner];
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2"/>`;
}

/** All four corner brackets on a panel at (x, top, w, h) — the page-wide
 * default. Every panel gets machined corners, not just two opposing ones. */
function brackets4(x, top, w, h, color) {
  return (
    bracket(x + 5, top + 5, 'tl', color) +
    bracket(x + w - 5, top + 5, 'tr', color) +
    bracket(x + 5, top + h - 5, 'bl', color) +
    bracket(x + w - 5, top + h - 5, 'br', color)
  );
}

/** Fade-in wrapper. Everything enters the same way, just at different times. */
const fade = (delay, dur = 0.45) =>
  `<animate attributeName="opacity" from="0" to="1" dur="${dur}s" begin="${delay}s" fill="freeze"/>`;

// ═══════════════════════════ 1. THE SCENE ═══════════════════════════
// The artwork is the first impression, so it opens the page at full bleed
// with nothing on top of it but light. Every overlay below is anchored to a
// real light source in the image and uses a colour sampled from that spot —
// this is the back-view Dubai skyline banner (Burj Khalifa, desk, books).
{
  // "meet" not "slice": the viewport matches the art's own ratio, so nothing
  // is cropped, and if the source is ever swapped for a different crop it
  // will letterbox rather than silently cut the character's head off.
  push(`<image x="0" y="0" width="${W}" height="${ART_H}"
        preserveAspectRatio="xMidYMid meet"
        href="data:image/jpeg;base64,${sceneB64}"/>`);

  // Accent rule across the very top edge, same gradient as the rule under
  // the nameplate — bookends the page with the same mark top and bottom.
  push(`<rect x="0" y="0" width="${W}" height="3" fill="url(#rule)"/>`);

  // The setting sun over the skyline, measured at x 870-964, y 140-212.
  // Pulsing its core and ringing it with a slow-breathing halo sells motion
  // without touching the skyline itself.
  push(`<ellipse cx="917" cy="176" rx="40" ry="38" fill="#ffd9a0" opacity="0.1">
    <animate attributeName="opacity" values="0.06;0.22;0.06" dur="5s" repeatCount="indefinite"/>
  </ellipse>`);

  // The laptop screen she's working on, measured x 540-679, y 220-309.
  // A soft cool breathing glow, like an editor UI redrawing.
  push(`<rect x="548" y="226" width="124" height="78" fill="#dcb8ff" opacity="0.08">
    <animate attributeName="opacity" values="0.05;0.16;0.05" dur="3.4s" repeatCount="indefinite"/>
  </rect>`);

  // The little robot's face, measured x 690-749, y 250-299. Blinking eyes.
  push(`<rect x="696" y="260" width="48" height="30" fill="#ffffff" opacity="0">
    <animate attributeName="opacity" values="0;0;0.35;0" dur="3.2s" repeatCount="indefinite"/>
  </rect>`);

  // The Nintendo Switch screen on the desk, measured x 1100-1156, y 265-329.
  push(`<rect x="1104" y="270" width="48" height="56" fill="#8fd6ff" opacity="0.08">
    <animate attributeName="opacity" values="0.05;0.18;0.05" dur="2.6s" repeatCount="indefinite"/>
  </rect>`);

  // The glowing orb lamp beside the desk, measured x 1140-1151, y 291-330.
  // Sampled colour: warm yellow (#fee976).
  push(`<ellipse cx="1146" cy="312" rx="14" ry="16" fill="#fee976" opacity="0.14">
    <animate attributeName="opacity" values="0.1;0.3;0.1" dur="1.9s" repeatCount="indefinite"/>
  </ellipse>`);

  // Sparkle motes drifting over the skyline, extending the art's own glow.
  const star = (x, yy, r, dur, delay) =>
    `<path d="M${x},${yy - r} L${x + r * 0.3},${yy - r * 0.3} L${x + r},${yy}
       L${x + r * 0.3},${yy + r * 0.3} L${x},${yy + r} L${x - r * 0.3},${yy + r * 0.3}
       L${x - r},${yy} L${x - r * 0.3},${yy - r * 0.3} Z" fill="#fff3d6" opacity="0">
       <animate attributeName="opacity" values="0;0.9;0" dur="${dur}s" begin="${delay}s"
                repeatCount="indefinite"/></path>`;
  push(star(1020, 70, 6, 3.6, 0.4) + star(1100, 110, 5, 4.4, 1.9) +
       star(820, 90, 5, 5.0, 3.1) + star(960, 50, 6, 4.0, 2.4));

  // Vignette keeps the eye centred on the character and softens the edges
  // where the art meets the panels below.
  push(`<rect x="0" y="0" width="${W}" height="${ART_H}" fill="url(#vig)"/>`);

  // CRT scanlines and a slow sweep, sold as a monitor refresh over the whole
  // scene rather than a decorative gradient.
  push(`<rect x="0" y="0" width="${W}" height="${ART_H}" fill="url(#scan)" opacity="0.55"/>`);
  push(`<rect x="0" y="-90" width="${W}" height="90" fill="url(#sweep)" opacity="0.55">
    <animate attributeName="y" from="-90" to="${ART_H}" dur="6s" repeatCount="indefinite"/>
  </rect>`);

  // Location tag. Deliberately not a clock: a baked-in time is wrong for
  // every visitor the moment it renders, and nothing here can tick.
  const tag = 'DUBAI, UAE';
  const tagW = 42 + tag.length * adv(12.5, 2.4) + 16;
  push(`<g opacity="0">${fade(0.2)}
    <rect x="${PAD}" y="26" width="${tagW.toFixed(0)}" height="27" fill="#07060f" opacity="0.78"/>
    <rect x="${PAD}" y="26" width="3" height="27" fill="${C.orange}"/>
    <rect x="${PAD + 15}" y="35" width="8" height="8" fill="${C.orange}">
      <animate attributeName="opacity" values="1;0.2;1" dur="1.5s" repeatCount="indefinite"/></rect>
    <text x="${PAD + 32}" y="45" font-family="${MONO}" font-size="12.5" font-weight="800"
          fill="${C.orangeHi}" letter-spacing="2.4">${tag}</text>
  </g>`);
  push(`<g opacity="0">${fade(0.35)}
    ${bracket(PAD, 26, 'tl', 'rgba(255,255,255,0.28)')}
    ${bracket(W - PAD, 26, 'tr', 'rgba(255,255,255,0.28)')}
    ${bracket(PAD, ART_H - 26, 'bl', 'rgba(255,255,255,0.28)')}
    ${bracket(W - PAD, ART_H - 26, 'br', 'rgba(255,255,255,0.28)')}
  </g>`);

  y = ART_H;
}

// ═══════════════════════════ 2. NAMEPLATE ═══════════════════════════
// Sits flush under the art with no gap, so the scene and the name read as one
// object. The name types in; everything else fades once typing lands.
//
// Title is stated exactly once, here, as the eyebrow tag: "forward-deployed
// designer". No other variant (product designer, design engineer, CX) runs
// anywhere on the page — the old subtitle line duplicated this as "senior
// product designer & design engineer", which both contradicted the eyebrow
// and ate the vertical space this section needed.
{
  const h = 180;
  const top = y;
  push(`<rect x="0" y="${top}" width="${W}" height="${h}" fill="${C.void}"/>`);
  push(`<rect x="0" y="${top}" width="${W}" height="2" fill="url(#rule)"/>`);

  const x = PAD;

  // Name types character by character, smaller than before — it now reads as
  // a greeting line, not the whole hero. The title moves below it instead of
  // sitting above as an eyebrow tag.
  //
  // Two traps here, both of which produced visibly wrong output previously:
  //   - textLength redistributes the advance and swallows the space between
  //     words, rendering "HI,IAMSARA".
  //   - xml:space="preserve" turns the newlines between generated <tspan>
  //     tags into real spaces, inflating the measured width. So the tspans
  //     are joined with no separator and the space is a hard &#160;.
  const NAME = 'HI, I AM SARA';
  const ORANGE_FROM = 9; // "SARA" picks up the sunset colour
  const NAME_PX = 42;
  const NAME_TRACK = 1;
  const nameW = NAME.length * adv(NAME_PX, NAME_TRACK);

  const tspans = NAME.split('')
    .map((ch, i) => {
      const fill = i >= ORANGE_FROM ? ` fill="${C.orange}"` : '';
      const glyph = ch === ' ' ? '&#160;' : esc(ch);
      return `<tspan${fill} opacity="0">${glyph}<animate attributeName="opacity" from="0" to="1" dur="0.01s" begin="${(0.5 + i * 0.075).toFixed(2)}s" fill="freeze"/></tspan>`;
    })
    .join('');
  push(`<text x="${x}" y="${top + 54}" font-family="${MONO}" font-size="${NAME_PX}" font-weight="800"
        fill="${C.ink}" letter-spacing="${NAME_TRACK}">${tspans}</text>`);

  // Cursor walks along with the text as each glyph lands, then blinks a few
  // times at the end and retires. A cursor pinned to the final position while
  // the name is still typing reads as two unrelated things.
  const step = adv(NAME_PX, NAME_TRACK);
  const typedFor = 0.5 + NAME.length * 0.075;
  const walk = NAME.split('')
    .map((_, i) => `<animate attributeName="x" to="${(x + (i + 1) * step).toFixed(1)}" dur="0.01s" begin="${(0.5 + i * 0.075).toFixed(2)}s" fill="freeze"/>`)
    .join('');
  push(`<rect x="${x}" y="${top + 22}" width="14" height="34" fill="${C.orange}" opacity="0">
    ${walk}
    <animate attributeName="opacity" values="0;1" dur="0.01s" begin="0.5s" fill="freeze"/>
    <animate attributeName="opacity" values="1;1;0;0;1" dur="0.95s" begin="${typedFor.toFixed(2)}s" repeatCount="3"/>
    <animate attributeName="opacity" from="1" to="0" dur="0.3s" begin="${(typedFor + 2.85).toFixed(2)}s" fill="freeze"/>
  </rect>`);

  // Title now sits below the name as its own line, in character.
  push(`<text x="${x}" y="${top + 92}" font-family="${MONO}" font-size="14" font-weight="700"
        fill="${C.purple}" letter-spacing="4" opacity="0">${fade(typedFor + 0.15, 0.5)}◆ FORWARD-DEPLOYED DESIGNER</text>`);

  push(`<g opacity="0">${fade(typedFor + 0.3, 0.55)}
    <text x="${x}" y="${top + 128}" font-family="${MONO}" font-size="17.5" fill="${C.dim}">I design it, build it, and ship it myself. No handoff.</text>
  </g>`);

  // Right-side readout. Width is derived from the widest key/value pair so
  // the longest row can never overflow the box. HANDOFF sits back in here
  // alongside the other status fields rather than as a standalone line.
  const readout = [
    ['BASED', 'DUBAI / UAE', C.ink],
    ['DOMAINS', 'RETAIL · FIN · SAAS', C.ink],
    ['MODE', 'EMBEDDED', C.purpleHi],
    ['HANDOFF', 'DISABLED', C.faint],
    ['STATUS', 'SHIPPING', C.orange],
  ];
  const rowW = Math.max(
    ...readout.map(([k, v]) => k.length * adv(13, 1.2) + 24 + v.length * adv(13, 0.8))
  );
  const rw = Math.ceil(rowW + 36);
  const readoutH = readout.length * 27 + 36;
  const rx = W - PAD - rw;
  const ry0 = top + (h - readoutH) / 2;
  push(`<g opacity="0">${fade(typedFor + 0.35, 0.55)}
    <rect x="${rx}" y="${ry0}" width="${rw}" height="${readoutH}" fill="${C.panel}" stroke="${C.line}"/>`);
  readout.forEach(([k, v, col], i) => {
    const ry = ry0 + 36 + i * 27;
    push(`<text x="${rx + 18}" y="${ry}" font-family="${MONO}" font-size="13" fill="${C.dim}"
          letter-spacing="1.2">${k}</text>
      <text x="${rx + rw - 18}" y="${ry}" font-family="${MONO}" font-size="13" font-weight="700"
            fill="${col}" text-anchor="end" letter-spacing="0.8">${esc(v)}</text>`);
  });
  push(`</g>`);

  // The name must never run under the readout panel.
  if (x + nameW + 26 > rx) {
    throw new Error(`Name overruns readout: ends at ${(x + nameW).toFixed(0)}, panel starts at ${rx}`);
  }
  y = top + h;
}

/** Marquee strip: the scrolling one-line pitch. Used once, at the bottom. */
function marquee() {
  const h = 36;
  const text = '  BUILD   ◆   MEASURE   ◆   LEARN   ◆   SHIP AGAIN   ◆';
  const unit = text.length * 14.6;
  push(`<rect x="0" y="${y}" width="${W}" height="${h}" fill="${C.orange}"/>
    <clipPath id="mq"><rect x="0" y="${y}" width="${W}" height="${h}"/></clipPath>
    <g clip-path="url(#mq)"><g>
      <animateTransform attributeName="transform" type="translate" from="0,0" to="${-unit},0"
                        dur="20s" repeatCount="indefinite"/>
      ${[0, 1, 2, 3]
        .map(
          (i) => `<text x="${i * unit}" y="${y + h / 2 + 6}" font-family="${MONO}" font-size="15"
            font-weight="800" fill="#1a0c06" letter-spacing="5" xml:space="preserve">${esc(text)}</text>`
        )
        .join('')}
    </g></g>`);
  y += h;
}

// Nameplate sits flush against the content below — no divider band here
// anymore; the marquee now runs at the bottom of the page instead.
y += 40;

/** Section header: index chip and title in one solid plate, stamped. */
function header(idx, title, note, accent = C.orange, delay = 0) {
  const H = 54;
  const idxW = 50;
  const PX = 30;
  const TRACK = 2.5;
  // Plate holds: left padding, the ">_" prefix, the title, right padding.
  // +10 safety margin: the pixel font's measured advance (22.2px) runs
  // slightly wider than the monospace formula (21.5px) this estimate is
  // built on, so the plate needs a little slack rather than a hairline fit.
  const titleW = 64 + title.length * adv(PX, TRACK) + 34;
  const noteW = note.length * adv(13, 1.5);
  const top = y;
  push(`<g opacity="0">${fade(delay)}
    <rect x="${PAD}" y="${top}" width="${idxW}" height="${H}" fill="${accent}"/>
    <text x="${PAD + idxW / 2}" y="${top + H / 2 + 7}" font-family="${MONO}" font-size="20" font-weight="800"
          fill="${C.void}" text-anchor="middle" letter-spacing="1">${idx}</text>
    <rect x="${PAD + idxW}" y="${top}" width="${titleW}" height="${H}" fill="${C.panel2}"
          stroke="${C.line2}" stroke-width="1"/>
    <text x="${PAD + idxW + 17}" y="${top + H / 2 + 10}" font-family="${MONO}" font-size="26" font-weight="800"
          fill="${accent}">&gt;_</text>
    <text x="${PAD + idxW + 64}" y="${top + H / 2 + 10}" font-family="${PIXEL}" font-size="${PX}" font-weight="800"
          fill="${C.ink}" letter-spacing="${TRACK}">${esc(title)}</text>
    <line x1="${PAD + idxW + titleW + 16}" y1="${top + H / 2}" x2="${(W - PAD - 14 - noteW).toFixed(1)}"
          y2="${top + H / 2}" stroke="${C.line}" stroke-width="1"/>
    <text x="${W - PAD}" y="${top + H / 2 + 5}" font-family="${MONO}" font-size="13" fill="${C.dim}"
          text-anchor="end" letter-spacing="1.5">${esc(note)}</text>
  </g>`);
  y += H + 20;
}

// ═══════════════════════════ 3. PULSE ═══════════════════════════
// Every number here comes from stats.json, refreshed daily by the workflow.
// Leads the content sections — proof the page is alive comes before the list
// of things that were built with it.
{
  header('01', 'PULSE', '// refreshed daily from github', C.orange, 1.5);
  const h = 258;
  const top = y;
  push(`<g opacity="0">${fade(1.6, 0.5)}
    <path d="${chamfer(PAD, top, W - PAD * 2, h)}" fill="${C.panel}" stroke="${C.line}"/>
    ${brackets4(PAD, top, W - PAD * 2, h, C.orange)}`);

  // Four counters across the top, equal weight — no hero metric.
  const inner = W - PAD * 2 - 48;
  const cells = [
    ['CURRENT STREAK', pad2(stats.current), 'days', C.orange],
    ['LONGEST STREAK', pad2(stats.longest), 'record', C.purpleHi],
    ['COMMITS', String(stats.commitsYear), 'past year', C.ink],
    ['REPOS', String(stats.repos), 'public', C.ink],
  ];
  const cw = (inner - 3 * 14) / 4;
  cells.forEach(([k, v, u, col], i) => {
    const cx = PAD + 24 + i * (cw + 14);
    push(`<path d="${chamfer(cx, top + 28, cw, 104, 11)}" fill="#120f23" stroke="${C.line2}"/>
      <text x="${cx + 16}" y="${top + 52}" font-family="${MONO}" font-size="12" fill="${C.dim}"
            letter-spacing="1.8">${k}</text>
      <text x="${cx + 16}" y="${top + 104}" font-family="${MONO}" font-size="44" font-weight="800"
            fill="${col}" opacity="0">${v}${fade((2.0 + i * 0.12).toFixed(2), 0.4)}</text>
      <text x="${cx + cw - 16}" y="${top + 104}" font-family="${MONO}" font-size="12" fill="${C.faint}"
            text-anchor="end" letter-spacing="1.5">${u.toUpperCase()}</text>`);
  });

  // Contribution waveform across the full width.
  const wx = PAD + 24;
  const ww = inner;
  const wh = 62;
  const wy = top + 156;
  const n = stats.waveform.length;
  const gap = 1;
  const bw = (ww - (n - 1) * gap) / n;
  stats.waveform.forEach((b, i) => {
    const bh = Math.max(2, (b.height / 100) * wh);
    const bx = wx + i * (bw + gap);
    push(`<rect x="${bx.toFixed(2)}" y="${(wy + wh - bh).toFixed(2)}" width="${bw.toFixed(2)}"
          height="${bh.toFixed(2)}" fill="${b.on ? C.orange : '#2a2446'}">
      <animate attributeName="height" from="0" to="${bh.toFixed(2)}" dur="0.5s"
               begin="${(2.3 + i * 0.01).toFixed(2)}s" fill="freeze"/>
      <animate attributeName="y" from="${wy + wh}" to="${(wy + wh - bh).toFixed(2)}" dur="0.5s"
               begin="${(2.3 + i * 0.01).toFixed(2)}s" fill="freeze"/></rect>`);
  });
  // Axis labels sit above the panel floor so they clear the corner brackets.
  push(`<text x="${wx}" y="${wy + wh + 26}" font-family="${MONO}" font-size="12.5" fill="${C.dim}"
        letter-spacing="1.3">◂ ${stats.waveformDays} DAYS AGO</text>
    <text x="${W / 2}" y="${wy + wh + 26}" font-family="${MONO}" font-size="12.5" fill="${C.faint}"
          text-anchor="middle" letter-spacing="1.3">DAILY CONTRIBUTIONS</text>
    <text x="${W - PAD - 24}" y="${wy + wh + 26}" font-family="${MONO}" font-size="12.5" fill="${C.orange}"
          text-anchor="end" letter-spacing="1.3">TODAY ▸</text></g>`);
  y = top + h + 34;
}

// ═══════════════════════════ 4. STACK ═══════════════════════════
// One flowing grid, not three category rows — design/build/AI tools are used
// together on the same projects, so splitting them implied a separation that
// doesn't reflect how the work actually happens.
//
// Each chip carries a monogram swatch in the tool's real brand colour rather
// than a reproduced logo mark: hand-drawing ~20 trademarked logo shapes from
// memory risks a visibly wrong Figma or React glyph, which reads worse than
// no logo at all. The colour is the recognisable part; the letters are a label.
{
  header('02', 'STACK', '// what I work in, together', C.purple, 2.6);
  const tools = [
    ['Figma', 'FG', '#F24E1E'],
    ['Framer', 'FR', '#0055FF'],
    ['React', 'RX', '#61DAFB'],
    ['Next.js', 'N', '#ffffff'],
    ['TypeScript', 'TS', '#3178C6'],
    ['Expo', 'EX', '#4630EB'],
    ['Supabase', 'SB', '#3ECF8E'],
    ['Vercel', 'V', '#ffffff'],
    ['Convex', 'CX', '#EE342F'],
    ['Claude Code', 'CC', '#D97757'],
    ['Codex', 'OX', '#ffffff'],
    ['Cursor', 'CU', '#ffffff'],
    ['Devin', 'DV', '#6E56CF'],
    ['Windsurf', 'WS', '#58E5C7'],
    ['Copilot', 'CP', '#ffffff'],
    ['Replit', 'RP', '#F26207'],
    ['Perplexity', 'PX', '#1FB8CD'],
    ['Obsidian', 'OB', '#A074C4'],
    ['MCP', 'MC', C.purpleHi],
    ['n8n', 'N8', '#EA4B71'],
    ['v0', 'V0', '#ffffff'],
  ];

  // Flow left-to-right, wrapping to a new row when a chip won't fit — the
  // grid's own height falls out of how many rows that takes, rather than a
  // fixed row count baked in ahead of time.
  const innerW = W - PAD * 2 - 48;
  const rowGap = 14;
  const chipH = 40;
  const positions = [];
  {
    let tx = 0, ty = 0, rowMaxH = chipH;
    tools.forEach(([name]) => {
      const tw = 34 + name.length * 9.3 + 16;
      if (tx + tw > innerW && tx > 0) {
        tx = 0;
        ty += chipH + rowGap;
      }
      positions.push({ x: tx, y: ty, w: tw });
      tx += tw + 10;
    });
    rowMaxH = ty + chipH;
    positions.rowsHeight = rowMaxH;
  }
  const h = 48 + positions.rowsHeight;
  const top = y;
  push(`<g opacity="0">${fade(2.7, 0.5)}
    <path d="${chamfer(PAD, top, W - PAD * 2, h)}" fill="${C.panel}" stroke="${C.line}"/>
    ${brackets4(PAD, top, W - PAD * 2, h, C.purple)}`);
  tools.forEach(([name, mono, color], i) => {
    const { x: px, y: py, w: tw } = positions[i];
    const cx = PAD + 24 + px;
    const cy = top + 24 + py;
    push(`<g opacity="0">${fade((3.0 + i * 0.04).toFixed(2), 0.3)}
      <path d="M${cx + 7},${cy} H${cx + tw} V${cy + chipH - 7} L${cx + tw - 7},${cy + chipH} H${cx} V${cy + 7} Z"
            fill="#120f23" stroke="${C.line2}"/>
      <rect x="${cx + 8}" y="${cy + 8}" width="24" height="24" rx="4" fill="${color}"/>
      <text x="${cx + 20}" y="${cy + 25}" font-family="${MONO}" font-size="10" font-weight="800"
            fill="${C.void}" text-anchor="middle" letter-spacing="0.5">${esc(mono)}</text>
      <text x="${cx + 40}" y="${cy + 25}" font-family="${MONO}" font-size="14.5" fill="${C.ink}">${esc(name)}</text>
    </g>`);
  });
  push(`</g>`);
  y = top + h + 36;
}

// ═══════════════════════════ 5. BUILDS ═══════════════════════════
// Hidden for now — set to true to bring it back.
const SHOW_BUILDS = false;
if (SHOW_BUILDS) {
  header('03', 'BUILDS', '// things I made and shipped', C.orange, 3.5);
  const tools = [
    ['UX Research Skills', 'Reusable Claude skills for responsible UX research.', 'repo'],
    ['Vibe Generator', 'Prompt generator for people who build by vibe.', 'live'],
    ['Skill Atlas', 'Mapping the full surface of product design capability.', 'live'],
    ['NPS Insight Agent', 'Groups comments into themes, tracks weekly trends.', 'work'],
    ['Research Repo', 'A searchable home for studies, insights and evidence.', 'work'],
  ];
  const more = ['Git Advisor', 'Mobbin MCP', 'Design Skills', 'Build Bouncer', 'Bug Platform'];

  const rowH = 58;
  const h = 40 + tools.length * rowH;
  const leftW = 752;
  const top = y;

  push(`<g opacity="0">${fade(3.6, 0.5)}
    <path d="${chamfer(PAD, top, leftW, h)}" fill="${C.panel}" stroke="${C.line}"/>
    ${brackets4(PAD, top, leftW, h, C.orange)}`);
  tools.forEach(([name, desc, kind], i) => {
    const ry = top + 48 + i * rowH;
    if (i) push(`<line x1="${PAD + 22}" y1="${ry - 27}" x2="${PAD + leftW - 22}" y2="${ry - 27}" stroke="${C.line}"/>`);
    push(`<g opacity="0">${fade((3.9 + i * 0.1).toFixed(2), 0.35)}
      <text x="${PAD + 24}" y="${ry}" font-family="${MONO}" font-size="13.5" font-weight="800"
            fill="${C.purple}">${pad2(i + 1)}</text>
      <text x="${PAD + 64}" y="${ry}" font-family="${MONO}" font-size="19" font-weight="700" fill="${C.ink}">${esc(name)}</text>
      <text x="${PAD + 64}" y="${ry + 23}" font-family="${MONO}" font-size="15" fill="${C.dim}">${esc(desc)}</text>`);
    const col = kind === 'live' ? C.orange : kind === 'repo' ? C.purpleHi : C.faint;
    const bc = kind === 'live' ? C.orange : kind === 'repo' ? '#4b3a78' : '#2b2546';
    const tw = kind.length * 10 + 22;
    push(`<rect x="${PAD + leftW - 24 - tw}" y="${ry - 16}" width="${tw}" height="26" fill="none" stroke="${bc}"/>
      <text x="${PAD + leftW - 24 - tw / 2}" y="${ry + 2}" font-family="${MONO}" font-size="12.5" font-weight="800"
            fill="${col}" text-anchor="middle" letter-spacing="1.6">${kind.toUpperCase()}</text>`);
    if (kind === 'live') {
      push(`<rect x="${PAD + leftW - 24 - tw}" y="${ry - 16}" width="${tw}" height="26" fill="${C.orange}" opacity="0.12">
        <animate attributeName="opacity" values="0.04;0.2;0.04" dur="2.4s" repeatCount="indefinite"/></rect>`);
    }
    push(`</g>`);
  });
  push(`</g>`);

  const rx = PAD + leftW + 16;
  const rw = W - PAD - rx;
  push(`<g opacity="0">${fade(3.9, 0.5)}
    <path d="${chamfer(rx, top, rw, h)}" fill="${C.panel2}" stroke="${C.line}"/>
    ${brackets4(rx, top, rw, h, C.purple)}
    <text x="${rx + 22}" y="${top + 40}" font-family="${MONO}" font-size="18" font-weight="800"
          fill="${C.purpleHi}" letter-spacing="2">ALSO BUILT</text>`);
  more.forEach((name, i) => {
    const ry = top + 80 + i * 32;
    push(`<text x="${rx + 22}" y="${ry}" font-family="${MONO}" font-size="12.5" fill="${C.faint}">${pad2(i + 6)}</text>
      <text x="${rx + 56}" y="${ry}" font-family="${MONO}" font-size="16" fill="${C.ink}">${esc(name)}</text>`);
  });
  push(`<text x="${rx + 22}" y="${top + h - 24}" font-family="${MONO}" font-size="12.5" fill="${C.faint}"
        letter-spacing="1.4">${stats.repos} REPOS INDEXED</text></g>`);
  y = top + h + 36;
}

// ═══════════════════════════ 6. AGENT ROSTER ═══════════════════════════
// The agent squad that actually builds this page, named and in character.
{
  header(SHOW_BUILDS ? '04' : '03', 'AGENT ROSTER', '// a little chaotic, mostly helpful', C.purple, SHOW_BUILDS ? 5.0 : 3.5);
  // Described in third person, what each one does — not a quote in their
  // voice. Quotes read as a bit much for a roster that's meant to be a quick
  // scan, not a cast of characters speaking for themselves.
  const agents = [
    ['RATCHET', 'Execution — builds the page end to end.', 'execution'],
    ['GUSTAVE', 'Direction — sets the plan before anything ships.', 'direction'],
    ['SIX', 'Judgment — stress-tests the work before it goes live.', 'judgment'],
    ['ALOY', 'Intel — researches patterns and precedent first.', 'intel'],
    ['HAZEL', 'Voice — writes copy that sounds like Sara, not a template.', 'voice'],
  ];

  // One container, no internal divider — the image sits inside the same
  // panel as the list rather than being walled off from it. Sized to its own
  // aspect ratio (900×698) so the mascot squad never stretches or crops.
  const AGENTS_IMG_W = 900, AGENTS_IMG_H = 698;
  const imgW = 240;
  const imgH = Math.round((imgW * AGENTS_IMG_H) / AGENTS_IMG_W);
  const rowH = 38;
  const listH = agents.length * rowH;
  const pad = 16;
  const h = Math.max(listH + pad * 2, imgH + pad * 2);
  // Nudged left off the right edge rather than flush against it, so the
  // panel keeps a consistent margin on both sides of the image.
  const leftW = W - PAD * 2 - imgW - 36;
  const top = y;

  push(`<g opacity="0">${fade(5.1, 0.5)}
    <path d="${chamfer(PAD, top, W - PAD * 2, h)}" fill="${C.panel}" stroke="${C.line}"/>
    ${brackets4(PAD, top, W - PAD * 2, h, C.purple)}`);
  const listTop = top + (h - listH) / 2;
  agents.forEach(([name, desc], i) => {
    const ry = listTop + i * rowH + rowH * 0.68;
    push(`<g opacity="0">${fade((5.4 + i * 0.12).toFixed(2), 0.3)}
      <text x="${PAD + 24}" y="${ry}" font-family="${MONO}" font-size="13" fill="${C.faint}">${pad2(i + 1)}</text>
      <text x="${PAD + 62}" y="${ry}" font-family="${MONO}" font-size="17" font-weight="800"
            fill="${C.purpleHi}" letter-spacing="1.6">${esc(name)}</text>
      <text x="${PAD + 204}" y="${ry}" font-family="${MONO}" font-size="14.5" fill="${C.dim}">${esc(desc)}</text></g>`);
  });
  push(`</g>`);

  // Image sits inside the shared panel, vertically centred, no seam.
  const ix = PAD + leftW + 20;
  const iw = W - PAD - ix - 16;
  const scale = iw / imgW;
  const drawH = Math.round(imgH * scale);
  const iy = top + Math.round((h - drawH) / 2);
  push(`<g opacity="0">${fade(5.2, 0.6)}
    <image x="${ix}" y="${iy}" width="${iw}" height="${drawH}"
           preserveAspectRatio="xMidYMid meet"
           href="data:image/png;base64,${agentsB64}"/>
  </g>`);

  y = top + h + 36;
}

// Closing marquee: bookends the opening art, now at the bottom of the page
// instead of splitting the nameplate from the content.
marquee();

// ═══════════════════════════ 7. FOOTER ═══════════════════════════
{
  const h = 64;
  const top = y;
  push(`<rect x="0" y="${top}" width="${W}" height="2" fill="url(#rule)"/>`);
  push(`<g opacity="0">${fade(6.2, 0.5)}
    <text x="${PAD}" y="${top + 40}" font-family="${MONO}" font-size="15" fill="${C.dim}"
          letter-spacing="1.4">Say hi ▸ I like talking about design that ships.</text>
    <text x="${W - PAD}" y="${top + 40}" font-family="${MONO}" font-size="12.5" fill="${C.faint}"
          text-anchor="end" letter-spacing="1.6">LAST SYNC ${stats.generated}</text>
  </g>`);
  y = top + h;
}

const H = y;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${MONO}">
<defs>
  <style>
    @font-face {
      font-family: '${PIXEL}';
      src: url(data:font/woff2;base64,${geistB64}) format('woff2');
    }
  </style>
  <pattern id="scan" width="3" height="3" patternUnits="userSpaceOnUse">
    <rect width="3" height="2" fill="none"/>
    <rect y="2" width="3" height="1" fill="#000000" opacity="0.14"/>
  </pattern>
  <linearGradient id="sweep" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#ffffff" stop-opacity="0"/>
    <stop offset="50%" stop-color="#ffffff" stop-opacity="0.05"/>
    <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="vig" cx="0.5" cy="0.46" r="0.78">
    <stop offset="55%" stop-color="${C.void}" stop-opacity="0"/>
    <stop offset="100%" stop-color="${C.void}" stop-opacity="0.72"/>
  </radialGradient>
  <linearGradient id="rule" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stop-color="${C.orange}"/>
    <stop offset="55%" stop-color="${C.purple}"/>
    <stop offset="100%" stop-color="${C.void}"/>
  </linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="${C.void}"/>
${out.join('\n')}
</svg>`;

await writeFile(here('../../assets/profile.svg'), svg);
console.log(
  `profile.svg — ${W}×${H} (was 2781), streak ${stats.current}, record ${stats.longest}, ${stats.waveform.length} bars`
);
