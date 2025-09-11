
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

// This is the core video conference component. It handles all Agora logic.
function Conference() {
  const { user } = useAuth();
  const { roomId } = useParams() as { roomId: string };
  const router = useRouter();
  const { toast } = useToast();
  
  // Use Agora's RTC client
  const agoraClient = useRTCClient();
  
  // Get local media tracks
  const { localMicrophoneTrack } = useLocalMicrophoneTrack(true);
  const { localCameraTrack } = useLocalCameraTrack(true);
  
  // State for media controls and connection
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(true);
  
  // Fetch a secure token from our server action
  useEffect(() => {
    if (!user || !roomId) return;

    const fetchToken = async () => {
      try {
        const fetchedToken = await generateToken(roomId, user.uid);
        setToken(fetchedToken);
      } catch (error) {
        console.error("Failed to fetch Agora token", error);
        toast({
          title: "Authentication Error",
          description: "Could not get a token to join the call. Please ensure your Agora credentials are set.",
          variant: "destructive",
        });
        // Redirect back if token fetching fails
        router.back();
      }
    };
    fetchToken();
  }, [user, roomId, toast, router]);
  
  // Main effect to join and leave the channel
  useEffect(() => {
    if (!token || !user || !localCameraTrack || !localMicrophoneTrack) {
      return;
    }

    const joinChannel = async () => {
        try {
            // Join the channel with the fetched token
            await agoraClient.join(process.env.NEXT_PUBLIC_AGORA_APP_ID!, roomId, token, user.uid);
            
            // Publish local tracks
            await agoraClient.publish([localMicrophoneTrack, localCameraTrack]);

            setIsJoining(false); // Update state to show the video feed
        } catch(error) {
             console.error("Agora join/publish error", error);
             toast({
                title: "Connection Error",
                description: "Failed to join the video call channel.",
                variant: "destructive"
             });
             router.back();
        }
    };
    
    joinChannel();

    // The cleanup function to leave the channel when the component unmounts
    return () => {
      localCameraTrack?.close();
      localMicrophoneTrack?.close();
      agoraClient.leave();
    };
  // We only want this effect to run once when the token and tracks are ready.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user, agoraClient, roomId]);

  // Subscribe to remote users when they publish their streams
  const remoteUsers = useRemoteUsers();
  useClientEvent(agoraClient, "user-published", (publishedUser, mediaType) => {
    agoraClient.subscribe(publishedUser, mediaType);
  });
  
  // Toggle microphone on/off
  const toggleMic = async () => {
    if (localMicrophoneTrack) {
      await localMicrophoneTrack.setEnabled(!micOn);
      setMicOn(!micOn);
    }
  };

  // Toggle camera on/off
  const toggleCam = async () => {
    if (localCameraTrack) {
      await localCameraTrack.setEnabled(!cameraOn);
      setCameraOn(!cameraOn);
    }
  };

  if (isJoining) {
     return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Joining call...</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-muted flex flex-col">
      <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Local user's video feed */}
        <div className="bg-black rounded-lg relative overflow-hidden">
            {localCameraTrack && cameraOn ? (
              <LocalVideoTrack track={localCameraTrack} play={true} className="h-full w-full object-cover" />
            ) : (
                <div className="h-full w-full bg-black flex items-center justify-center text-white">Camera Off</div>
            )}
             <div className="absolute bottom-2 left-2 bg-background/50 px-2 py-1 rounded text-sm">
                You
            </div>
        </div>

        {/* Remote users' video feeds */}
        {remoteUsers.map((remoteUser) => (
          <div key={remoteUser.uid} className="bg-black rounded-lg relative overflow-hidden">
            <RemoteUser user={remoteUser} playVideo={true} playAudio={true} className="h-full w-full object-cover" />
            <div className="absolute bottom-2 left-2 bg-background/50 px-2 py-1 rounded text-sm">
                {remoteUser.uid === 'doctor' ? 'Doctor' : 'Patient'}
            </div>
          </div>
        ))}
         {remoteUsers.length === 0 && (
            <div className="bg-black rounded-lg flex items-center justify-center text-muted-foreground">
                <p>Waiting for the other participant to join...</p>
            </div>
        )}
      </div>
      
      {/* Call controls */}
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

  // Show a loading state while authentication is in progress
  if (authLoading) {
      return (
         <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Authenticating...</p>
        </div>
      );
  }

  // Display an error if the Agora App ID is not configured
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
  
  // Create an Agora client instance
  const agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

  return (
    // Provide the Agora client to all child components
    <AgoraRTCProvider client={agoraClient}>
        <DynamicConference />
    </AgoraRTCProvider>
  );
}
