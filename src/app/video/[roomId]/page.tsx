
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import AgoraRTC, {
  AgoraRTCProvider,
  useRTCClient,
  useClientEvent,
  useRemoteUsers,
  RemoteUser,
  LocalVideoTrack,
  type ILocalAudioTrack,
  type ILocalVideoTrack,
} from "agora-rtc-react";
import { Button } from "@/components/ui/button";
import { Loader2, Mic, MicOff, Video, VideoOff, PhoneOff, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import dynamic from 'next/dynamic';
import { generateToken } from "@/ai/flows/generate-agora-token";

type LocalTracks = [ILocalAudioTrack, ILocalVideoTrack];

// This is the core video conference component. It handles all Agora logic.
function Conference() {
  const { user } = useAuth();
  const { roomId } = useParams() as { roomId: string };
  const router = useRouter();
  const { toast } = useToast();

  const agoraClient = useRTCClient();
  const remoteUsers = useRemoteUsers();

  const [localTracks, setLocalTracks] = useState<LocalTracks | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [isJoining, setIsJoining] = useState(true);
  const [hasCameraPermission, setHasCameraPermission] = useState(true);

  // Subscribe to remote users when they publish their streams
  useClientEvent(agoraClient, "user-published", (publishedUser, mediaType) => {
    agoraClient.subscribe(publishedUser, mediaType);
  });

  useEffect(() => {
    let isMounted = true;

    const setupAndJoin = async () => {
      if (!user || !roomId) return;

      try {
        // Create tracks first to get permissions
        const tracks = await AgoraRTC.createMicrophoneAndCameraTracks();
        if (!isMounted) {
          tracks[0].close();
          tracks[1].close();
          return;
        }

        setLocalTracks(tracks);
        setHasCameraPermission(true);

        const fetchedToken = await generateToken(roomId, user.id);
        if (!isMounted) return;

        await agoraClient.join(process.env.NEXT_PUBLIC_AGORA_APP_ID!, roomId, fetchedToken, user.id);
        await agoraClient.publish(tracks);

        setIsJoining(false);

      } catch (error: any) {
        if (error.code === "PERMISSION_DENIED") {
          setHasCameraPermission(false);
          toast({
            title: "Permission Denied",
            description: "Camera and microphone access is required for video calls.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Connection Error",
            description: "Failed to join the video call. Please try again.",
            variant: "destructive"
          });
        }
        // Redirect back if there's a critical error
        // setTimeout(() => router.back(), 3000);
      }
    };

    setupAndJoin();

    return () => {
      isMounted = false;
      const tracks = localTracks;
      setLocalTracks(null);
      if (tracks) {
        tracks[0].close();
        tracks[1].close();
      }
      agoraClient.leave().catch(err => {
        // Handle leaving gracefully without logging
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agoraClient, roomId, user]);

  const toggleMic = async () => {
    if (localTracks) {
      await localTracks[0].setEnabled(!micOn);
      setMicOn(!micOn);
    }
  };

  const toggleCam = async () => {
    if (localTracks) {
      await localTracks[1].setEnabled(!cameraOn);
      setCameraOn(!cameraOn);
    }
  };

  if (isJoining && hasCameraPermission) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Joining call...</p>
      </div>
    );
  }

  if (!hasCameraPermission) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4">
        <Alert variant="destructive" className="max-w-md text-center">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Permissions Required</AlertTitle>
          <AlertDescription>
            DermiAssist-AI needs access to your camera and microphone. Please enable permissions in your browser settings and refresh the page.
          </AlertDescription>
          <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
        </Alert>
      </div>
    );
  }

  return (
    <div className="h-screen bg-muted flex flex-col">
      <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-black rounded-lg relative overflow-hidden">
          {localTracks && cameraOn ? (
            <LocalVideoTrack track={localTracks[1]} play={true} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-black flex items-center justify-center text-white">Camera Off</div>
          )}
          <div className="absolute bottom-2 left-2 bg-background/50 px-2 py-1 rounded text-sm">
            You
          </div>
        </div>

        {remoteUsers.map((remoteUser) => (
          <div key={remoteUser.uid} className="bg-black rounded-lg relative overflow-hidden">
            <RemoteUser user={remoteUser} playVideo={true} playAudio={true} className="h-full w-full object-cover" />
            <div className="absolute bottom-2 left-2 bg-background/50 px-2 py-1 rounded text-sm">
              Participant
            </div>
          </div>
        ))}
        {remoteUsers.length === 0 && (
          <div className="bg-black rounded-lg flex items-center justify-center text-muted-foreground">
            <p>Waiting for the other participant to join...</p>
          </div>
        )}
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


// Use dynamic import with ssr: false to ensure this component only runs on the client
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


// This is the main page component. It sets up the Agora provider.
export default function VideoCallPage() {
  const { user, loading: authLoading } = useAuth();
  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;

  if (authLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Authenticating...</p>
      </div>
    );
  }

  if (!appId) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Configuration Error</AlertTitle>
          <AlertDescription>The video service is not configured. Please set NEXT_PUBLIC_AGORA_APP_ID in your environment.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

  return (
    <AgoraRTCProvider client={agoraClient}>
      <DynamicConference />
    </AgoraRTCProvider>
  );
}
