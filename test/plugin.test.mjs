// node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { payloadFor, tokenFrom } from "../plugin.js";

test("a movie start is media.play with its imdb and tmdb guids", () => {
  const p = payloadFor({ type: "start", kind: "movie", title: "Inception", year: 2010, ids: { imdb: "tt1375666", tmdb: 27205 }, durationMs: 8880000 });
  assert.equal(p.event, "media.play");
  assert.deepEqual(p.Metadata, { type: "movie", title: "Inception", year: "2010", Guid: [{ id: "imdb://tt1375666" }, { id: "tmdb://27205" }], duration: "8880000" });
  assert.equal(p.user, true);
  assert.equal(p.owner, true);
});

test("watched is media.scrobble; progress and stop send nothing", () => {
  assert.equal(payloadFor({ type: "watched", kind: "movie", title: "Inception", ids: {} }).event, "media.scrobble");
  assert.equal(payloadFor({ type: "progress", kind: "movie", title: "Inception" }), null);
  assert.equal(payloadFor({ type: "stop", kind: "movie", title: "Inception" }), null);
});

test("an episode carries the EPISODE's ids in Guid, never the show's", () => {
  const p = payloadFor({
    type: "watched", kind: "episode", title: "Gray Matter", season: 1, episode: 5,
    ids: { tmdb: 62089, imdb: "tt1054724", tvdb: 349236 },
    show: { title: "Breaking Bad", year: 2008, ids: { tmdb: 1396, imdb: "tt0903747" } },
  });
  assert.deepEqual(p.Metadata, {
    type: "episode", grandparentTitle: "Breaking Bad", parentIndex: "1", index: "5", title: "Gray Matter", year: "2008",
    Guid: [{ id: "imdb://tt1054724" }, { id: "tmdb://62089" }, { id: "tvdb://349236" }],
  });
});

test("an episode with no ids of its own goes by title and numbers, with no Guid at all", () => {
  const p = payloadFor({ type: "start", kind: "episode", season: 2, episode: 3, ids: {}, show: { title: "Breaking Bad", ids: { tmdb: 1396 } } });
  assert.equal(p.Metadata.Guid, undefined);
  assert.equal(p.Metadata.grandparentTitle, "Breaking Bad");
});

test("nothing to name it by sends nothing", () => {
  assert.equal(payloadFor({ type: "start", kind: "movie", ids: { imdb: "tt1" } }), null);
  assert.equal(payloadFor({ type: "start", kind: "episode", season: 1, episode: 1, show: {} }), null);
  assert.equal(payloadFor({ type: "start", kind: "episode", show: { title: "X" } }), null);
});

test("a real Seenr link (an id, a bar shown as %7C, the secret) is read; so is the token alone or with a bare bar", () => {
  const secret = "eCdlgv9puoef3l4n9Z7C7UHOswnlWrmmYbZwSchNde5b5cb9";
  assert.equal(tokenFrom("https://seenr.app/api/v1/scrobble/plex/162119%7C" + secret), "162119|" + secret);
  assert.equal(tokenFrom(" https://seenr.app/api/v1/scrobble/plex/162119|" + secret + "/ "), "162119|" + secret);
  assert.equal(tokenFrom("162119|" + secret), "162119|" + secret);
  assert.equal(tokenFrom("162119%7C" + secret), "162119|" + secret);
  assert.equal(tokenFrom("abcdefgh12345678"), "abcdefgh12345678");
});

test("anything else is not a Seenr link", () => {
  for (const bad of ["", "https://evil.example/api/v1/scrobble/plex/162119%7Cabcdefgh", "http://seenr.app/api/v1/scrobble/plex/162119%7Cabcdefgh",
    "https://seenr.app/api/v1/scrobble/jellyfin/162119%7Cabcdefgh", "162119|short", "a b c d e f g h i", "%E0%A4%A"]) {
    assert.equal(tokenFrom(bad), null, bad);
  }
});
