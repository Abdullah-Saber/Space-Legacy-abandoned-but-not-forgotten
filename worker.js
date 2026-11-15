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
      const upstream = new Request(target, request);
      return fetch(upstream);
    }

    return env.ASSETS.fetch(request);
  },
};
