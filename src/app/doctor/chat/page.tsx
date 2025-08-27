
"use client"

import { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Send, User, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { generateChatReply } from '@/ai/flows/generate-chat-reply';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useChat } from '@/hooks/use-chat';
import { collection, query, where, getDocs, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';

type Patient = {
    id: string;
    name: string;
    avatar: string;
    online: boolean;
};

export default function DoctorChatPage() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { messages, sendMessage, isLoadingMessages } = useChat(selectedPatientId, user?.uid);
  const [inputValue, setInputValue] = useState("");
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
  const [isGeneratingReplies, setIsGeneratingReplies] = useState(false);
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('participants', 'array-contains', user.uid));

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
        const patientIds = new Set<string>();
        querySnapshot.forEach(doc => {
            const participants = doc.data().participants as string[];
            const patientId = participants.find(p => p !== user.uid);
            if (patientId) {
                patientIds.add(patientId);
            }
        });

        if (patientIds.size > 0) {
            const patientPromises = Array.from(patientIds).map(id => getDoc(doc(db, 'users', id)));
            const patientDocs = await Promise.all(patientPromises);
            
            const fetchedPatients: Patient[] = patientDocs
                .filter(doc => doc.exists())
                .map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        name: data.displayName || 'Patient',
                        avatar: data.photoURL || `https://placehold.co/100x100.png?text=${(data.displayName || 'P').charAt(0)}`,
                        online: data.online || false,
                    };
            });
            setPatients(fetchedPatients);
            if (fetchedPatients.length > 0 && !selectedPatientId) {
                setSelectedPatientId(fetchedPatients[0].id);
            }
        }
        setIsLoadingPatients(false);
    });

    return () => unsubscribe();
  }, [user, selectedPatientId]);

  useEffect(() => {
    if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSendMessage = () => {
    if (!inputValue.trim() || !user || !selectedPatientId) return;
    sendMessage(inputValue);
    setInputValue("");
    setSuggestedReplies([]);
  };

  const handleGenerateReplies = async () => {
    if (!selectedPatient) return;
    setIsGeneratingReplies(true);
    setSuggestedReplies([]);
    
    const conversationHistory = messages.map(m => `${m.senderId === user?.uid ? 'Doctor' : selectedPatient.name}: ${m.text}`).join('\n');
    const lastPatientMessage = messages.filter(m => m.senderId !== user?.uid).pop()?.text;

    if (!lastPatientMessage) {
        toast({
            title: "Cannot generate replies",
            description: "There are no messages from the patient to reply to.",
            variant: "destructive"
        });
        setIsGeneratingReplies(false);
        return;
    }

    try {
        const result = await generateChatReply({
            patientName: selectedPatient.name,
            conversationHistory,
            lastPatientMessage,
        });
        setSuggestedReplies(result.replies);
    } catch (error) {
        console.error("Failed to generate replies:", error);
        toast({
            title: "AI Error",
            description: "Could not generate suggested replies. Please try again.",
            variant: "destructive"
        });
    } finally {
        setIsGeneratingReplies(false);
    }
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
        <div className="space-y-2 mb-8">
            <h1 className="text-3xl font-bold tracking-tight font-headline">Patient Chat</h1>
            <p className="text-muted-foreground">Communicate directly with your patients.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <Card className="lg:col-span-1">
                <CardHeader>
                    <CardTitle>Patients</CardTitle>
                    <div className="relative pt-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search patients..." 
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <ScrollArea className="h-[60vh]">
                    <CardContent className="p-0">
                        {isLoadingPatients ? (
                             <div className="p-4 space-y-4">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="flex items-center gap-4">
                                        <Skeleton className="h-10 w-10 rounded-full" />
                                        <div className="space-y-2 flex-grow">
                                            <Skeleton className="h-4 w-3/4" />
                                            <Skeleton className="h-3 w-1/2" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : filteredPatients.length > 0 ? (
                            <div className="space-y-2">
                                {filteredPatients.map(patient => (
                                    <button key={patient.id} onClick={() => { setSelectedPatientId(patient.id); setSuggestedReplies([]); }} className={cn("w-full text-left p-4 hover:bg-muted/50", selectedPatientId === patient.id && "bg-muted")}>
                                        <div className="flex items-center gap-4">
                                            <Avatar className="h-10 w-10 relative">
                                                <AvatarImage src={patient.avatar} alt={patient.name} data-ai-hint="person portrait"/>
                                                <AvatarFallback>{patient.name.charAt(0)}</AvatarFallback>
                                                {patient.online && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />}
                                            </Avatar>
                                            <div className="flex-grow">
                                                <p className="font-semibold">{patient.name}</p>
                                                <p className="text-sm text-muted-foreground truncate">Click to view conversation</p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center p-8 text-muted-foreground">
                                No patient chats found.
                           </div>
                        )}
                    </CardContent>
                </ScrollArea>
            </Card>

            <Card className="lg:col-span-2">
                {selectedPatient && user ? (
                    <>
                        <CardHeader className="flex-row items-center gap-4 space-y-0">
                             <Avatar className="h-12 w-12">
                                <AvatarImage src={selectedPatient.avatar} alt={selectedPatient.name} data-ai-hint="person portrait" />
                                <AvatarFallback>{selectedPatient.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className='flex-1'>
                                <CardTitle>{selectedPatient.name}</CardTitle>
                                <p className="text-sm text-muted-foreground">{selectedPatient.online ? 'Online' : 'Offline'}</p>
                            </div>
                        </CardHeader>
                        <Separator />
                        <ScrollArea className="h-[50vh] p-6" ref={scrollAreaRef}>
                             {isLoadingMessages ? (
                                <div className="flex items-center justify-center h-full">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {messages.map((msg, index) => (
                                        <div key={index} className={cn("flex items-end gap-2", msg.senderId === user.uid ? 'justify-end' : 'justify-start')}>
                                            {msg.senderId !== user.uid && (
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={selectedPatient.avatar} alt={selectedPatient.name} data-ai-hint="person portrait" />
                                                    <AvatarFallback>{selectedPatient.name.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                            )}
                                            <div className={cn("max-w-[70%] rounded-xl p-3", msg.senderId === user.uid ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                                                {msg.text && <p>{msg.text}</p>}
                                                {msg.imageUrl && <Image src={msg.imageUrl} alt="attached image" width={200} height={200} className="rounded-md" />}
                                            </div>
                                            {msg.senderId === user.uid && (
                                                <Avatar className="h-8 w-8">
                                                    <AvatarFallback><User /></AvatarFallback>
                                                </Avatar>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                        <div className="p-4 border-t space-y-2">
                             {(isGeneratingReplies || suggestedReplies.length > 0) && (
                                <div className="p-2 space-y-2">
                                    <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-primary" />
                                        AI Suggested Replies
                                    </h4>
                                     {isGeneratingReplies ? (
                                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Generating...
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {suggestedReplies.map((reply, i) => (
                                                <Button key={i} variant="outline" size="sm" onClick={() => setInputValue(reply)}>
                                                    {reply}
                                                </Button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="relative flex items-center gap-2">
                                <Input 
                                    placeholder="Type your message..." 
                                    className="pr-12" 
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                />
                                <Button size="icon" variant="ghost" onClick={handleGenerateReplies} disabled={isGeneratingReplies}>
                                    <Sparkles className="h-5 w-5" />
                                </Button>
                                <Button size="icon" onClick={handleSendMessage} disabled={!inputValue.trim()}>
                                    <Send className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-[calc(60vh + 120px)] text-muted-foreground p-12 text-center">
                         {isLoadingPatients ? (
                            <>
                                <Loader2 className="h-8 w-8 animate-spin mb-4" />
                                <p>Loading patient chats...</p>
                            </>
                        ) : (
                           <p>Select a patient to start a conversation</p>
                        )}
                    </div>
                )}
            </Card>
        </div>
    </div>
  )
}
