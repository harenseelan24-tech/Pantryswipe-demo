import { ReplitConnectors } from "@replit/connectors-sdk";
import { createClient } from "@replit/revenuecat-sdk/client";

export async function getUncachableRevenueCatClient() {
  const connectors = new ReplitConnectors();

  const client = createClient({
    baseUrl: "https://api.revenuecat.com/v2",
    fetch: async (request: Request): Promise<Response> => {
      const url = new URL(request.url);
      const path = url.pathname + url.search;

      const init: { method: string; headers?: Record<string, string>; body?: string } = { method: request.method };

      if (request.method !== "GET" && request.method !== "HEAD") {
        const body = await request.text();
        if (body) init.body = body;
      }

      const contentType = request.headers.get("content-type");
      if (contentType) {
        init.headers = { "content-type": contentType };
      }

      return connectors.proxy("revenuecat", path, init) as Promise<Response>;
    },
  });

  return client;
}
