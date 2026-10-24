// Builds the profile banner as a single animated SVG.
//
// Why SVG rather than the PNG this replaced: a PNG has to be several
// separate <img> tags to keep the live widgets and social links working,
// and GitHub puts paragraph spacing between them, which shows as white
// bands. One full-width SVG has no seams. SMIL animation also survives
// GitHub's sanitizer, where CSS and JS do not.

import { readFile, writeFile } from 'node:fs/promises';

const here = (p) => new URL(p, import.meta.url);
const stats = JSON.parse(await readFile(here('./stats.json'), 'utf8'));

const W = 1200;
const PAD = 34;
const pad2 = (n) => String(n).padStart(2, '0');
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const C = {
  void: '#050509',
  panel: '#0b0b14',
  panel2: '#101020',
  raised: '#13131f',
  line: '#23233a',
  line2: '#2e2e4a',
  orange: '#ff7a2f',
  orangeHi: '#ffa45c',
  purple: '#a06bff',
  purpleHi: '#c9a3ff',
  ink: '#e9e6f5',
  dim: '#7a7490',
};
const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";

let y = 0;
const out = [];
const push = (s) => out.push(s);

/** Chamfered panel path, matching the clip-path the HTML version used. */
const chamfer = (x, yy, w, h, c = 14) =>
  `M${x + c},${yy} H${x + w - c} L${x + w},${yy + c} V${yy + h - c} L${x + w - c},${yy + h} H${x + c} L${x},${yy + h - c} V${yy + c} Z`;

/** L-shaped corner bracket. */
function bracket(x, yy, corner, color) {
  const L = 14;
  const d = {
    tl: `M${x},${yy + L} V${yy} H${x + L}`,
    tr: `M${x - L},${yy} H${x} V${yy + L}`,
    bl: `M${x},${yy - L} V${yy} H${x + L}`,
    br: `M${x - L},${yy} H${x} V${yy - L}`,
  }[corner];
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2"/>`;
}

/**
 * Section header. The index chip and title sit in one solid plate so the
 * header lands as a stamped mark instead of small text on a rule.
 */
function header(idx, title, note, accent = C.orange, delay = 0) {
  const H = 56;
  const idxW = 52;
  // Monospace at 34px with 2.5px tracking advances ~23.0px per glyph. The
  // plate also holds the ">_" prefix and padding on both sides.
  const titleW = 68 + title.length * 23.0 + 22;
  const top = y;
  push(`<g opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.45s" begin="${delay}s" fill="freeze"/>
    <rect x="${PAD}" y="${top}" width="${idxW}" height="${H}" fill="${accent}"/>
    <text x="${PAD + idxW / 2}" y="${top + H / 2 + 7}" font-family="${MONO}" font-size="21" font-weight="800"
          fill="${C.void}" text-anchor="middle" letter-spacing="1">${idx}</text>
    <rect x="${PAD + idxW}" y="${top}" width="${titleW}" height="${H}" fill="${C.raised}"
          stroke="${C.line2}" stroke-width="1"/>
    <text x="${PAD + idxW + 18}" y="${top + H / 2 + 11}" font-family="${MONO}" font-size="28" font-weight="800"
          fill="${accent}">&gt;_</text>
    <text x="${PAD + idxW + 68}" y="${top + H / 2 + 12}" font-family="${MONO}" font-size="34" font-weight="800"
          fill="${C.ink}" letter-spacing="2.5">${esc(title)}</text>
    <line x1="${PAD + idxW + titleW + 16}" y1="${top + H / 2}" x2="${W - PAD - 16 - note.length * 7.9}"
          y2="${top + H / 2}" stroke="${C.line}" stroke-width="1"/>
    <text x="${W - PAD}" y="${top + H / 2 + 5}" font-family="${MONO}" font-size="13" fill="${C.dim}"
          text-anchor="end" letter-spacing="1.5">${esc(note)}</text>
  </g>`);
  y += H + 20;
}

/** Panel frame with brackets; caller draws contents and closes with endPanel. */
let panelStack = [];
function panel(h, { fill = C.panel, corners = ['tl', 'br'], accent = C.orange, delay = 0 } = {}) {
  const top = y;
  push(`<g opacity="0">
    <animate attributeName="opacity" from="0" to="1" dur="0.5s" begin="${delay}s" fill="freeze"/>
    <path d="${chamfer(PAD, top, W - PAD * 2, h)}" fill="${fill}" stroke="${C.line}" stroke-width="1"/>
    ${corners
      .map((c) => {
        const x = c.endsWith('l') ? PAD + 5 : W - PAD - 5;
        const yy = c.startsWith('t') ? top + 5 : top + h - 5;
        return bracket(x, yy, c, accent);
      })
      .join('')}`);
  panelStack.push(top);
  return top;
}
function endPanel(h) {
  const top = panelStack.pop();
  push(`</g>`);
  y = top + h + 18;
}

