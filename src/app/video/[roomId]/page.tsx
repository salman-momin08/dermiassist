
"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import AgoraRTC, {
  AgoraRTCProvider,
  useRTCClient,
  useClientEvent,
  useLocalMicrophoneTrack,
  useLocalCameraTrack,
  useRemoteUsers,
  RemoteUser,
  LocalVideoTrack,
} from "agora-rtc-react";
import { Button } from "@/components/ui/button";
import { Loader2, Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

function VideoCall({ channelName }: { channelName: string }) {
  const { user, loading: authLoading } = useAuth();
  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID || "";
  const { toast } = useToast();


  if (authLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Joining video call...</p>
      </div>
    );
  }

  if (!appId) {
    return (
       <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Configuration Error</AlertTitle>
          <AlertDescription>The video service is not correctly configured. Please check your .env file for NEXT_PUBLIC_AGORA_APP_ID.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!user) {
     return (
       <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Authentication Error</AlertTitle>
          <AlertDescription>You must be logged in to join a video call.</AlertDescription>
        </Alert>
      </div>
    );
  }
  
  const agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

  return (
    <AgoraRTCProvider client={agoraClient}>
      <div className="h-screen bg-muted flex flex-col">
        <Conference
          appId={appId}
          channelName={channelName}
          uid={user.uid}
          token={null} // Using null token for basic setup
        />
      </div>
    </AgoraRTCProvider>
  );
}

function Conference(props: {
  appId: string;
  channelName: string;
  uid: string;
  token: string | null;
}) {
  const { appId, channelName, uid, token } = props;
  const agoraClient = useRTCClient();
  const { micTrack, isMuted: isMicMuted, isMicrophoneOn, setMicOn } = useLocalMicrophoneTrack();
  const { cameraTrack, isMuted: isCamMuted, isCameraOn, setCameraOn } = useLocalCameraTrack();
  const remoteUsers = useRemoteUsers();
  const router = useRouter();

  useClientEvent(agoraClient, "user-published", (user) => {
    agoraClient.subscribe(user, "video");
    agoraClient.subscribe(user, "audio");
  });
  
  useEffect(() => {
    const join = async () => {
      await agoraClient.join(appId, channelName, token, uid);
      await agoraClient.publish([micTrack, cameraTrack]);
    };

    if (micTrack && cameraTrack) {
        join();
    }

    return () => {
        agoraClient.leave();
    }

  }, [agoraClient, appId, channelName, uid, token, micTrack, cameraTrack]);
  
  const handleLeave = async () => {
    await agoraClient.leave();
    router.back();
  }

  const toggleMic = () => setMicOn(!isMicrophoneOn);
  const toggleCam = () => setCameraOn(!isCameraOn);

  return (
    <>
      <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Local User Video */}
        <div className="bg-black rounded-lg relative">
            <LocalVideoTrack track={cameraTrack} play={isCameraOn} />
             <div className="absolute bottom-2 left-2 bg-background/50 px-2 py-1 rounded text-sm">
                You
            </div>
        </div>

        {/* Remote Users Video */}
        {remoteUsers.map((user) => (
          <div key={user.uid} className="bg-black rounded-lg">
            <RemoteUser user={user} playVideo={true} playAudio={true} />
            <div className="absolute bottom-2 left-2 bg-background/50 px-2 py-1 rounded text-sm">
                Remote User
            </div>
          </div>
        ))}
      </div>
      
      {/* Controls */}
      <div className="bg-background/80 p-4 flex justify-center items-center gap-4 border-t">
        <Button onClick={toggleMic} variant={isMicrophoneOn ? 'secondary' : 'destructive'} size="icon" className="rounded-full h-12 w-12">
            {isMicrophoneOn ? <Mic /> : <MicOff />}
        </Button>
        <Button onClick={toggleCam} variant={isCameraOn ? 'secondary' : 'destructive'} size="icon" className="rounded-full h-12 w-12">
            {isCameraOn ? <Video /> : <VideoOff />}
        </Button>
        <Button onClick={handleLeave} variant="destructive" size="icon" className="rounded-full h-12 w-12">
            <PhoneOff />
        </Button>
      </div>
    </>
  );
}

export default function VideoCallPage() {
  const params = useParams();
  const roomId = params?.roomId as string;

  if (!roomId) {
    return (
       <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading Room...</p>
      </div>
    )
  }
  
  return <VideoCall channelName={roomId} />;
}
