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

const W = 1200;
const PAD = 34;
const ART_H = 384; // scene.jpg is 1200×384
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

/** Fade-in wrapper. Everything enters the same way, just at different times. */
const fade = (delay, dur = 0.45) =>
  `<animate attributeName="opacity" from="0" to="1" dur="${dur}s" begin="${delay}s" fill="freeze"/>`;

// ═══════════════════════════ 1. THE SCENE ═══════════════════════════
// The artwork is the first impression, so it opens the page at full bleed
// with nothing on top of it but light. Every overlay below is anchored to a
// real light source in the image and uses a colour sampled from that spot.
{
  // "meet" not "slice": the viewport matches the art's own 3.126:1 ratio, so
  // nothing is cropped, and if the source is ever swapped for a different
  // crop it will letterbox rather than silently cut the character's head off.
  push(`<image x="0" y="0" width="${W}" height="${ART_H}"
        preserveAspectRatio="xMidYMid meet"
        href="data:image/jpeg;base64,${sceneB64}"/>`);

  // The CRT on the left already shows a ">_" prompt. Measured: glyphs occupy
  // x 129-196, y 175-234. A block cursor sits just past the underscore.
  push(`<rect x="205" y="214" width="15" height="9" fill="#f6e4d2" opacity="0.9">
    <animate attributeName="opacity" values="0.9;0.9;0;0" dur="1.1s" repeatCount="indefinite"/>
  </rect>`);

  // Screen phosphor breathing. Clipped to the screen interior so the glow
  // never spills onto the bezel.
  push(`<rect x="100" y="152" width="136" height="112" fill="#6f58d8" opacity="0.06">
    <animate attributeName="opacity" values="0.04;0.13;0.04" dur="4.2s" repeatCount="indefinite"/>
  </rect>`);

  // Lit windows in the skyline. Coordinates and the warm tone come from
  // sampling the brightest warm pixels in the city band.
  const windows = [
    [935, 122, 7, 5, 3.1, 0.0], [728, 137, 6, 5, 4.4, 1.2],
    [809, 140, 7, 6, 3.7, 0.6], [683, 146, 6, 5, 5.1, 2.1],
    [869, 164, 7, 5, 4.0, 1.7], [647, 176, 6, 6, 3.4, 0.9],
    [905, 152, 6, 5, 4.8, 2.6], [771, 165, 6, 5, 3.9, 1.5],
  ];
  windows.forEach(([x, yy, w, h, dur, delay]) => {
    push(`<rect x="${x}" y="${yy}" width="${w}" height="${h}" fill="#ffe9b0" opacity="0.5">
      <animate attributeName="opacity" values="0.15;0.75;0.3;0.6;0.15" dur="${dur}s"
               begin="${delay}s" repeatCount="indefinite"/></rect>`);
  });

  // Sparkles in the sunset. The art already has a few; these extend the idea.
  const star = (x, yy, r, dur, delay) =>
    `<path d="M${x},${yy - r} L${x + r * 0.3},${yy - r * 0.3} L${x + r},${yy}
       L${x + r * 0.3},${yy + r * 0.3} L${x},${yy + r} L${x - r * 0.3},${yy + r * 0.3}
       L${x - r},${yy} L${x - r * 0.3},${yy - r * 0.3} Z" fill="#fff3d6" opacity="0">
       <animate attributeName="opacity" values="0;0.95;0" dur="${dur}s" begin="${delay}s"
                repeatCount="indefinite"/></path>`;
  push(star(762, 62, 7, 3.6, 0.4) + star(986, 84, 5, 4.4, 1.9) +
       star(676, 48, 5, 5.0, 3.1) + star(884, 58, 6, 4.0, 2.4) +
       star(1046, 112, 4, 3.3, 1.1));

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
{
  const h = 182;
  const top = y;
  push(`<rect x="0" y="${top}" width="${W}" height="${h}" fill="${C.void}"/>`);
  push(`<rect x="0" y="${top}" width="${W}" height="2" fill="url(#rule)"/>`);

  const x = PAD;
  push(`<text x="${x}" y="${top + 38}" font-family="${MONO}" font-size="12.5" font-weight="700"
        fill="${C.purple}" letter-spacing="4.5" opacity="0">${fade(0.3)}◆ FORWARD-DEPLOYED DESIGNER</text>`);

  // Name types character by character.
  //
  // Two traps here, both of which produced visibly wrong output before:
  //   - textLength redistributes the advance and swallows the space between
  //     the names, rendering "SARAKHALIL".
  //   - xml:space="preserve" turns the newlines between generated <tspan>
  //     tags into real spaces, inflating the name from 422px to 881px. So the
  //     tspans are joined with no separator and the space is a hard &#160;.
  const NAME = 'SARA KHALIL';
  const ORANGE_FROM = 5; // "KHALIL" picks up the sunset colour
  const NAME_PX = 62;
  const NAME_TRACK = 1;
  const nameW = NAME.length * adv(NAME_PX, NAME_TRACK);

  const tspans = NAME.split('')
    .map((ch, i) => {
      const fill = i >= ORANGE_FROM ? ` fill="${C.orange}"` : '';
      const glyph = ch === ' ' ? '&#160;' : esc(ch);
      return `<tspan${fill} opacity="0">${glyph}<animate attributeName="opacity" from="0" to="1" dur="0.01s" begin="${(0.5 + i * 0.075).toFixed(2)}s" fill="freeze"/></tspan>`;
    })
    .join('');
  push(`<text x="${x}" y="${top + 104}" font-family="${MONO}" font-size="${NAME_PX}" font-weight="800"
        fill="${C.ink}" letter-spacing="${NAME_TRACK}">${tspans}</text>`);

  // Cursor walks along with the text as each glyph lands, then blinks a few
  // times at the end and retires. A cursor pinned to the final position while
  // the name is still typing reads as two unrelated things.
  const step = adv(NAME_PX, NAME_TRACK);
  const typedFor = 0.5 + NAME.length * 0.075;
  const walk = NAME.split('')
    .map((_, i) => `<animate attributeName="x" to="${(x + (i + 1) * step).toFixed(1)}" dur="0.01s" begin="${(0.5 + i * 0.075).toFixed(2)}s" fill="freeze"/>`)
    .join('');
  push(`<rect x="${x}" y="${top + 62}" width="20" height="50" fill="${C.orange}" opacity="0">
    ${walk}
    <animate attributeName="opacity" values="0;1" dur="0.01s" begin="0.5s" fill="freeze"/>
    <animate attributeName="opacity" values="1;1;0;0;1" dur="0.95s" begin="${typedFor.toFixed(2)}s" repeatCount="3"/>
    <animate attributeName="opacity" from="1" to="0" dur="0.3s" begin="${(typedFor + 2.85).toFixed(2)}s" fill="freeze"/>
  </rect>`);

  push(`<g opacity="0">${fade(typedFor + 0.2, 0.55)}
    <text x="${x}" y="${top + 140}" font-family="${MONO}" font-size="19" font-weight="700"
          fill="${C.ink}" letter-spacing="2">SENIOR PRODUCT DESIGNER &amp; DESIGN ENGINEER</text>
    <text x="${x}" y="${top + 166}" font-family="${MONO}" font-size="16.5" fill="${C.dim}">I design it, build it, and ship it myself. No handoff.</text>
  </g>`);

  // Right-side readout. Width is derived from the widest key/value pair so
  // the longest row can never overflow the box.
  const readout = [
    ['BASED', 'DUBAI / UAE', C.ink],
    ['DOMAINS', 'RETAIL · FIN · SAAS', C.ink],
    ['MODE', 'EMBEDDED', C.purpleHi],
    ['STATUS', 'SHIPPING', C.orange],
  ];
  const rowW = Math.max(
    ...readout.map(([k, v]) => k.length * adv(13, 1.2) + 24 + v.length * adv(13, 0.8))
  );
  const rw = Math.ceil(rowW + 36);
  const rx = W - PAD - rw;
  push(`<g opacity="0">${fade(typedFor + 0.35, 0.55)}
    <rect x="${rx}" y="${top + 30}" width="${rw}" height="124" fill="${C.panel}" stroke="${C.line}"/>`);
  readout.forEach(([k, v, col], i) => {
    const ry = top + 58 + i * 27;
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

// Divider marquee: carries the one-line pitch and separates art from content.
{
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
  y += h + 40;
}

/** Section header: index chip and title in one solid plate, stamped. */
function header(idx, title, note, accent = C.orange, delay = 0) {
  const H = 54;
  const idxW = 50;
  const PX = 32;
  const TRACK = 2.5;
  // Plate holds: left padding, the ">_" prefix, the title, right padding.
  const titleW = 64 + title.length * adv(PX, TRACK) + 24;
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
    <text x="${PAD + idxW + 64}" y="${top + H / 2 + 11}" font-family="${MONO}" font-size="${PX}" font-weight="800"
          fill="${C.ink}" letter-spacing="${TRACK}">${esc(title)}</text>
    <line x1="${PAD + idxW + titleW + 16}" y1="${top + H / 2}" x2="${(W - PAD - 14 - noteW).toFixed(1)}"
          y2="${top + H / 2}" stroke="${C.line}" stroke-width="1"/>
    <text x="${W - PAD}" y="${top + H / 2 + 5}" font-family="${MONO}" font-size="13" fill="${C.dim}"
          text-anchor="end" letter-spacing="1.5">${esc(note)}</text>
  </g>`);
  y += H + 20;
}

// ═══════════════════════════ 3. BUILDS ═══════════════════════════
{
  header('01', 'BUILDS', '// things I made and shipped', C.orange, 1.5);
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

  push(`<g opacity="0">${fade(1.6, 0.5)}
    <path d="${chamfer(PAD, top, leftW, h)}" fill="${C.panel}" stroke="${C.line}"/>
    ${bracket(PAD + 5, top + 5, 'tl', C.orange)}${bracket(PAD + leftW - 5, top + h - 5, 'br', C.orange)}`);
  tools.forEach(([name, desc, kind], i) => {
    const ry = top + 48 + i * rowH;
    if (i) push(`<line x1="${PAD + 22}" y1="${ry - 27}" x2="${PAD + leftW - 22}" y2="${ry - 27}" stroke="${C.line}"/>`);
    push(`<g opacity="0">${fade((1.9 + i * 0.1).toFixed(2), 0.35)}
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
  push(`<g opacity="0">${fade(1.9, 0.5)}
    <path d="${chamfer(rx, top, rw, h)}" fill="${C.panel2}" stroke="${C.line}"/>
    ${bracket(rx + rw - 5, top + 5, 'tr', C.purple)}${bracket(rx + 5, top + h - 5, 'bl', C.purple)}
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

// ═══════════════════════════ 4. STACK ═══════════════════════════
{
  header('02', 'STACK', '// what I work in', C.purple, 2.4);
  const groups = [
    ['DESIGN', ['Figma', 'Framer', 'Design Systems', 'Research', 'CRO']],
    ['BUILD', ['React', 'Next.js', 'TypeScript', 'Expo', 'Supabase', 'Vercel']],
    ['AI', ['Claude Code', 'Codex', 'MCP', 'n8n', 'v0']],
  ];
  const h = 30 + groups.length * 56;
  const top = y;
  push(`<g opacity="0">${fade(2.5, 0.5)}
    <path d="${chamfer(PAD, top, W - PAD * 2, h)}" fill="${C.panel}" stroke="${C.line}"/>
    ${bracket(PAD + 5, top + 5, 'tl', C.purple)}${bracket(W - PAD - 5, top + h - 5, 'br', C.purple)}`);
  groups.forEach(([label, items], gi) => {
    const ry = top + 52 + gi * 56;
    push(`<text x="${PAD + 24}" y="${ry}" font-family="${MONO}" font-size="13.5" font-weight="800"
          fill="${C.purple}" letter-spacing="2.5">${label}</text>`);
    let tx = PAD + 126;
    items.forEach((it, ii) => {
      const tw = it.length * 9.9 + 26;
      push(`<g opacity="0">${fade((2.8 + gi * 0.16 + ii * 0.05).toFixed(2), 0.3)}
        <path d="M${tx + 7},${ry - 21} H${tx + tw} V${ry + 5} L${tx + tw - 7},${ry + 12} H${tx} V${ry - 14} Z"
              fill="#120f23" stroke="${C.line2}"/>
        <text x="${tx + tw / 2}" y="${ry}" font-family="${MONO}" font-size="15.5" fill="${C.ink}"
              text-anchor="middle">${esc(it)}</text></g>`);
      tx += tw + 10;
    });
  });
  push(`</g>`);
  y = top + h + 36;
}

// ═══════════════════════════ 5. TELEMETRY ═══════════════════════════
// Every number here comes from stats.json, refreshed daily by the workflow.
{
  header('03', 'TELEMETRY', '// refreshed daily from github', C.orange, 3.2);
  const h = 258;
  const top = y;
  push(`<g opacity="0">${fade(3.3, 0.5)}
    <path d="${chamfer(PAD, top, W - PAD * 2, h)}" fill="${C.panel}" stroke="${C.line}"/>
    ${bracket(PAD + 5, top + 5, 'tl', C.orange)}${bracket(W - PAD - 5, top + 5, 'tr', C.orange)}
    ${bracket(PAD + 5, top + h - 5, 'bl', C.orange)}${bracket(W - PAD - 5, top + h - 5, 'br', C.orange)}`);

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
            fill="${col}" opacity="0">${v}${fade((3.7 + i * 0.12).toFixed(2), 0.4)}</text>
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
               begin="${(4.0 + i * 0.01).toFixed(2)}s" fill="freeze"/>
      <animate attributeName="y" from="${wy + wh}" to="${(wy + wh - bh).toFixed(2)}" dur="0.5s"
               begin="${(4.0 + i * 0.01).toFixed(2)}s" fill="freeze"/></rect>`);
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

// ═══════════════════════════ 6. FOOTER ═══════════════════════════
{
  const h = 64;
  const top = y;
  push(`<rect x="0" y="${top}" width="${W}" height="2" fill="url(#rule)"/>`);
  push(`<g opacity="0">${fade(4.4, 0.5)}
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
