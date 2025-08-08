
"use client"

import { useState } from 'react';
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

const mockPatients = [
  { id: '1', name: 'Liam Johnson', lastMessage: 'Okay, thank you, doctor!', avatar: 'https://placehold.co/40x40.png', online: true },
  { id: '2', name: 'Olivia Smith', lastMessage: 'I will schedule a follow-up.', avatar: 'https://placehold.co/40x40.png', online: false },
  { id: '3', name: 'Noah Williams', lastMessage: 'The new cream is working well.', avatar: 'https://placehold.co/40x40.png', online: true },
  { id: '4', name: 'Emma Brown', lastMessage: 'I have a question about the side effects.', avatar: 'https://placehold.co/40x40.png', online: false },
];

const mockMessages: Record<string, { sender: 'patient' | 'doctor'; text: string }[]> = {
  '1': [
    { sender: 'patient', text: 'Hello Dr. Grant, I wanted to ask about the prescription.' },
    { sender: 'doctor', text: 'Hi Liam, of course. What is your question?' },
    { sender: 'patient', text: 'Should I apply it in the morning or at night?' },
    { sender: 'doctor', text: 'It\'s best to apply it at night, about 30 minutes before you go to sleep.' },
    { sender: 'patient', text: 'Okay, thank you, doctor!' },
  ],
  '2': [
    { sender: 'patient', text: 'Dr. Grant, I\'ve attached my latest report.' },
    { sender: 'doctor', text: 'Thank you, Olivia. I will review it and get back to you shortly.' },
    { sender: 'patient', text: 'I will schedule a follow-up.'}
  ],
   '3': [
    { sender: 'patient', text: 'The new cream is working well.' },
  ],
   '4': [
    { sender: 'patient', text: 'I have a question about the side effects.' },
  ],
};


export default function DoctorChatPage() {
  const [selectedPatientId, setSelectedPatientId] = useState('1');
  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState(mockMessages);
  const [inputValue, setInputValue] = useState("");
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const selectedPatient = mockPatients.find(p => p.id === selectedPatientId);
  const currentMessages = messages[selectedPatientId as keyof typeof messages] || [];

  const filteredPatients = mockPatients.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const newMessage = { sender: 'doctor' as const, text: inputValue };
    const updatedMessages = {
      ...messages,
      [selectedPatientId]: [...currentMessages, newMessage],
    };
    setMessages(updatedMessages);
    setInputValue("");
    setSuggestedReplies([]);
  };

  const handleGenerateReplies = async () => {
    if (!selectedPatient) return;
    setIsGenerating(true);
    setSuggestedReplies([]);
    
    const conversationHistory = currentMessages.map(m => `${m.sender === 'doctor' ? 'Doctor' : selectedPatient.name}: ${m.text}`).join('\n');
    const lastPatientMessage = currentMessages.filter(m => m.sender === 'patient').pop()?.text;

    if (!lastPatientMessage) {
        toast({
            title: "Cannot generate replies",
            description: "There are no messages from the patient to reply to.",
            variant: "destructive"
        });
        setIsGenerating(false);
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
        setIsGenerating(false);
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
                <ScrollArea className="h-[50vh]">
                    <CardContent className="p-0">
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
                                            <p className="text-sm text-muted-foreground truncate">{messages[patient.id]?.slice(-1)[0]?.text || 'No messages yet'}</p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </ScrollArea>
            </Card>

            <Card className="lg:col-span-2">
                {selectedPatient ? (
                    <>
                        <CardHeader className="flex-row items-center gap-4 space-y-0">
                             <Avatar className="h-12 w-12">
                                <AvatarImage src={selectedPatient.avatar} alt={selectedPatient.name} data-ai-hint="person portrait" />
                                <AvatarFallback>{selectedPatient.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <CardTitle>{selectedPatient.name}</CardTitle>
                                <p className="text-sm text-muted-foreground">{selectedPatient.online ? 'Online' : 'Offline'}</p>
                            </div>
                        </CardHeader>
                        <Separator />
                        <ScrollArea className="h-[50vh] p-6">
                            <div className="space-y-6">
                                {currentMessages.map((msg, index) => (
                                    <div key={index} className={cn("flex items-end gap-2", msg.sender === 'doctor' ? 'justify-end' : 'justify-start')}>
                                        {msg.sender === 'patient' && (
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={selectedPatient.avatar} alt={selectedPatient.name} data-ai-hint="person portrait" />
                                                <AvatarFallback>{selectedPatient.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                        )}
                                        <div className={cn("max-w-[70%] rounded-xl p-3", msg.sender === 'doctor' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                                            <p>{msg.text}</p>
                                        </div>
                                        {msg.sender === 'doctor' && (
                                            <Avatar className="h-8 w-8">
                                                <AvatarFallback><User /></AvatarFallback>
                                            </Avatar>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                        <div className="p-4 border-t space-y-2">
                             {(isGenerating || suggestedReplies.length > 0) && (
                                <div className="p-2 space-y-2">
                                    <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-primary" />
                                        AI Suggested Replies
                                    </h4>
                                     {isGenerating ? (
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
                                <Button size="icon" variant="ghost" onClick={handleGenerateReplies} disabled={isGenerating}>
                                    <Sparkles className="h-5 w-5" />
                                </Button>
                                <Button size="icon" onClick={handleSendMessage} disabled={!inputValue.trim()}>
                                    <Send className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-12">
                        <p>Select a patient to start a conversation</p>
                    </div>
                )}
            </Card>
        </div>
    </div>
  )
}
