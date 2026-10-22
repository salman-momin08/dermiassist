import { Novu } from '@novu/node';

let client: Novu | undefined;

export function getNovu(): Novu {
    const apiKey = process.env.NOVU_API_SECRET;
    if (!apiKey) throw new Error('Notifications are not configured (NOVU_API_SECRET missing).');
    client ??= new Novu(apiKey, { backendUrl: process.env.NEXT_PUBLIC_NOVU_BACKEND_URL });
    return client;
}
