import { Novu } from '@novu/node';

const apiKey = process.env.NOVU_API_SECRET || '';

export const novu = new Novu(apiKey, {
    backendUrl: process.env.NEXT_PUBLIC_NOVU_BACKEND_URL,
});
