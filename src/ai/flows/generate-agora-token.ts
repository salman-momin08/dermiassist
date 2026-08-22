
'use server';

import { RtcTokenBuilder, RtcRole } from "agora-token";

export async function generateToken(channelName: string, uid: string) {
    const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!appId || !appCertificate) {
        console.error("Agora credentials are not configured on the server.");
        throw new Error("Agora credentials are not configured on the server.");
    }

    const role = RtcRole.PUBLISHER;
    const expirationTimeInSeconds = 3600; // 1 hour
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    // IMPORTANT: The UID for token generation must be a number.
    // The Agora SDK on the client side can use a string UID, but the token generation library requires a number.
    // If your user IDs are strings, you must map them to integers for token generation.
    // For this prototype, we'll parse the string UID, assuming it's a number.
    // In a production app, you would need a more robust mapping system.
    const numericUid = isNaN(Number(uid)) ? 0 : Number(uid);

    const token = RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        channelName,
        numericUid,
        role,
        privilegeExpiredTs,
        privilegeExpiredTs // tokenExpire - same as privilege expiration
    );
    return token;
}
