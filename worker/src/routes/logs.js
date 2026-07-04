import { HttpError, jsonResponse, readJson } from '../util.js';
import { requireSession } from '../auth.js';

const GITHUB_OWNER = 'wow-nostalgia';
const GITHUB_REPO = 'wow-nostalgia.github.io';
const RAID_LOGS_PATH = 'data/raid-logs.json';
const RAID_LOG_MERGES_PATH = 'data/raid-log-merges.json';
const GITHUB_API = 'https://api.github.com';

function isValidUwuUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname === 'uwu-logs.xyz' && u.pathname.startsWith('/reports/');
  } catch {
    return false;
  }
}

function normalizeUrl(url) {
  return url.endsWith('/') ? url : `${url}/`;
}

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
    'User-Agent': 'wow-nostalgia-worker'
  };
}

async function githubFetch(path, options, token) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: githubHeaders(token)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub API ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function readGithubJson(filePath, token) {
  const data = await githubFetch(
    `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
    {},
    token
  );
  const content = JSON.parse(atob(data.content.replace(/\n/g, '')));
  return { content, sha: data.sha };
}

async function commitFiles(files, message, token) {
  const repoBase = `/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;

  const refData = await githubFetch(`${repoBase}/git/ref/heads/main`, {}, token);
  const latestCommitSha = refData.object.sha;

  const commitData = await githubFetch(`${repoBase}/git/commits/${latestCommitSha}`, {}, token);
  const baseTreeSha = commitData.tree.sha;

  const treeItems = await Promise.all(
    files.map(async ({ path, content }) => {
      const blobData = await githubFetch(`${repoBase}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({ content: JSON.stringify(content, null, 2), encoding: 'utf-8' })
      }, token);
      return { path, mode: '100644', type: 'blob', sha: blobData.sha };
    })
  );

  const treeData = await githubFetch(`${repoBase}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems })
  }, token);

  const newCommitData = await githubFetch(`${repoBase}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, tree: treeData.sha, parents: [latestCommitSha] })
  }, token);

  await githubFetch(`${repoBase}/git/refs/heads/main`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: newCommitData.sha })
  }, token);
}

export async function handleAddLogs(request, env) {
  const session = await requireSession(env.DB, request);
  if (session.discordId !== env.ADMIN_DISCORD_ID) throw new HttpError(403, 'Лише адміністратор сайту');

  const body = await readJson(request);
  const url1 = String(body.url1 || '').trim();
  const url2 = String(body.url2 || '').trim();

  if (!url1) throw new HttpError(400, "url1 є обов'язковим");
  if (!isValidUwuUrl(url1)) throw new HttpError(400, 'url1 — не валідне посилання uwu-logs.xyz');
  if (url2 && !isValidUwuUrl(url2)) throw new HttpError(400, 'url2 — не валідне посилання uwu-logs.xyz');
  if (url2 && normalizeUrl(url1) === normalizeUrl(url2)) throw new HttpError(400, 'url1 і url2 збігаються');

  const token = env.GITHUB_TOKEN;
  if (!token) throw new HttpError(500, 'GITHUB_TOKEN не налаштований');

  const { content: raidLogs } = await readGithubJson(RAID_LOGS_PATH, token);
  const existingNormalized = new Set(raidLogs.map(normalizeUrl));

  if (existingNormalized.has(normalizeUrl(url1))) {
    throw new HttpError(409, `Лог вже є в списку: ${url1}`);
  }
  if (url2 && existingNormalized.has(normalizeUrl(url2))) {
    throw new HttpError(409, `Лог вже є в списку: ${url2}`);
  }

  const newLogs = [url1, ...(url2 ? [url2] : []), ...raidLogs];
  const filesToCommit = [{ path: RAID_LOGS_PATH, content: newLogs }];

  if (url2) {
    const { content: existingMerges } = await readGithubJson(RAID_LOG_MERGES_PATH, token);
    const newMerges = {
      ...existingMerges,
      [normalizeUrl(url2)]: { primary: normalizeUrl(url1), type: 'split' }
    };
    filesToCommit.push({ path: RAID_LOG_MERGES_PATH, content: newMerges });
  }

  const raidId = url1.match(/reports\/([^/]+)/)?.[1] ?? 'unknown';
  const commitMessage = url2
    ? `chore: add split raid logs (${raidId})`
    : `chore: add raid log (${raidId})`;

  await commitFiles(filesToCommit, commitMessage, token);

  return jsonResponse({ added: [url1, ...(url2 ? [url2] : [])], split: !!url2 });
}
