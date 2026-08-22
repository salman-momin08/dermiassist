import { StreamChat } from 'stream-chat';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
const apiSecret = process.env.STREAM_API_SECRET;

async function run() {
    if (!apiKey || !apiSecret) {
        console.error('Missing keys');
        process.exit(1);
    }
    const client = StreamChat.getInstance(apiKey, apiSecret, { timeout: 15000 });
    
    try {
        const channels = await client.queryChannels(
            { type: { $in: ['messaging', 'consultation'] } }, 
            {}, 
            { limit: 100 }
        );
        
        let deleted = 0;
        for (const c of channels) {
            // Delete channels that are of type consultation OR its ID starts with !members-
            if (c.type === 'consultation' || c.id?.startsWith('!members-')) {
                console.log(`Deleting ${c.cid}...`);
                await c.delete({ hard_delete: true });
                deleted++;
            }
        }
        console.log(`Successfully deleted ${deleted} old duplicate/unused channels.`);
    } catch (e: any) {
        console.error("Stream API Error:", e.message || e);
    }
    process.exit(0);
}

run();
