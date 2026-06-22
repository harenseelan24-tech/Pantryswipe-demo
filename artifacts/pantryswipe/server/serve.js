/**
 * Standalone production server for Expo static builds.
 *
 * Serves the output of build.js (static-build/) with special routes:
 * - GET / or /manifest with expo-platform header → platform manifest JSON
 * - GET / without expo-platform → landing page HTML
 * - GET /privacy-policy → Privacy Policy HTML
 * - GET /terms-of-service → Terms of Service HTML
 * - GET /sitemap.xml → XML sitemap for crawlers
 * - GET /robots.txt → crawler governance file (sitemap pointer + bot rules)
 * - GET /llms.txt → AI-crawler discovery file
 * Everything else falls through to static file serving from ./static-build/.
 *
 * Zero external dependencies — uses only Node.js built-ins (http, fs, path).
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const STATIC_ROOT = path.resolve(__dirname, "..", "static-build");
const TEMPLATE_PATH = path.resolve(__dirname, "templates", "landing-page.html");
const PRIVACY_POLICY_PATH = path.resolve(__dirname, "templates", "privacy-policy.html");
const TERMS_PATH = path.resolve(__dirname, "templates", "terms-of-service.html");
const SOCIAL_CARD_PATH = path.resolve(__dirname, "..", "assets", "images", "social-card.png");
const APP_LOGO_PATH = path.resolve(__dirname, "..", "assets", "images", "app-logo.png");
const basePath = (process.env.BASE_PATH || "/").replace(/\/+$/, "");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json",
};

function getAppName() {
  try {
    const appJsonPath = path.resolve(__dirname, "..", "app.json");
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf-8"));
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

function getBaseUrl(req) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = forwardedProto || "https";
  const host = req.headers["x-forwarded-host"] || req.headers["host"];
  return `${protocol}://${host}`;
}

function serveManifest(platform, res) {
  const manifestPath = path.join(STATIC_ROOT, platform, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(
      JSON.stringify({ error: `Manifest not found for platform: ${platform}` }),
    );
    return;
  }

  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.writeHead(200, {
    "content-type": "application/json",
    "expo-protocol-version": "1",
    "expo-sfv-version": "0",
  });
  res.end(manifest);
}

function serveLandingPage(req, res, landingPageTemplate, appName) {
  const baseUrl = getBaseUrl(req);
  const host = req.headers["x-forwarded-host"] || req.headers["host"];
  const expsUrl = `${host}`;

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}

function serveHtmlTemplate(req, res, templatePath) {
  const baseUrl = getBaseUrl(req);
  const template = fs.readFileSync(templatePath, "utf-8");
  const html = template.replace(/BASE_URL_PLACEHOLDER/g, baseUrl);
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}

function serveSitemap(req, res) {
  const baseUrl = getBaseUrl(req);
  const today = new Date().toISOString().slice(0, 10);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/privacy-policy</loc>
    <lastmod>2026-06-01</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.4</priority>
  </url>
  <url>
    <loc>${baseUrl}/terms-of-service</loc>
    <lastmod>2026-06-01</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.4</priority>
  </url>
</urlset>`;

  res.writeHead(200, { "content-type": "application/xml; charset=utf-8" });
  res.end(xml);
}

function serveRobotsTxt(req, res) {
  const baseUrl = getBaseUrl(req);

  const txt = `User-agent: *
Allow: /
Allow: /privacy-policy
Allow: /terms-of-service

User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

Sitemap: ${baseUrl}/sitemap.xml
`;

  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end(txt);
}

function serveLlmsTxt(req, res) {
  const baseUrl = getBaseUrl(req);

  const txt = `# PantrySwipe

> AI-powered cooking ecosystem — Tinder-style recipe discovery, smart pantry management, meal planning, social feed, and AI chef chat.

PantrySwipe is a mobile app that helps you discover recipes based on ingredients already in your pantry, reduce food waste, and build a smarter cooking routine.

## Pages

- Home: ${baseUrl}/
- Privacy Policy: ${baseUrl}/privacy-policy
- Terms of Service: ${baseUrl}/terms-of-service
`;

  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end(txt);
}

function serveStaticFile(urlPath, res) {
  const safePath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(STATIC_ROOT, safePath);

  if (!filePath.startsWith(STATIC_ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { "content-type": contentType });
  res.end(content);
}

const landingPageTemplate = fs.readFileSync(TEMPLATE_PATH, "utf-8");
const appName = getAppName();

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  let pathname = url.pathname;

  if (basePath && pathname.startsWith(basePath)) {
    pathname = pathname.slice(basePath.length) || "/";
  }

  if (pathname === "/" || pathname === "/manifest") {
    const platform = req.headers["expo-platform"];
    if (platform === "ios" || platform === "android") {
      return serveManifest(platform, res);
    }

    if (pathname === "/") {
      return serveLandingPage(req, res, landingPageTemplate, appName);
    }
  }

  if (pathname === "/privacy-policy") {
    return serveHtmlTemplate(req, res, PRIVACY_POLICY_PATH);
  }

  if (pathname === "/terms-of-service") {
    return serveHtmlTemplate(req, res, TERMS_PATH);
  }

  if (pathname === "/sitemap.xml") {
    return serveSitemap(req, res);
  }

  if (pathname === "/robots.txt") {
    return serveRobotsTxt(req, res);
  }

  if (pathname === "/llms.txt") {
    return serveLlmsTxt(req, res);
  }

  if (pathname === "/social-card.png") {
    if (fs.existsSync(SOCIAL_CARD_PATH)) {
      const content = fs.readFileSync(SOCIAL_CARD_PATH);
      res.writeHead(200, {
        "content-type": "image/png",
        "cache-control": "public, max-age=86400",
      });
      res.end(content);
      return;
    }
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  if (pathname === "/app-logo.png") {
    if (fs.existsSync(APP_LOGO_PATH)) {
      const content = fs.readFileSync(APP_LOGO_PATH);
      res.writeHead(200, {
        "content-type": "image/png",
        "cache-control": "public, max-age=86400",
      });
      res.end(content);
      return;
    }
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  serveStaticFile(pathname, res);
});

const port = parseInt(process.env.PORT || "3000", 10);
server.listen(port, "0.0.0.0", () => {
  console.log(`Serving static Expo build on port ${port}`);
});
