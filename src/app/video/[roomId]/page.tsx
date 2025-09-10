
"use client";

import React, { useEffect, useState } from "react";
import {
  useHMSStore,
  useHMSActions,
  selectIsConnectedToRoom,
  selectPeers,
  selectIsLocalAudioEnabled,
  selectIsLocalVideoEnabled,
  useVideo,
  HMSRoomProvider,
} from "@100mslive/react-sdk";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, User, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const Conference = () => {
  const isConnected = useHMSStore(selectIsConnectedToRoom);
  const hmsActions = useHMSActions();
  const peers = useHMSStore(selectPeers);
  const isLocalAudioEnabled = useHMSStore(selectIsLocalAudioEnabled);
  const isLocalVideoEnabled = useHMSStore(selectIsLocalVideoEnabled);
  const router = useRouter();

  const toggleAudio = async () => {
    await hmsActions.setLocalAudioEnabled(!isLocalAudioEnabled);
  };

  const toggleVideo = async () => {
    await hmsActions.setLocalVideoEnabled(!isLocalVideoEnabled);
  };
  
  const handleLeave = () => {
    if(hmsActions.leave) {
        hmsActions.leave();
    }
    router.back(); // Go back to the previous page (appointments)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 place-items-center">
        {peers.map((peer) => (
          <Peer key={peer.id} peer={peer} />
        ))}
      </div>

      {isConnected && (
         <div className="bg-background/80 p-4 flex justify-center items-center gap-4 border-t">
            <Button onClick={toggleAudio} variant={isLocalAudioEnabled ? 'secondary' : 'destructive'} size="icon" className="rounded-full h-12 w-12">
                {isLocalAudioEnabled ? <Mic /> : <MicOff />}
            </Button>
            <Button onClick={toggleVideo} variant={isLocalVideoEnabled ? 'secondary' : 'destructive'} size="icon" className="rounded-full h-12 w-12">
                {isLocalVideoEnabled ? <VideoIcon /> : <VideoOff />}
            </Button>
            <Button onClick={handleLeave} variant="destructive" size="icon" className="rounded-full h-12 w-12">
                <PhoneOff />
            </Button>
        </div>
      )}
    </div>
  );
};

const Peer = ({ peer }: { peer: any }) => {
  const { videoRef } = useVideo({
    trackId: peer.videoTrack,
  });
  const isVideoOn = peer.videoEnabled;
  const peerMetadata = peer.metadata ? JSON.parse(peer.metadata) : {};

  return (
    <Card className="relative w-full h-full flex items-center justify-center overflow-hidden bg-muted">
        <video
          ref={videoRef}
          className={`h-full w-full object-cover transition-opacity duration-300 ${peer.isLocal ? "mirror" : ""}`}
          autoPlay
          playsInline
          style={{ opacity: isVideoOn ? 1 : 0 }}
        />
        {!isVideoOn && (
             <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <Avatar className="h-24 w-24">
                     <AvatarImage src={peerMetadata?.image} />
                     <AvatarFallback><User className="h-10 w-10"/></AvatarFallback>
                </Avatar>
                <p className="font-semibold text-lg">{peer.name}</p>
            </div>
        )}
         <div className="absolute bottom-2 left-2 bg-background/50 text-foreground text-xs px-2 py-1 rounded">
            {peer.name}
        </div>
    </Card>
  );
};


function VideoCallClient({ roomId }: { roomId: string }) {
  const { user, role, userData, loading: authLoading } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hmsActions = useHMSActions();
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (authLoading || !user || !role || !userData) return;

    const getToken = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/generate-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    roomId: roomId,
                    role: role,
                    userId: user.uid,
                })
            });

            const body = await response.json();
            if (!response.ok) {
                throw new Error(body.error || "Failed to fetch token");
            }
            
            setToken(body.token);

        } catch (error) {
             const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
             toast({
                title: "Video Service Error",
                description: errorMessage,
                variant: "destructive",
            });
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };
    
    getToken();

  }, [authLoading, user, role, userData, roomId, toast]);

  useEffect(() => {
    if (!token || !userData || !hmsActions) return;

    hmsActions.join({
      userName: userData.displayName || "User",
      authToken: token,
      settings: {
        isAudioEnabled: true,
        isVideoEnabled: true,
      },
       metaData: JSON.stringify({ image: userData.photoURL })
    }).catch(err => {
      console.error("Error joining HMS room:", err);
      toast({
        title: "Connection Failed",
        description: "Could not connect to the video call room.",
        variant: "destructive",
      });
      setError("Failed to connect to the room.");
    });

    return () => {
        if(hmsActions.leave) {
          hmsActions.leave();
        }
    }
  }, [token, hmsActions, userData, toast]);

  if (isLoading || authLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Connecting to video call...</p>
      </div>
    );
  }

  if (error) {
     return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4">
        <Alert variant="destructive" className="max-w-md">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Connection Error</AlertTitle>
            <AlertDescription>
                {error}
                <br />
                Please try again later.
            </AlertDescription>
        </Alert>
         <Button onClick={() => router.back()} variant="outline" className="mt-4">
            Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-muted">
       <Conference />
    </div>
  );
}

// This wrapper component provides the HMSRoomProvider
const VideoCallWrapper = ({ roomId }: { roomId: string }) => {
    return (
        <HMSRoomProvider>
            <VideoCallClient roomId={roomId} />
        </HMSRoomProvider>
    );
}

// The default export is a Server Component that renders the client wrapper
export default function VideoCallPage({ params }: { params: { roomId: string } }) {
    return <VideoCallWrapper roomId={params.roomId} />;
};
