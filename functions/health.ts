// GET /health — Pages Function liveness check. Distinct from the FE's SPA
// fallback because Pages matches functions before the static 200.html.
export const onRequestGet = () =>
  new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' },
  })