// ─────────────────────────────── MARQUEE ───────────────────────────────
function marquee(text, bg, fg, yy, h = 38) {
  const unit = text.length * 14.6;
  return `<g>
    <rect x="0" y="${yy}" width="${W}" height="${h}" fill="${bg}"/>
    <clipPath id="mq${yy}"><rect x="0" y="${yy}" width="${W}" height="${h}"/></clipPath>
    <g clip-path="url(#mq${yy})">
      <g>
        <animateTransform attributeName="transform" type="translate" from="0,0" to="${-unit},0"
                          dur="22s" repeatCount="indefinite"/>
        ${[0, 1, 2, 3]
          .map(
            (i) =>
              `<text x="${i * unit}" y="${yy + h / 2 + 6}" font-family="${MONO}" font-size="16"
                font-weight="800" fill="${fg}" letter-spacing="5" xml:space="preserve">${esc(text)}</text>`
          )
          .join('')}
      </g>
    </g>
  </g>`;
}

// ═══════════════════════════════ BUILD ═══════════════════════════════

// Boot overlay plays once, then the page fades in underneath it.
const BOOT = 2.6;

push(marquee(
  '  FORWARD-DEPLOYED DESIGNER   ◆   DESIGN ENGINEER   ◆   DUBAI, UAE   ◆   SHIPS WHAT SHE DESIGNS   ◆',
  C.orange, '#0a0608', y
));
y += 38 + 22;

// ─────────────────────────────── HERO ───────────────────────────────
{
  const h = 236;
  const top = panel(h, { corners: ['tl', 'tr', 'bl', 'br'], delay: BOOT + 0.1 });
  const x = PAD + 30;

  push(`<text x="${x}" y="${top + 42}" font-family="${MONO}" font-size="13" font-weight="700"
        fill="${C.purple}" letter-spacing="4">◆ IDENTITY CONFIRMED  /  SYS.0x4F2</text>`);

  // Name types in character by character.
  const first = 'SARA ', last = 'KHALIL';
  // Sized to clear the readout panel on the right. Monospace advance at
  // 52px is ~31.3px/glyph, which the cursor position below relies on.
  // textLength is avoided deliberately: it redistributes the advance and
  // swallows the space between the two names.
  const NAME_PX = 52;
  push(`<text x="${x}" y="${top + 104}" font-family="${MONO}" font-size="${NAME_PX}" font-weight="800"
        fill="${C.ink}" letter-spacing="1" xml:space="preserve">`);
  first.split('').forEach((ch, i) => {
    push(`<tspan opacity="0">${esc(ch)}<animate attributeName="opacity" from="0" to="1" dur="0.01s"
      begin="${BOOT + 0.3 + i * 0.07}s" fill="freeze"/></tspan>`);
  });
  last.split('').forEach((ch, i) => {
    push(`<tspan fill="${C.orange}" opacity="0">${esc(ch)}<animate attributeName="opacity" from="0" to="1"
      dur="0.01s" begin="${BOOT + 0.3 + (first.length + i) * 0.07}s" fill="freeze"/></tspan>`);
  });
  push(`</text>`);

  // Cursor blinks at the end of the name, then disappears.
  const cursorX = x + (first.length + last.length) * 32.3 + 4;
  push(`<rect x="${cursorX}" y="${top + 68}" width="18" height="42" fill="${C.orange}" opacity="0">
    <animate attributeName="opacity" values="0;1" dur="0.01s" begin="${BOOT + 0.3}s" fill="freeze"/>
    <animate attributeName="opacity" values="1;1;0;0;1" dur="0.9s"
             begin="${BOOT + 0.3}s" repeatCount="4"/>
    <animate attributeName="opacity" from="1" to="0" dur="0.01s" begin="${BOOT + 4.2}s" fill="freeze"/>
  </rect>`);

  push(`<g opacity="0"><animate attributeName="opacity" from="0" to="1" dur="0.5s" begin="${BOOT + 1.2}s" fill="freeze"/>
    <text x="${x}" y="${top + 146}" font-family="${MONO}" font-size="19" font-weight="700"
          fill="${C.ink}" letter-spacing="2.5">SENIOR PRODUCT DESIGNER &amp; DESIGN ENGINEER</text>
    <text x="${x}" y="${top + 174}" font-family="${MONO}" font-size="17" fill="${C.dim}">I design it, build it, and ship it myself.</text>
    <text x="${x}" y="${top + 200}" font-family="${MONO}" font-size="17" font-weight="700"
          fill="${C.purpleHi}">Design × Research × Engineering × AI</text>
  </g>`);

  // Telemetry readout.
  const rx = W - PAD - 330, rw = 300;
  push(`<g opacity="0"><animate attributeName="opacity" from="0" to="1" dur="0.5s" begin="${BOOT + 0.6}s" fill="freeze"/>
    <rect x="${rx}" y="${top + 22}" width="${rw}" height="${h - 44}" fill="#07070e" stroke="${C.line}" stroke-width="1"/>`);
  const rows = [
    ['status', 'ONLINE', C.orange, true],
    ['location', 'DUBAI / UAE', C.ink],
    ['discipline', 'DESIGN × ENG', C.purpleHi],
    ['domains', 'RETAIL · FIN · SAAS', C.ink],
    ['mode', 'EMBEDDED', C.purpleHi],
    ['handoff', 'DISABLED', C.orange],
  ];
  rows.forEach(([k, v, col, led], i) => {
    const ry = top + 50 + i * 25;
    push(`<text x="${rx + 16}" y="${ry}" font-family="${MONO}" font-size="13.5" fill="${C.dim}"
          letter-spacing="0.8">${esc(k.toUpperCase())}</text>`);
    if (led) {
      push(`<rect x="${rx + rw - 16 - v.length * 8.1 - 16}" y="${ry - 9}" width="9" height="9" fill="${C.orange}">
        <animate attributeName="opacity" values="1;0.25;1" dur="1.6s" repeatCount="indefinite"/></rect>`);
    }
    push(`<text x="${rx + rw - 16}" y="${ry}" font-family="${MONO}" font-size="13.5" font-weight="700"
          fill="${col}" text-anchor="end" letter-spacing="0.8">${esc(v)}</text>`);
  });
  push(`<text x="${rx + 16}" y="${top + h - 26}" font-family="${MONO}" font-size="12.5" fill="#5d5775"
        letter-spacing="1.5">UPLINK STABLE ▸ 0x2F·A41·9930</text>`);
  push(`</g>`);
  endPanel(h);
}

