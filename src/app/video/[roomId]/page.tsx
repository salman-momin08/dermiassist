
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
import { Loader2, Mic, MicOff, Video, VideoOff, PhoneOff, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import dynamic from 'next/dynamic';
import { generateToken } from "@/ai/flows/generate-agora-token";

function Conference() {
  const { user, loading: authLoading } = useAuth();
  const { roomId } = useParams() as { roomId: string };
  const router = useRouter();
  const { toast } = useToast();
  
  const agoraClient = useRTCClient(AgoraRTC.createClient({ mode: "rtc", codec: "vp8" }));
  const { localMicrophoneTrack, isLoading: isMicLoading } = useLocalMicrophoneTrack();
  const { localCameraTrack, isLoading: isCamLoading } = useLocalCameraTrack();
  const remoteUsers = useRemoteUsers();

  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchToken = async () => {
      if (user?.uid && roomId) {
        try {
          const fetchedToken = await generateToken(roomId, user.uid);
          setToken(fetchedToken);
        } catch (error) {
          console.error("Failed to fetch Agora token", error);
          toast({
            title: "Authentication Error",
            description: "Could not get a token to join the call.",
            variant: "destructive",
          });
        }
      }
    };
    fetchToken();
  }, [user, roomId, toast]);
  
  useEffect(() => {
    const join = async () => {
        if (!token || !localCameraTrack || !localMicrophoneTrack) return;
        try {
            await agoraClient.join(process.env.NEXT_PUBLIC_AGORA_APP_ID!, roomId, token, user!.uid);
            await agoraClient.publish([localMicrophoneTrack, localCameraTrack]);
        } catch(error) {
             console.error("Agora join/publish error", error);
        }
    };
    join();

    return () => {
        localCameraTrack?.close();
        localMicrophoneTrack?.close();
        agoraClient.leave();
    };
}, [token, localCameraTrack, localMicrophoneTrack, agoraClient, roomId, user]);

  useClientEvent(agoraClient, "user-published", (user) => {
    agoraClient.subscribe(user, "video");
    agoraClient.subscribe(user, "audio");
  });
  
  const toggleMic = async () => {
    if (localMicrophoneTrack) {
      await localMicrophoneTrack.setEnabled(!micOn);
      setMicOn(!micOn);
    }
  };
  const toggleCam = async () => {
    if (localCameraTrack) {
      await localCameraTrack.setEnabled(!cameraOn);
      setCameraOn(!cameraOn);
    }
  };

  if (authLoading || isMicLoading || isCamLoading || !token) {
     return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Initializing call...</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-muted flex flex-col">
      <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-black rounded-lg relative overflow-hidden">
            {localCameraTrack && <LocalVideoTrack track={localCameraTrack} play={true} className="h-full w-full object-cover" />}
             <div className="absolute bottom-2 left-2 bg-background/50 px-2 py-1 rounded text-sm">
                You
            </div>
        </div>

        {remoteUsers.map((user) => (
          <div key={user.uid} className="bg-black rounded-lg relative overflow-hidden">
            <RemoteUser user={user} playVideo={true} playAudio={true} />
            <div className="absolute bottom-2 left-2 bg-background/50 px-2 py-1 rounded text-sm">
                Remote User ({user.uid})
            </div>
          </div>
        ))}
      </div>
      
      <div className="bg-background/80 p-4 flex justify-center items-center gap-4 border-t">
        <Button onClick={toggleMic} variant={micOn ? 'secondary' : 'destructive'} size="icon" className="rounded-full h-12 w-12">
            {micOn ? <Mic /> : <MicOff />}
        </Button>
        <Button onClick={toggleCam} variant={cameraOn ? 'secondary' : 'destructive'} size="icon" className="rounded-full h-12 w-12">
            {cameraOn ? <Video /> : <VideoOff />}
        </Button>
        <Button onClick={() => router.back()} variant="destructive" size="icon" className="rounded-full h-12 w-12">
            <PhoneOff />
        </Button>
      </div>
    </div>
  );
}

const DynamicConference = dynamic(
  () => Promise.resolve(Conference),
  { 
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading Video Call...</p>
      </div>
    ),
  }
);


export default function VideoCallPage() {
  const { roomId } = useParams() as { roomId: string };
  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;

  if (!appId) {
     return (
       <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Configuration Error</AlertTitle>
          <AlertDescription>The video service is missing its Application ID.</AlertDescription>
        </Alert>
      </div>
    );
  }
  
  if (!roomId) {
     return (
       <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading Room...</p>
      </div>
    )
  }
  
  const agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

  return (
    <AgoraRTCProvider client={agoraClient}>
        <DynamicConference />
    </AgoraRTCProvider>
  );
}

    