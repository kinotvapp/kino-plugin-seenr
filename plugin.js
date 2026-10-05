// Seenr (https://seenr.app) for Kino: tells the person's Seenr account what they start and finish watching.
//
// Seenr has no public scrobble API; its auto-tracking takes webhooks, one personal link per media server
// (Ajustes ▸ Auto-tracking: https://seenr.app/api/v1/scrobble/plex/<token>). This plugin speaks the Plex one, the only
// payload shape a third-party client is known to send it successfully (github.com/isntw/seenr-bridge): a form field
// `payload` holding Plex's webhook JSON. `media.play` when playback starts, `media.scrobble` when it is watched.
//
// The trap Seenr's Plex route has: for an episode, `Metadata.Guid[]` must be the EPISODE's own ids. The show's ids there
// check in on the wrong show, so an episode without ids of its own is sent with no Guid at all, by title and numbers.

const SCROBBLE_PATH = /^\/api\/v1\/scrobble\/plex\/([A-Za-z0-9._~-]{8,200})\/?$/;
const TOKEN_ONLY = /^[A-Za-z0-9._~-]{8,200}$/;

// The webhook URL from what the person pasted: the whole link, or only its token. Anything else is a typo, said plainly.
function webhook() {
  const raw = String(kino.config.get("link") || "").trim();
  if (!raw) throw kino.error("auth_required", "falta tu enlace de Seenr", { userMessage: "Pega tu enlace personal de Seenr en la configuración del plugin." });
  if (TOKEN_ONLY.test(raw)) return "https://seenr.app/api/v1/scrobble/plex/" + raw;
  let u;
  try { u = new URL(raw); } catch (e) { u = null; }
  const m = u && u.protocol === "https:" && u.hostname === "seenr.app" && SCROBBLE_PATH.exec(u.pathname);
  if (!m) throw kino.error("invalid_request", "el enlace no es de Seenr", { userMessage: "Ese enlace no es el de Plex de Seenr: cópialo de Ajustes ▸ Auto-tracking ▸ Plex." });
  return "https://seenr.app/api/v1/scrobble/plex/" + m[1];
}

function guids(ids) {
  const out = [];
  if (ids && typeof ids.imdb === "string" && /^tt\d+$/.test(ids.imdb)) out.push({ id: "imdb://" + ids.imdb });
  if (ids && Number.isInteger(ids.tmdb) && ids.tmdb > 0) out.push({ id: "tmdb://" + ids.tmdb });
  if (ids && Number.isInteger(ids.tvdb) && ids.tvdb > 0) out.push({ id: "tvdb://" + ids.tvdb });
  return out;
}

// Plex's webhook JSON for one of Kino's events, or null when Seenr has nothing to learn from it.
export function payloadFor(event) {
  const e = event || {};
  const name = e.type === "start" ? "media.play" : e.type === "watched" ? "media.scrobble" : null;
  if (!name) return null; // progress and stop: Seenr's Plex route keeps nothing of them
  const meta = {};
  if (e.kind === "episode") {
    const show = e.show || {};
    if (!show.title || !(e.season > 0) || !(e.episode > 0)) return null;
    meta.type = "episode";
    meta.grandparentTitle = String(show.title);
    meta.parentIndex = String(e.season);
    meta.index = String(e.episode);
    if (e.title) meta.title = String(e.title);
    if (show.year) meta.year = String(show.year);
  } else {
    if (!e.title) return null;
    meta.type = "movie";
    meta.title = String(e.title);
    if (e.year) meta.year = String(e.year);
  }
  const g = guids(e.ids);
  if (g.length) meta.Guid = g;
  if (e.durationMs > 0) meta.duration = String(Math.round(e.durationMs));
  return { event: name, user: true, owner: true, Account: { title: "Kino" }, Metadata: meta };
}

export async function track(event) {
  const payload = payloadFor(event);
  // Nothing Seenr keeps (progress, stop): "skipped", so Kino doesn't take it as proof the link works.
  if (!payload) return { skipped: true };
  const url = webhook();
  let r;
  try {
    r = await kino.fetch(url, { method: "POST", body: { form: { payload: JSON.stringify(payload) } }, timeoutMs: 8000, cookies: false });
  } catch (e) {
    throw kino.error(e && e.code === "timeout" ? "timeout" : "network", "Seenr no respondió");
  }
  if (r.ok) return { ok: true };
  if (r.status === 401 || r.status === 403 || r.status === 404) {
    throw kino.error("auth_required", "Seenr no reconoce el enlace (" + r.status + ")", { userMessage: "Seenr no reconoce tu enlace: vuelve a copiarlo de Ajustes ▸ Auto-tracking ▸ Plex." });
  }
  if (r.status === 429) throw kino.error("rate_limited", "Seenr pidió esperar");
  if (r.status === 400 || r.status === 422) throw kino.error("invalid_request", "Seenr rechazó el aviso (" + r.status + ")");
  throw kino.error("unavailable", "Seenr respondió " + r.status);
}