// ─────────────────────────────── WHOAMI ───────────────────────────────
{
  header('01', 'WHOAMI', '// designer × engineer × builder', C.orange, BOOT + 1.5);
  const lines = [
    ['$', ' whoami', C.orange],
    ['', 'sara khalil — senior product designer & design engineer'],
    ['', 'dubai, uae · working where design, AI and real-world impact meet'],
    ['', ''],
    ['$', ' cat about.txt', C.orange],
    ['#', ' I design across e-commerce, fintech, and SaaS.', C.dim],
    ['#', " I don't hand off a file and walk away. I embed with the problem —", C.dim],
    ['#', ' close to people, research, product and engineering.', C.dim],
    ['#', ' I work from early discovery to the shipped experience.', C.dim],
  ];
  const h = 44 + lines.length * 33;
  const top = panel(h, { delay: BOOT + 1.6 });
  lines.forEach(([sig, text, col], i) => {
    const ly = top + 40 + i * 33;
    // Each line reveals in sequence, like output scrolling in.
    const begin = (BOOT + 2.0 + i * 0.16).toFixed(2);
    push(`<g opacity="0"><animate attributeName="opacity" from="0" to="1" dur="0.2s" begin="${begin}s" fill="freeze"/>
      <text x="${PAD + 22}" y="${ly}" font-family="${MONO}" font-size="13" fill="#4b4660">${pad2(i + 1)}</text>
      <text x="${PAD + 58}" y="${ly}" font-family="${MONO}" font-size="17.5" fill="${col || C.ink}"
            xml:space="preserve">${sig ? `<tspan font-weight="800" fill="${sig === '$' ? C.orange : C.dim}">${sig}</tspan>` : ''}${esc(text)}</text>
    </g>`);
  });
  endPanel(h);
}

