export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      const origin = env.BACKEND_ORIGIN?.replace(/\/+$/, '');
      if (!origin) {
        return Response.json(
          { error: 'Backend is not configured yet.' },
          { status: 503, headers: { 'Cache-Control': 'no-store' } },
        );
      }

      const target = new URL(`${url.pathname}${url.search}`, `${origin}/`);
      const headers = new Headers(request.headers);
      headers.delete('host');
      headers.delete('content-length');
      headers.delete('content-encoding');
      headers.delete('transfer-encoding');

      const init = {
        method: request.method,
        headers,
        redirect: request.redirect,
      };

      if (request.method !== 'GET' && request.method !== 'HEAD') {
        init.body = await request.text();
        if (url.pathname === '/api/ai/ask/') {
          headers.set('content-type', 'application/json');
        }
      }

      const upstream = new Request(target, init);
      return fetch(upstream);
    }

    return env.ASSETS.fetch(request);
  },
};
