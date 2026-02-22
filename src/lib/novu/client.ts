import { Novu } from '@novu/node';

if (!process.env.NOVU_API_SECRET) {
    throw new Error('Missing NOVU_API_SECRET environment variable');
}

export const novu = new Novu(process.env.NOVU_API_SECRET, {
    backendUrl: process.env.NEXT_PUBLIC_NOVU_BACKEND_URL,
});