// ─────────────────────── TOOLS + MORE BUILDS ───────────────────────
{
  header('02', "TOOLS I'VE BUILT", '// selected projects & experiments', C.orange, BOOT + 3.6);
  const tools = [
    ['Research Repo', 'A searchable home for studies, insights and evidence.', 'internal', 'dim'],
    ['NPS Insight Agent', 'Groups comments into themes; tracks weekly trends.', 'internal', 'dim'],
    ['Bug Testing Platform', 'Bugs, screenshots and product feedback in one place.', 'wip', 'dim'],
    ['UX Research Skills', 'Reusable Claude skills for responsible UX research.', 'repo', 'repo'],
    ['Vibe Generator', 'Experimental tool for generating and exploring ideas.', 'live', 'live'],
  ];
  const more = [
    ['Git Advisor', 'repo'], ['Mobbin MCP', 'repo'], ['Skill Atlas', 'live'],
    ['Design Skills', 'repo'], ['Build Bouncer', 'repo'],
  ];
  const h = 44 + tools.length * 56;
  const leftW = 700;
  const top = y;

  // left panel
  push(`<g opacity="0"><animate attributeName="opacity" from="0" to="1" dur="0.5s" begin="${BOOT + 3.7}s" fill="freeze"/>
    <path d="${chamfer(PAD, top, leftW, h)}" fill="${C.panel}" stroke="${C.line}" stroke-width="1"/>
    ${bracket(PAD + 5, top + 5, 'tl', C.orange)}${bracket(PAD + leftW - 5, top + h - 5, 'br', C.orange)}`);
  tools.forEach(([name, desc, tag, kind], i) => {
    const ry = top + 48 + i * 56;
    if (i) push(`<line x1="${PAD + 22}" y1="${ry - 26}" x2="${PAD + leftW - 22}" y2="${ry - 26}" stroke="${C.line}"/>`);
    push(`<text x="${PAD + 24}" y="${ry}" font-family="${MONO}" font-size="14" font-weight="800"
          fill="${C.purple}">[${pad2(i + 1)}]</text>`);
    push(`<text x="${PAD + 86}" y="${ry}" font-family="${MONO}" font-size="18" font-weight="700" fill="${C.ink}">${esc(name)}</text>`);
    push(`<text x="${PAD + 86}" y="${ry + 22}" font-family="${MONO}" font-size="15" fill="${C.dim}">${esc(desc)}</text>`);
    const col = kind === 'live' ? C.orange : kind === 'repo' ? C.purpleHi : '#6a647e';
    const bc = kind === 'live' ? C.orange : kind === 'repo' ? '#4b3a78' : '#2b2b42';
    const tw = tag.length * 10 + 20;
    push(`<rect x="${PAD + leftW - 24 - tw}" y="${ry - 15}" width="${tw}" height="26" fill="none" stroke="${bc}"/>
      <text x="${PAD + leftW - 24 - tw / 2}" y="${ry + 3}" font-family="${MONO}" font-size="13" font-weight="800"
            fill="${col}" text-anchor="middle" letter-spacing="1.6">${esc(tag.toUpperCase())}</text>`);
    if (kind === 'live') {
      push(`<rect x="${PAD + leftW - 24 - tw}" y="${ry - 15}" width="${tw}" height="26" fill="${C.orange}" opacity="0.14">
        <animate attributeName="opacity" values="0.05;0.22;0.05" dur="2.4s" repeatCount="indefinite"/></rect>`);
    }
  });
  push(`</g>`);

  // right panel
  const rx = PAD + leftW + 18, rw = W - PAD - rx;
  push(`<g opacity="0"><animate attributeName="opacity" from="0" to="1" dur="0.5s" begin="${BOOT + 4.0}s" fill="freeze"/>
    <path d="${chamfer(rx, top, rw, h)}" fill="${C.panel2}" stroke="${C.line}" stroke-width="1"/>
    ${bracket(rx + rw - 5, top + 5, 'tr', C.purple)}${bracket(rx + 5, top + h - 5, 'bl', C.purple)}
    <text x="${rx + 24}" y="${top + 40}" font-family="${MONO}" font-size="20" font-weight="800"
          fill="${C.ink}" letter-spacing="2">MORE BUILDS</text>`);
  more.forEach(([name, tag], i) => {
    const ry = top + 84 + i * 36;
    push(`<text x="${rx + 24}" y="${ry}" font-family="${MONO}" font-size="13" fill="#4b4660">${pad2(i + 6)}</text>
      <text x="${rx + 60}" y="${ry}" font-family="${MONO}" font-size="16.5" font-weight="700" fill="${C.ink}">${esc(name)}</text>
      <text x="${rx + rw - 24}" y="${ry}" font-family="${MONO}" font-size="13" font-weight="800"
            fill="${tag === 'live' ? C.orange : C.purpleHi}" text-anchor="end" letter-spacing="1.4">${tag.toUpperCase()}</text>`);
  });
  push(`<text x="${rx + 24}" y="${top + h - 28}" font-family="${MONO}" font-size="13" fill="#5d5775"
        letter-spacing="1.4">ARCHIVE ▸ 10 UNITS INDEXED</text></g>`);
  y = top + h + 18;
}

