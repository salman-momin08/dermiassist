
"use client";

import React, { useState, useEffect, useCallback } from "react";
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


function Conference(props: {
  appId: string;
  channelName: string;
  uid: string;
  token: string | null;
}) {
  const { appId, channelName, uid, token } = props;
  const agoraClient = useRTCClient();
  const { localMicrophoneTrack: micTrack } = useLocalMicrophoneTrack();
  const { localCameraTrack: cameraTrack } = useLocalCameraTrack();
  const remoteUsers = useRemoteUsers();
  const router = useRouter();

  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);

  useClientEvent(agoraClient, "user-published", (user) => {
    agoraClient.subscribe(user, "video");
    agoraClient.subscribe(user, "audio");
  });
  
  useEffect(() => {
    const join = async () => {
      if (!micTrack || !cameraTrack) return;
      
      await agoraClient.join(appId, channelName, token, uid);
      await agoraClient.publish([micTrack, cameraTrack]);
    };

    join();

    return () => {
        // Ensure tracks are stopped and closed
        if (cameraTrack) {
            cameraTrack.stop();
            cameraTrack.close();
        }
        if (micTrack) {
            micTrack.stop();
            micTrack.close();
        }
        // Leave the channel
        agoraClient.leave();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId, agoraClient, channelName, token, uid]);
  
  const handleLeave = () => {
    router.back();
  }

  const toggleMic = async () => {
    if (micTrack) {
      await micTrack.setEnabled(!micOn);
      setMicOn(!micOn);
    }
  };
  const toggleCam = async () => {
    if (cameraTrack) {
      await cameraTrack.setEnabled(!cameraOn);
      setCameraOn(!cameraOn);
    }
  };


  return (
    <>
      <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-black rounded-lg relative overflow-hidden">
            {cameraTrack && <LocalVideoTrack track={cameraTrack} play={true} className="h-full w-full object-cover" />}
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
        <Button onClick={handleLeave} variant="destructive" size="icon" className="rounded-full h-12 w-12">
            <PhoneOff />
        </Button>
      </div>
    </>
  );
}

function VideoCall({ channelName }: { channelName: string }) {
  const { user, loading: authLoading } = useAuth();
  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID || "";
  const { toast } = useToast();
  const [hasPermission, setHasPermission] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    const setup = async () => {
      if (!user) return;
      try {
        // 1. Check for media permissions
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        stream.getTracks().forEach(track => track.stop());
        setHasPermission(true);

        // 2. Fetch Agora token
        const fetchedToken = await generateToken(channelName, user.uid);
        setToken(fetchedToken);

      } catch (error) {
        console.error("Setup failed:", error);
        if (error instanceof Error && (error.name === "NotAllowedError" || error.name === "PermissionDeniedError")) {
             toast({
              title: "Permission Denied",
              description: "Camera and microphone access is required. Please enable it in your browser settings and refresh.",
              variant: "destructive",
              duration: 10000,
            });
        } else {
             toast({
              title: "Connection Error",
              description: "Could not connect to the video service.",
              variant: "destructive",
            });
        }
        setHasPermission(false);
      } finally {
        setIsReady(true);
      }
    };
    if (!authLoading) {
      setup();
    }
  }, [channelName, user, toast, authLoading]);

  if (!isReady || authLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Initializing call...</p>
      </div>
    );
  }
  
  if (!hasPermission) {
    return (
       <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
              SkinWise needs access to your camera and microphone. Please update your browser permissions and refresh the page.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!appId || !token) {
    return (
       <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Configuration Error</AlertTitle>
          <AlertDescription>The video service is not correctly configured or failed to generate a token.</AlertDescription>
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
          token={token}
        />
      </div>
    </AgoraRTCProvider>
  );
}


const DynamicVideoCall = dynamic(
  () => Promise.resolve(VideoCall),
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
  
  return <DynamicVideoCall channelName={roomId} />;
}
