import type { Env } from './_lib/types/env'

// GET /health — Pages Function liveness check. Distinct from the FE's SPA
// fallback because Pages matches functions before the static 200.html.
// Returns the deployed APP_VERSION (sourced from disc-app/VERSION at deploy
// time by deploy.sh) so an external monitor can detect drift between the
// expected and actually-serving version.
export const onRequestGet: PagesFunction<Env> = ({ env }) =>
  new Response(
    JSON.stringify({ ok: true, version: env.APP_VERSION ?? 'unknown' }),
    { headers: { 'content-type': 'application/json' } },
  )
