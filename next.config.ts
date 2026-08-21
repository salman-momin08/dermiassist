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
        // @ts-ignore - this is a known experimental flag or may just silence the specific warning
        turbopack: {
            root: '.',
        }
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

        return config;
    },
};

export default nextConfig;

