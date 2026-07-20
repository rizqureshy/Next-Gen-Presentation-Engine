/* ============================================================
   github.js — one-click GitHub Pages deploy (browser-side).

   Uses the GitHub REST API directly from the browser with a
   user-supplied fine-grained personal access token (repo scope:
   administration + contents + pages). The token is used for the
   API calls only — never stored, never sent anywhere else.

   Flow: resolve user → create repo (or reuse) → upload the
   bundle files via the contents API → enable Pages → return
   the https://<user>.github.io/<repo>/ URL.
   ============================================================ */

import { composeDeck } from "../compose/composer.js";
import { bundleFileList } from "./bundle.js";

function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

/**
 * @param {object} p { token, repo, deck, readFile, onProgress(msg) }
 * @returns {Promise<string>} the published site URL
 */
export async function deployToGitHubPages({ token, repo, deck, readFile, onProgress = () => {} }) {
  const api = async (path, opts = {}, okExtra = []) => {
    const res = await fetch(`https://api.github.com${path}`, {
      ...opts,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!res.ok && !okExtra.includes(res.status)) {
      let msg = `${res.status}`;
      try { msg += ` — ${(await res.json()).message}`; } catch { /* no body */ }
      throw new Error(`GitHub ${path}: ${msg}`);
    }
    try { return await res.json(); } catch { return null; }
  };

  onProgress("Checking token…");
  const me = await api("/user");
  const owner = me.login;

  onProgress(`Creating repo ${owner}/${repo}…`);
  await api("/user/repos", {
    method: "POST",
    body: JSON.stringify({
      name: repo,
      description: `${deck.meta.title || "Deck"} — built with the Effects Platform`,
      homepage: `https://${owner}.github.io/${repo}/`,
      has_wiki: false, has_projects: false,
    }),
  }, [422]);                                  // 422 = already exists → reuse

  const theme = deck.meta.theme || "cosmos";
  const files = [
    { path: "index.html", text: composeDeck(deck, { base: "." }) },
    { path: "deck.json", text: JSON.stringify(deck, null, 2) },
    { path: ".nojekyll", text: "" },          // serve folders starting with _ as-is
  ];
  for (const p of bundleFileList(theme)) files.push({ path: p, text: await readFile(p) });

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    onProgress(`Uploading ${i + 1}/${files.length}: ${f.path}`);
    const url = `/repos/${owner}/${repo}/contents/${f.path}`;
    const body = { message: `deck: add ${f.path}`, content: toBase64(f.text) };
    // if the file exists (redeploy), the API demands its current sha
    const existing = await api(`${url}?ref=main`, {}, [404]);
    if (existing?.sha) body.sha = existing.sha;
    await api(url, { method: "PUT", body: JSON.stringify(body) });
  }

  onProgress("Enabling GitHub Pages…");
  await api(`/repos/${owner}/${repo}/pages`, {
    method: "POST",
    body: JSON.stringify({ source: { branch: "main", path: "/" } }),
  }, [409]);                                  // 409 = already enabled

  const url = `https://${owner}.github.io/${repo}/`;
  onProgress(`Deployed — ${url} (Pages can take a minute to go live)`);
  return url;
}
