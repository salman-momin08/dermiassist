
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { generateAgoraToken } from "@/ai/flows/generate-agora-token";

const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID || "";

function VideoCall({ channelName }: { channelName: string }) {
  const { user, role, loading: authLoading } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (authLoading || !user || !role) return;

    const getToken = async () => {
      setError(null);
      try {
        const numericUserId = parseInt(user.uid.replace(/[^0-9]/g, '').substring(0, 8) || "0", 10);
        
        const { token } = await generateAgoraToken({
          channelName,
          userId: numericUserId.toString(),
          role: "publisher",
        });

        if (!token) {
          throw new Error("Received an empty token from the service.");
        }
        setToken(token);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
        setError(`Could not get an access token. ${errorMessage}`);
        toast({
          title: "Video Service Error",
          description: `Could not get an access token. ${errorMessage}`,
          variant: "destructive",
        });
      } finally {
        setIsJoining(false);
      }
    };
    getToken();
  }, [channelName, authLoading, user, role, toast]);

  if (isJoining || authLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Joining video call...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Connection Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!token || !user) {
    return null;
  }
  
  const agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
  const numericUserId = parseInt(user.uid.replace(/[^0-9]/g, '').substring(0, 8) || "0", 10);

  return (
    <AgoraRTCProvider client={agoraClient}>
      <div className="h-screen bg-muted flex flex-col">
        <Conference
          appId={appId}
          channelName={channelName}
          token={token}
          uid={numericUserId}
        />
      </div>
    </AgoraRTCProvider>
  );
}

function Conference(props: {
  appId: string;
  channelName: string;
  token: string | null;
  uid: number;
}) {
  const { appId, channelName, token, uid } = props;
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

    if (token && micTrack && cameraTrack) {
        join();
    }

    return () => {
        agoraClient.leave();
    }

  }, [agoraClient, appId, channelName, token, uid, micTrack, cameraTrack]);
  
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

export default function VideoCallPage({ params }: { params: { roomId: string } }) {
  return <VideoCall channelName={params.roomId} />;
}
