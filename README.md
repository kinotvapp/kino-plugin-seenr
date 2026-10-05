# Seenr -- a Kino tracking plugin

Tells the person's [Seenr](https://seenr.app) account what they start and finish watching in
[Kino](https://github.com/kinotvapp/kino-plugins): the `tracking` capability (Kino 0.9.51, apiVersion 7).
Seenr is a free TV-Time-style tracker (series, movies, "up next", calendar). This plugin plays nothing.

## Set it up (en español, lo que ve la persona)

1. En Seenr (la app o seenr.app, con tu cuenta): **Ajustes ▸ Seguimiento automático ▸ Plex** y copia tu enlace
   personal (`https://seenr.app/api/v1/scrobble/plex/…`). No necesitas tener Plex: Kino usa ese enlace en su lugar.
   Es secreto: quien lo tenga puede marcar cosas en tu cuenta.
2. En Kino: **Plugins ▸ +** y pega `kinotvapp/kino-plugin-seenr`. La hoja de instalación dice, en rojo,
   "Le contará a seenr.app qué ves y cuándo lo terminas".
3. En **Configurar** verás los mismos pasos bajo "Cómo conseguir tu enlace": pega el enlace (o solo el código del
   final) en "Tu enlace de Seenr". Se guarda sellado y viaja así a tus otros aparatos.

Para tener las filas de Seenr en Inicio (Siguiente, Watchlist, Para ti…), agrega además su addon de Stremio
personal (Seenr ▸ Ajustes ▸ Stremio) en **Plugins ▸ + ▸ Stremio**: ese es el catálogo, este plugin es el aviso.

## How it talks to Seenr

Seenr has no public scrobble API. Its auto-tracking takes a webhook per media server, and this plugin speaks the
Plex one -- the only payload shape a third-party client is known to send it successfully
([seenr-bridge](https://github.com/isntw/seenr-bridge)): `POST` the person's link with a form field `payload` holding
Plex's webhook JSON.

| Kino event | Sent to Seenr |
| --- | --- |
| `start` | `media.play` |
| `watched` (3 min or less left and at least 90% played) | `media.scrobble` |
| `progress`, `stop` | nothing (answered `{ skipped: true }`, so a wrong link's red line stays visible) |

A movie goes with its title, year and `imdb://` / `tmdb://` guids. An **episode** goes with the show's title, season
and episode numbers, and **its own** ids only: Seenr reads `Guid[]` on an episode as the episode's ids, so the show's
ids there would check in on the wrong show. An episode Kino has no ids for is sent by title and numbers alone.

Errors: 401/403/404 mean the link is wrong (`auth_required`: the event is dropped and Kino shows the sentence in the
plugin's Ajustes); 429 and 5xx are retried by Kino later (`rate_limited`, `unavailable`), as are network failures.

## Develop and test

```
node sdk/validate.mjs .
node --test test/plugin.test.mjs
node sdk/run.mjs . --config link=<your link> track start '{"kind":"movie","title":"Inception","year":2010,"ids":{"imdb":"tt1375666"}}'
```