// ─────────────────────────────── STACK ───────────────────────────────
{
  header('03', 'STACK', '// my toolkit', C.orange, BOOT + 4.3);
  const groups = [
    ['DESIGN', ['Figma', 'Framer', 'Design Systems', 'CRO', 'Research', 'FigJam']],
    ['BUILD', ['React', 'Next.js', 'TypeScript', 'Expo', 'Supabase', 'Vercel', 'Tailwind']],
    ['AI', ['Claude Code', 'Codex', 'v0', 'n8n', 'Make', 'MCP']],
  ];
  const h = 36 + groups.length * 58;
  const top = panel(h, { delay: BOOT + 4.4 });
  groups.forEach(([label, items], gi) => {
    const ry = top + 56 + gi * 58;
    push(`<text x="${PAD + 24}" y="${ry}" font-family="${MONO}" font-size="14" font-weight="800"
          fill="${C.purple}" letter-spacing="2.5">${label}</text>`);
    let tx = PAD + 130;
    items.forEach((it, ii) => {
      const tw = it.length * 9.9 + 26;
      push(`<g opacity="0"><animate attributeName="opacity" from="0" to="1" dur="0.3s"
            begin="${(BOOT + 4.7 + gi * 0.18 + ii * 0.05).toFixed(2)}s" fill="freeze"/>
        <path d="M${tx + 7},${ry - 21} H${tx + tw} V${ry + 5} L${tx + tw - 7},${ry + 12} H${tx} V${ry - 14} Z"
              fill="#0e0e1b" stroke="${C.line2}"/>
        <text x="${tx + tw / 2}" y="${ry}" font-family="${MONO}" font-size="16" font-weight="600"
              fill="${C.ink}" text-anchor="middle">${esc(it)}</text></g>`);
      tx += tw + 10;
    });
  });
  endPanel(h);
}

// ─────────────────────────────── PIPELINE ───────────────────────────────
{
  header('04', 'PIPELINE', '// from idea to impact', C.orange, BOOT + 5.4);
  const steps = ['IDEA', 'DESIGN', 'BUILD', 'SHIP', 'MEASURE'];
  const h = 150;
  const top = panel(h, { delay: BOOT + 5.5 });
  const inner = W - PAD * 2 - 48;
  const bw = (inner - 4 * 40) / 5;
  steps.forEach((s, i) => {
    const bx = PAD + 24 + i * (bw + 40);
    const hot = i >= 3;
    push(`<g opacity="0"><animate attributeName="opacity" from="0" to="1" dur="0.35s"
          begin="${(BOOT + 5.8 + i * 0.18).toFixed(2)}s" fill="freeze"/>
      <path d="${chamfer(bx, top + 34, bw, 62, 10)}" fill="${hot ? 'rgba(255,122,47,.09)' : '#0d0d1a'}"
            stroke="${hot ? C.orange : C.line2}"/>
      <text x="${bx + bw / 2}" y="${top + 56}" font-family="${MONO}" font-size="12" fill="${C.dim}"
            text-anchor="middle" letter-spacing="1.5">${pad2(i + 1)}</text>
      <text x="${bx + bw / 2}" y="${top + 82}" font-family="${MONO}" font-size="19" font-weight="800"
            fill="${hot ? C.orangeHi : C.ink}" text-anchor="middle" letter-spacing="2">${s}</text></g>`);
    if (i < 4) {
      push(`<text x="${bx + bw + 20}" y="${top + 72}" font-family="${MONO}" font-size="20" fill="${C.purple}"
            text-anchor="middle" opacity="0.35">▸<animate attributeName="opacity"
            values="0.2;1;0.2" dur="1.8s" begin="${i * 0.3}s" repeatCount="indefinite"/></text>`);
    }
  });
  push(`<text x="${PAD + 24}" y="${top + 126}" font-family="${MONO}" font-size="14.5" fill="${C.purple}"
        letter-spacing="1.4">↺ FEEDBACK</text>
    <text x="${W / 2}" y="${top + 126}" font-family="${MONO}" font-size="14.5" fill="${C.dim}"
          text-anchor="middle" letter-spacing="1.4">STAKEHOLDERS + USERS + EVIDENCE + LEARNING</text>`);
  endPanel(h);
}

