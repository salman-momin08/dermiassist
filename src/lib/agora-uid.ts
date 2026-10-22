/**
 * @fileOverview Deterministic UUID -> Agora numeric UID mapping.
 *
 * Agora's RTC token/UID field is a 32-bit integer, but Supabase user ids are
 * UUID strings. Naively doing `Number(uuid)` always yields `NaN`, which
 * historically collapsed EVERY user onto Agora UID 0 (see the removed logic in
 * `src/ai/flows/generate-agora-token.ts`). That silently let unrelated
 * participants collide onto the same publisher slot.
 *
 * This module is intentionally dependency-free and avoids `node:crypto` so
 * the exact same function can run both in a Node Server Action (minting the
 * token) and in a browser client component (joining the channel) — both
 * sides must derive the identical number for a given UUID, or the minted
 * token's UID and the client's join UID will disagree and Agora will reject
 * the join.
 *
 * Uses the classic FNV-1a 32-bit hash, then masks off the sign bit so the
 * result is always a non-negative int32, which is what Agora's
 * `buildTokenWithUid` / `client.join` expect.
 */

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * Hash an arbitrary string into a deterministic positive 31-bit integer.
 * Same input always produces the same output, on any JS runtime.
 */
export function uuidToAgoraUid(uuid: string): number {
    let hash = FNV_OFFSET_BASIS;

    for (let i = 0; i < uuid.length; i++) {
        hash ^= uuid.charCodeAt(i);
        // Multiply by the FNV prime using Math.imul to keep this a 32-bit
        // integer operation (regular `*` would drift into float precision).
        hash = Math.imul(hash, FNV_PRIME);
    }

    // Mask to 31 bits so the value is always positive (Agora UIDs are
    // unsigned but we avoid the sign bit entirely to sidestep any
    // signed/unsigned int32 ambiguity across SDKs).
    return hash & 0x7fffffff;
}
