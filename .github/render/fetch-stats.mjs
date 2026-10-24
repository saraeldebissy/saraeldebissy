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

// When did the account start? Bounds how far back we look for the record streak.
const meta = await gql(
  `query($login:String!){
     user(login:$login){
       createdAt
       repositories(ownerAffiliations:OWNER, privacy:PUBLIC){ totalCount }
       starredRepositories{ totalCount }
     }
   }`,
  { login: USER }
);

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

const window = series.slice(-21);
const peak = Math.max(1, ...window.map((d) => d.count));

const stats = {
  current,
  longest,
  repos: meta.user.repositories.totalCount,
  stars: meta.user.starredRepositories.totalCount,
  // Each bar: height relative to the busiest day, lit if it is part of the
  // active streak tail. Square-rooted because raw counts are long-tailed —
  // one heavy day would otherwise flatten every other bar to a stub. Empty
  // days stay at a visible floor so the baseline reads as a track.
  waveform: window.map((d, i) => ({
    height: d.count === 0 ? 6 : Math.max(22, Math.round(Math.sqrt(d.count / peak) * 100)),
    on: i >= window.length - current,
  })),
  generated: today.toISOString().slice(0, 10),
};

console.log(JSON.stringify(stats, null, 2));
await (await import('node:fs/promises')).writeFile(
  new URL('./stats.json', import.meta.url),
  JSON.stringify(stats, null, 2)
);
