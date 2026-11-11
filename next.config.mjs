const isDevelopment = process.env.NODE_ENV !== "production";

// Third-party origins: Razorpay checkout, Cloudinary/GCS images, Google Maps embed.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""} https://checkout.razorpay.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com",
  "font-src 'self' data:",
  "connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com https://api.cloudinary.com",
  "frame-src https://api.razorpay.com https://checkout.razorpay.com https://maps.google.com https://www.google.com",
  "form-action 'self' https://api.razorpay.com mailto:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://checkout.razorpay.com\")" },
];

/**
 * Crawlers that get each page's metadata in the initial <head> instead of
 * streamed into <body>: Google accepts rel="canonical" only in <head>, and
 * link-preview and search crawlers read only the head.
 * This is Next.js's default list (next/dist/shared/lib/router/utils/html-bots.js,
 * 16.4) plus Googlebot itself, Pinterest, Telegram, Snapchat, other search
 * engines and the AI search crawlers. Bulk AI training crawlers are left out:
 * they keep the cheaper prerendered responses. Shoppers are unaffected.
 */
const htmlLimitedBots = new RegExp(
  [
    // Next.js defaults
    "[\\w-]+-Google",
    "Google-[\\w-]+",
    "Chrome-Lighthouse",
    "Slurp",
    "DuckDuckBot",
    "baiduspider",
    "yandex",
    "sogou",
    "bitlybot",
    "tumblr",
    "vkShare",
    "quora link preview",
    "redditbot",
    "ia_archiver",
    "Bingbot",
    "BingPreview",
    "applebot",
    "facebookexternalhit",
    "facebookcatalog",
    "Twitterbot",
    "LinkedInBot",
    "Slackbot",
    "Discordbot",
    "WhatsApp",
    "SkypeUriPreview",
    "Yeti",
    "googleweblight",
    // Added for this store
    "Googlebot",
    "Pinterest",
    "TelegramBot",
    "Snapchat",
    "SeznamBot",
    "Qwant",
    "PetalBot",
    "MojeekBot",
    "DuckAssistBot",
    "OAI-SearchBot",
    "ChatGPT-User",
    "PerplexityBot",
    "Perplexity-User",
    "Claude-SearchBot",
    "Claude-User",
  ].join("|"),
  "i",
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheComponents: true,
  htmlLimitedBots,
  experimental: {
    globalNotFound: true,
    authInterrupts: true,
  },
  poweredByHeader: false,
  async redirects() {
    // Common policy URLs (payment providers and shoppers look for these) map to the store's pages.
    return [
      { source: "/cancellation-policy", destination: "/returns", permanent: true },
      { source: "/refund-policy", destination: "/returns", permanent: true },
      { source: "/terms", destination: "/terms-and-conditions", permanent: true },
      { source: "/privacy", destination: "/privacy-policy", permanent: true },
      { source: "/size-and-care-guide", destination: "/care-guide", permanent: true },
      { source: "/account/wishlist", destination: "/wishlist", permanent: false },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  partialPrefetching: true,
  serverExternalPackages: ["pdfkit"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
