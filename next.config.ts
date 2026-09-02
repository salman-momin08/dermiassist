import type { NextConfig } from 'next';

// ─────────────────────────────────────────────────────────────
// Security Headers
// Applied to every response from the Next.js server.
// ─────────────────────────────────────────────────────────────
const securityHeaders = [
    // Enforce HTTPS for 2 years; include subdomains; allow preloading
    {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
    },
    // Prevent the app from being embedded in iframes (clickjacking)
    {
        key: 'X-Frame-Options',
        value: 'DENY',
    },
    // Prevent MIME type sniffing
    {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
    },
    // Control how much referrer info is sent with outbound requests
    {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
    },
    // Restrict access to browser APIs (camera/mic should only be used client-side)
    {
        key: 'Permissions-Policy',
        value: 'camera=(), geolocation=(), payment=()',
    },
    // Enable XSS protection in older browsers (belt-and-suspenders)
    {
        key: 'X-XSS-Protection',
        value: '1; mode=block',
    },
];

const nextConfig: NextConfig = {
    /* config options here */
    // Ensure Next.js doesn't look at parent directories for workspace roots
    experimental: {
        serverActions: {
            bodySizeLimit: '10mb',
        },
    },
    // serverExternalPackages: ['stream-chat', 'stream-chat-react'],
    typescript: {
        ignoreBuildErrors: false,
    },

    // ── Security Headers ────────────────────────────────────
    async headers() {
        return [
            {
                // Apply to all routes
                source: '/(.*)',
                headers: securityHeaders,
            },
        ];
    },

    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'placehold.co',
                port: '',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'res.cloudinary.com',
                port: '',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'picsum.photos',
                port: '',
                pathname: '/**',
            },
        ],
    },

    webpack: (config, { isServer }) => {
        // Ignore dynamic require warnings from handlebars (used by Genkit)
        config.ignoreWarnings = [
            { module: /node_modules\/handlebars\/lib\/index\.js/ },
            { message: /require\.extensions is not supported by webpack/ },
        ];

        // Genkit pulls in @opentelemetry/sdk-node, which does a conditional
        // require('@opentelemetry/exporter-jaeger') guarded by try/catch —
        // OpenTelemetry deliberately excludes it from sdk-node's own
        // dependencies because JaegerExporter doesn't support bundling, so
        // it's never installed. We never set OTEL_TRACES_EXPORTER=jaeger, so
        // that require never actually runs, but webpack still tries to
        // resolve it statically at build time and fails the build. Alias it
        // to false so webpack treats it as an empty module instead.
        // config.resolve.alias is typed as either a plain object or an
        // AliasOption[] array; guard both that and a missing `resolve`
        // so the merge below can't throw at build time.
        config.resolve = config.resolve || {};
        const existingAlias = Array.isArray(config.resolve.alias) ? {} : config.resolve.alias;
        config.resolve.alias = {
            ...existingAlias,
            '@opentelemetry/exporter-jaeger': false,
        };

        return config;
    },
};

export default nextConfig;

