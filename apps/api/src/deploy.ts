import { ASSETS, type EmbeddedAsset } from "./assets.generated.ts";
import api from "./index.ts";

/**
 * Single Worker used when the static-assets upload is unavailable.
 * `/api/*` stays on the game handler. Everything else is the built web app,
 * with index.html as the SPA fallback.
 */
export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      return api.fetch(request, env, ctx);
    }
    return serveAsset(url.pathname);
  },

  async scheduled(controller, env, ctx) {
    if (api.scheduled) await api.scheduled(controller, env, ctx);
  },
} satisfies ExportedHandler<Env>;

function serveAsset(pathname: string): Response {
  const path = pathname === "/" ? "/index.html" : pathname;
  const asset = ASSETS[path];
  if (!asset) {
    if (path.includes(".")) return new Response("Not found", { status: 404 });
    return html(ASSETS["/index.html"]);
  }
  return html(asset, path !== "/index.html");
}

function html(asset: EmbeddedAsset | undefined, immutable = false): Response {
  if (!asset) return new Response("Missing index.html. Run npm run build:deploy.", { status: 500 });
  const body = asset.base64 ? Uint8Array.from(atob(asset.body), (char) => char.charCodeAt(0)) : asset.body;
  return new Response(body, {
    headers: {
      "content-type": asset.contentType,
      "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
    },
  });
}
