
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
} from "@100mslive/react-sdk";
import { HMSRoomProvider } from "@100mslive/react-sdk";
import { generate100msToken } from "@/ai/flows/generate-100ms-token";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

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
    hmsActions.leave();
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


function VideoCallPage({ params }: { params: { roomId: string } }) {
  const { user, role, userData, loading: authLoading } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const hmsActions = useHMSActions();
  const { toast } = useToast();

  useEffect(() => {
    const getToken = async () => {
      if (!user || !role) return;

      try {
        const { token: authToken } = await generate100msToken({
          userId: user.uid,
          role: role,
        });
        setToken(authToken);
      } catch (e) {
        console.error("Token generation failed", e);
        toast({
          title: "Error joining call",
          description: "Could not get authentication to join the video call.",
          variant: "destructive"
        })
      }
    };
    if (!authLoading && user && role) {
      getToken();
    }
  }, [user, role, authLoading, toast]);


  useEffect(() => {
    if (!token || !userData) return;

    hmsActions.join({
      userName: userData.displayName || "User",
      authToken: token,
      settings: {
        isAudioEnabled: true,
        isVideoEnabled: true,
      },
       metaData: JSON.stringify({ image: userData.photoURL })
    });

    return () => {
        hmsActions.leave();
    }
  }, [token, hmsActions, userData]);

  if (authLoading || !token) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Joining secure call...</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-muted">
       <Conference />
    </div>
  );
}

// Wrapper needed for pages that use HMS Hooks
export default function VideoCallPageWrapper({ params }: { params: { roomId: string } }) {
    return (
        <HMSRoomProvider>
            <VideoCallPage params={params}/>
        </HMSRoomProvider>
    );
};

    