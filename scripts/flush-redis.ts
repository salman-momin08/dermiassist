import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!redisUrl || !redisToken) {
    console.error('❌ Missing Redis environment variables');
    process.exit(1);
}

const redis = new Redis({
    url: redisUrl,
    token: redisToken,
});

async function flushCaches() {
    console.log('🧹 Flushing Redis caches...');

    try {
        // We can't easily flush all keys without SCAN if we want to be safe,
        // but for this app, we can just delete known key patterns or flush the whole DB
        // Since it's a dev/demo app, flushing the whole DB is often easiest
        // However, let's try to be a bit more specific if possible.

        const response = await redis.flushdb();
        console.log('✅ Redis DB flushed:', response);

    } catch (error) {
        console.error('❌ Error flushing Redis:', error);
    }

    console.log('🏁 Cache flush complete.');
}

flushCaches();
