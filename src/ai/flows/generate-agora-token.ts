
'use server';

import { RtcTokenBuilder, RtcRole } from "agora-token";
import { createClient } from "@/lib/supabase/server";
import { uuidToAgoraUid } from "@/lib/agora-uid";

// `channelName` is always an appointments.id UUID (see src/app/video/[roomId]/*
// where roomId is set to appointment.id) — so authorizing the token means
// checking the caller is a participant of that appointment.
export async function generateToken(channelName: string, uid: string) {
    const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!appId || !appCertificate) {
        console.error("Agora credentials are not configured on the server.");
        throw new Error("Agora credentials are not configured on the server.");
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        throw new Error("Unauthorized: you must be signed in to join a video call.");
    }
    if (user.id !== uid) {
        throw new Error("Unauthorized: cannot request a video token for another user.");
    }

    const { data: appointment, error: apptError } = await supabase
        .from('appointments')
        .select('id, patient_id, doctor_id')
        .eq('id', channelName)
        .single();
    if (apptError || !appointment) {
        throw new Error("Unauthorized: appointment not found.");
    }
    if (appointment.patient_id !== user.id && appointment.doctor_id !== user.id) {
        throw new Error("Unauthorized: you are not a participant in this appointment.");
    }

    const role = RtcRole.PUBLISHER;
    const expirationTimeInSeconds = 3600; // 1 hour
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    // Agora's token/UID field is a 32-bit integer, but Supabase user ids are
    // UUID strings. `uuidToAgoraUid` deterministically hashes the UUID into a
    // stable positive int32 so the UID minted into the token here always
    // matches the UID the client joins with (see agora-conference.tsx),
    // instead of every user colliding onto UID 0.
    const numericUid = uuidToAgoraUid(uid);

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
