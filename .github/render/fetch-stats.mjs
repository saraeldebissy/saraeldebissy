// Fetches real contribution data from the GitHub GraphQL API and derives
// the numbers shown in the TELEMETRY panel: current streak, longest streak,
// and the 21-day waveform. Writes stats.json for render.mjs to consume.

const USER = process.env.GH_USER || 'saraeldebissy';
const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN) {
  console.error('GITHUB_TOKEN is not set.');
  process.exit(1);
}

async function gql(query, variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'profile-telemetry',
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

// Account metadata plus the counters shown in the SIGNAL FEED panel.
// Languages come back per-repo and get aggregated by byte count below.
const meta = await gql(
  `query($login:String!){
     user(login:$login){
       createdAt
       followers{ totalCount }
       pullRequests{ totalCount }
       issues{ totalCount }
       allRepos: repositories(ownerAffiliations:OWNER, privacy:PUBLIC){ totalCount }
       repositories(ownerAffiliations:OWNER, privacy:PUBLIC, first:100, isFork:false){
         totalCount
         nodes{
           stargazerCount
           languages(first:10, orderBy:{field:SIZE, direction:DESC}){
             edges{ size node{ name color } }
           }
         }
       }
     }
   }`,
  { login: USER }
);

// Stars earned across owned repos, not stars given.
const starsEarned = meta.user.repositories.nodes.reduce((n, r) => n + r.stargazerCount, 0);

// Aggregate language bytes across every owned repo, then take the top slice.
const langBytes = new Map();
const langColor = new Map();
for (const repo of meta.user.repositories.nodes) {
  for (const e of repo.languages.edges) {
    langBytes.set(e.node.name, (langBytes.get(e.node.name) || 0) + e.size);
    langColor.set(e.node.name, e.node.color || '#8b8398');
  }
}
const totalBytes = [...langBytes.values()].reduce((a, b) => a + b, 0) || 1;
const languages = [...langBytes.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 6)
  .map(([name, size]) => ({
    name,
    color: langColor.get(name),
    pct: +((size / totalBytes) * 100).toFixed(1),
  }));

const createdAt = new Date(meta.user.createdAt);
const today = new Date();

// contributionsCollection caps at one year per query, so walk year windows.
const days = [];
let cursor = new Date(createdAt);
while (cursor < today) {
  const from = new Date(cursor);
  const to = new Date(Math.min(+new Date(cursor).setFullYear(cursor.getFullYear() + 1), +today));
  const data = await gql(
    `query($login:String!,$from:DateTime!,$to:DateTime!){
       user(login:$login){
         contributionsCollection(from:$from,to:$to){
           contributionCalendar{
             weeks{ contributionDays{ date contributionCount } }
           }
         }
       }
     }`,
    { login: USER, from: from.toISOString(), to: to.toISOString() }
  );
  for (const w of data.user.contributionsCollection.contributionCalendar.weeks) {
    for (const d of w.contributionDays) days.push(d);
  }
  cursor = to;
}

// Deduplicate (year windows overlap at the seam) and sort chronologically.
const byDate = new Map();
for (const d of days) byDate.set(d.date, d.contributionCount);
const series = [...byDate.entries()]
  .map(([date, count]) => ({ date, count }))
  .sort((a, b) => a.date.localeCompare(b.date))
  .filter((d) => d.date <= today.toISOString().slice(0, 10));

// Longest run of consecutive days with at least one contribution.
let longest = 0;
let run = 0;
for (const d of series) {
  run = d.count > 0 ? run + 1 : 0;
  if (run > longest) longest = run;
}

// Current streak counts backwards from the most recent day. Today is skipped
// when it is still empty, since the day is not over yet.
let current = 0;
for (let i = series.length - 1; i >= 0; i--) {
  const isToday = i === series.length - 1;
  if (series[i].count > 0) current++;
  else if (!isToday) break;
}

const WINDOW_DAYS = 90;
const window = series.slice(-WINDOW_DAYS);
const peak = Math.max(1, ...window.map((d) => d.count));

// Commits in the trailing year, for the SIGNAL FEED panel.
const yearAgo = new Date(today);
yearAgo.setFullYear(yearAgo.getFullYear() - 1);
const commitsYear = series
  .filter((d) => d.date >= yearAgo.toISOString().slice(0, 10))
  .reduce((n, d) => n + d.count, 0);

const stats = {
  current,
  longest,
  repos: meta.user.allRepos.totalCount,
  stars: starsEarned,
  followers: meta.user.followers.totalCount,
  prs: meta.user.pullRequests.totalCount,
  issues: meta.user.issues.totalCount,
  commitsYear,
  languages,
  // Each bar: height relative to the busiest day, lit if it is part of the
  // active streak tail. Square-rooted because raw counts are long-tailed —
  // one heavy day would otherwise flatten every other bar to a stub. Empty
  // days stay at a visible floor so the baseline reads as a track.
  waveformDays: WINDOW_DAYS,
  waveform: window.map((d, i) => ({
    height: d.count === 0 ? 5 : Math.max(16, Math.round(Math.sqrt(d.count / peak) * 100)),
    on: i >= window.length - current,
  })),
  generated: today.toISOString().slice(0, 10),
};

console.log(JSON.stringify(stats, null, 2));
await (await import('node:fs/promises')).writeFile(
  new URL('./stats.json', import.meta.url),
  JSON.stringify(stats, null, 2)
);