// ─────────────────────────────── TELEMETRY ───────────────────────────────
{
  header('05', 'TELEMETRY', '// consistency compounds', C.orange, BOOT + 6.6);
  const h = 290;
  const top = panel(h, { corners: ['tl', 'tr', 'bl', 'br'], delay: BOOT + 6.7 });
  const inner = W - PAD * 2 - 48;
  const cw = (inner - 32) / 3;

  const cards = [
    ['▲ CURRENT STREAK', pad2(stats.current), 'consecutive days', C.orange],
    ['◆ LONGEST STREAK', pad2(stats.longest), 'personal record', C.purpleHi],
  ];
  cards.forEach(([k, v, u, col], i) => {
    const cx = PAD + 24 + i * (cw + 16);
    push(`<path d="${chamfer(cx, top + 32, cw, 140, 12)}" fill="#0d0d1a" stroke="${C.line2}"/>
      <text x="${cx + cw / 2}" y="${top + 60}" font-family="${MONO}" font-size="13" fill="${C.dim}"
            text-anchor="middle" letter-spacing="2.5">${esc(k)}</text>
      <text x="${cx + cw / 2}" y="${top + 128}" font-family="${MONO}" font-size="66" font-weight="800"
            fill="${col}" text-anchor="middle" opacity="0">${v}
        <animate attributeName="opacity" from="0" to="1" dur="0.4s" begin="${BOOT + 7.1 + i * 0.2}s" fill="freeze"/>
      </text>
      <text x="${cx + cw / 2}" y="${top + 156}" font-family="${MONO}" font-size="13" fill="#5d5775"
            text-anchor="middle" letter-spacing="2">${esc(u.toUpperCase())}</text>`);
  });

  // signal column
  const sx = PAD + 24 + 2 * (cw + 16);
  push(`<path d="${chamfer(sx, top + 32, cw, 140, 12)}" fill="#0d0d1a" stroke="${C.line2}"/>
    <text x="${sx + 18}" y="${top + 58}" font-family="${MONO}" font-size="13" fill="${C.dim}"
          letter-spacing="2">◇ SIGNAL</text>`);
  [['repos', stats.repos], ['stars', stats.stars], ['followers', stats.followers]].forEach(([k, v], i) => {
    const ry = top + 88 + i * 26;
    push(`<text x="${sx + 18}" y="${ry}" font-family="${MONO}" font-size="14" fill="${C.dim}">${k.toUpperCase()}</text>
      <text x="${sx + cw - 18}" y="${ry}" font-family="${MONO}" font-size="14" font-weight="800"
            fill="${C.ink}" text-anchor="end">${v}</text>`);
  });

  // waveform
  const wx = PAD + 24, ww = inner, wh = 76, wy = top + 196;
  const n = stats.waveform.length;
  const gap = 1;
  const bw2 = (ww - (n - 1) * gap) / n;
  stats.waveform.forEach((b, i) => {
    const bh = Math.max(2, (b.height / 100) * wh);
    const bx = wx + i * (bw2 + gap);
    push(`<rect x="${bx.toFixed(2)}" y="${(wy + wh - bh).toFixed(2)}" width="${bw2.toFixed(2)}"
          height="${bh.toFixed(2)}" fill="${b.on ? C.orange : '#262640'}">
      <animate attributeName="height" from="0" to="${bh.toFixed(2)}" dur="0.5s"
               begin="${(BOOT + 7.3 + i * 0.012).toFixed(2)}s" fill="freeze"/>
      <animate attributeName="y" from="${wy + wh}" to="${(wy + wh - bh).toFixed(2)}" dur="0.5s"
               begin="${(BOOT + 7.3 + i * 0.012).toFixed(2)}s" fill="freeze"/>
    </rect>`);
  });
  push(`<text x="${wx}" y="${wy + wh + 22}" font-family="${MONO}" font-size="13" fill="${C.dim}"
        letter-spacing="1.3">◂ ${stats.waveformDays} DAYS AGO</text>
    <text x="${W / 2}" y="${wy + wh + 22}" font-family="${MONO}" font-size="13" fill="${C.orange}"
          text-anchor="middle" letter-spacing="1.3">ACTIVE STREAK ▸ ${pad2(stats.current)} DAYS</text>
    <text x="${W - PAD - 24}" y="${wy + wh + 22}" font-family="${MONO}" font-size="13" fill="${C.dim}"
          text-anchor="end" letter-spacing="1.3">TODAY ▸</text>`);
  endPanel(h);
}

// ─────────────────────────────── SIGNAL FEED ───────────────────────────────
{
  header('06', 'SIGNAL FEED', '// live from github', C.orange, BOOT + 7.6);
  const h = 212;
  const top = panel(h, { delay: BOOT + 7.7 });
  const inner = W - PAD * 2 - 48;
  const cw = (inner - 18) / 2;

  // counters
  push(`<path d="${chamfer(PAD + 24, top + 26, cw, h - 52, 12)}" fill="#0d0d1a" stroke="${C.line2}"/>
    <text x="${PAD + 44}" y="${top + 56}" font-family="${MONO}" font-size="15" font-weight="800"
          fill="${C.orange}" letter-spacing="2.5">GITHUB STATS</text>`);
  [
    ['stars earned', stats.stars],
    ['commits (1y)', stats.commitsYear],
    ['pull requests', stats.prs],
    ['issues', stats.issues],
  ].forEach(([k, v], i) => {
    const ry = top + 88 + i * 26;
    push(`<text x="${PAD + 44}" y="${ry}" font-family="${MONO}" font-size="15" fill="${C.dim}">${esc(k.toUpperCase())}</text>
      <text x="${PAD + 24 + cw - 20}" y="${ry}" font-family="${MONO}" font-size="15" font-weight="800"
            fill="${C.ink}" text-anchor="end">${v}</text>`);
  });

  // languages
  const lx = PAD + 24 + cw + 18;
  push(`<path d="${chamfer(lx, top + 26, cw, h - 52, 12)}" fill="#0d0d1a" stroke="${C.line2}"/>
    <text x="${lx + 20}" y="${top + 56}" font-family="${MONO}" font-size="15" font-weight="800"
          fill="${C.purpleHi}" letter-spacing="2.5">MOST USED LANGUAGES</text>`);
  let bx = lx + 20;
  const barW = cw - 40;
  stats.languages.forEach((l) => {
    const seg = (l.pct / 100) * barW;
    push(`<rect x="${bx.toFixed(2)}" y="${top + 72}" width="${Math.max(1, seg - 2).toFixed(2)}" height="11"
          fill="${l.color}"/>`);
    bx += seg;
  });
  stats.languages.slice(0, 6).forEach((l, i) => {
    const col = i % 2, row = (i / 2) | 0;
    const ex = lx + 20 + col * (barW / 2);
    const ey = top + 112 + row * 26;
    push(`<rect x="${ex}" y="${ey - 9}" width="9" height="9" fill="${l.color}"/>
      <text x="${ex + 17}" y="${ey}" font-family="${MONO}" font-size="14" fill="${C.ink}">${esc(l.name)}</text>
      <text x="${ex + barW / 2 - 24}" y="${ey}" font-family="${MONO}" font-size="13.5" fill="${C.dim}"
            text-anchor="end">${l.pct}%</text>`);
  });
  endPanel(h);
}

// ─────────────────────────────── AGENTS ───────────────────────────────
{
  header('07', 'AGENT ROSTER', '// a little chaotic, mostly helpful', C.purple, BOOT + 8.4);
  const agents = [
    ['RATCHET', 'I built the whole thing.', 'execution'],
    ['GUSTAVE', 'The direction was mine.', 'direction'],
    ['SIX', "I told her it wasn't good enough.", 'judgment'],
    ['ALOY', 'I mapped every pattern first.', 'intel'],
    ['HAZEL', 'Every word, in her voice.', 'voice'],
  ];
  const h = 40 + agents.length * 40;
  const top = panel(h, { corners: ['tl', 'br'], accent: C.purple, delay: BOOT + 8.5 });
  agents.forEach(([name, quote, role], i) => {
    const ry = top + 48 + i * 40;
    push(`<g opacity="0"><animate attributeName="opacity" from="0" to="1" dur="0.3s"
          begin="${(BOOT + 8.8 + i * 0.12).toFixed(2)}s" fill="freeze"/>
      <text x="${PAD + 24}" y="${ry}" font-family="${MONO}" font-size="13" fill="#4b4660">${pad2(i + 1)}</text>
      <text x="${PAD + 62}" y="${ry}" font-family="${MONO}" font-size="17.5" font-weight="800"
            fill="${C.purpleHi}" letter-spacing="1.6">${esc(name)}</text>
      <text x="${PAD + 210}" y="${ry}" font-family="${MONO}" font-size="16.5" fill="${C.dim}"
            font-style="italic">"${esc(quote)}"</text>
      <text x="${W - PAD - 24}" y="${ry}" font-family="${MONO}" font-size="12.5" fill="#5d5775"
            text-anchor="end" letter-spacing="1.6">${esc(role.toUpperCase())}</text></g>`);
  });
  endPanel(h);
}

y += 4;
const marqueeY = y;
push(marquee(
  '  BUILD   ◆   MEASURE   ◆   LEARN   ◆   SHIP AGAIN   ◆',
  C.purple, '#0a0612', marqueeY
));
y += 38;

const H = y;

// ── Boot overlay: drawn last so it sits on top, fades out to reveal page ──
const boot = `<g>
  <rect x="0" y="0" width="${W}" height="${H}" fill="${C.void}">
    <animate attributeName="opacity" from="1" to="0" dur="0.6s" begin="${BOOT}s" fill="freeze"/>
  </rect>
  <g opacity="1">
    <animate attributeName="opacity" from="1" to="0" dur="0.5s" begin="${BOOT}s" fill="freeze"/>
    <text x="${W / 2}" y="${H / 2 - 54}" font-family="${MONO}" font-size="15" fill="${C.purple}"
          text-anchor="middle" letter-spacing="5">INITIALISING PROFILE</text>
    <rect x="${W / 2 - 220}" y="${H / 2 - 28}" width="440" height="12" fill="none" stroke="${C.line2}"/>
    <rect x="${W / 2 - 218}" y="${H / 2 - 26}" width="0" height="8" fill="${C.orange}">
      <animate attributeName="width" values="0;92;180;300;436" keyTimes="0;0.25;0.5;0.78;1"
               dur="${BOOT - 0.3}s" fill="freeze"/>
    </rect>
    <text x="${W / 2}" y="${H / 2 + 16}" font-family="${MONO}" font-size="13" fill="${C.dim}"
          text-anchor="middle" letter-spacing="3">
      <tspan opacity="0">LOADING MODULES<animate attributeName="opacity" values="0;1;0" dur="0.8s" begin="0s" fill="remove"/></tspan>
    </text>
    <text x="${W / 2}" y="${H / 2 + 16}" font-family="${MONO}" font-size="13" fill="${C.dim}"
          text-anchor="middle" letter-spacing="3">
      <tspan opacity="0">MOUNTING TELEMETRY<animate attributeName="opacity" values="0;1;0" dur="0.8s" begin="0.8s" fill="remove"/></tspan>
    </text>
    <text x="${W / 2}" y="${H / 2 + 16}" font-family="${MONO}" font-size="13" fill="${C.orange}"
          text-anchor="middle" letter-spacing="3">
      <tspan opacity="0">READY<animate attributeName="opacity" values="0;1;1" dur="0.9s" begin="1.6s" fill="freeze"/></tspan>
    </text>
  </g>
</g>`;

// Scanline texture + a slow sweep, both non-interactive overlays.
const overlay = `
<rect x="0" y="0" width="${W}" height="${H}" fill="url(#scan)" opacity="0.5"/>
<rect x="0" y="0" width="${W}" height="70" fill="url(#sweep)" opacity="0.5">
  <animate attributeName="y" from="${-70}" to="${H}" dur="7s" begin="${BOOT + 0.6}s" repeatCount="indefinite"/>
</rect>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${MONO}">
<defs>
  <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse">
    <rect width="4" height="3" fill="none"/>
    <rect y="3" width="4" height="1" fill="#ffffff" opacity="0.028"/>
  </pattern>
  <linearGradient id="sweep" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${C.orange}" stop-opacity="0"/>
    <stop offset="50%" stop-color="${C.orange}" stop-opacity="0.05"/>
    <stop offset="100%" stop-color="${C.orange}" stop-opacity="0"/>
  </linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="${C.void}"/>
${out.join('\n')}
${overlay}
${boot}
</svg>`;

await writeFile(here('../../assets/profile.svg'), svg);
console.log(`profile.svg — ${W}×${H}, streak ${stats.current}, record ${stats.longest}, ${stats.waveform.length} bars`);
