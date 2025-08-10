
"use client"

import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Send, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

const mockDoctors = [
  { id: '1', name: 'Dr. Alan Grant', lastMessage: 'It\'s best to apply it at night...', avatar: 'https://placehold.co/40x40.png', online: true },
  { id: '2', name: 'Dr. Emily Carter', lastMessage: 'Thank you for the report.', avatar: 'https://placehold.co/40x40.png', online: false },
  { id: '3', name: 'Dr. Ben Adams', lastMessage: 'Let\'s schedule a follow-up call.', avatar: 'https://placehold.co/40x40.png', online: true },
];

const mockMessages: Record<string, { sender: 'patient' | 'doctor'; text: string }[]> = {
  '1': [
    { sender: 'patient', text: 'Hello Dr. Grant, I wanted to ask about the prescription.' },
    { sender: 'doctor', text: 'Hi Liam, of course. What is your question?' },
    { sender: 'patient', text: 'Should I apply it in the morning or at night?' },
    { sender: 'doctor', text: 'It\'s best to apply it at night, about 30 minutes before you go to sleep.' },
  ],
  '2': [
    { sender: 'patient', text: 'Hello Dr. Carter, I\'ve attached my latest report.' },
    { sender: 'doctor', text: 'Thank you for the report.' },
  ],
   '3': [
    { sender: 'doctor', text: 'Let\'s schedule a follow-up call.' },
  ],
};


export default function ChatPage() {
  const [selectedDoctorId, setSelectedDoctorId] = useState('1');
  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState(mockMessages);
  const [inputValue, setInputValue] = useState("");

  const selectedDoctor = mockDoctors.find(p => p.id === selectedDoctorId);
  const currentMessages = messages[selectedDoctorId as keyof typeof messages] || [];

  const filteredDoctors = mockDoctors.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const newMessage = { sender: 'patient' as const, text: inputValue };
    const updatedMessages = {
      ...messages,
      [selectedDoctorId]: [...currentMessages, newMessage],
    };
    setMessages(updatedMessages);
    setInputValue("");
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
        <div className="space-y-2 mb-8">
            <h1 className="text-3xl font-bold tracking-tight font-headline">Chat with Your Doctor</h1>
            <p className="text-muted-foreground">Communicate directly and securely with your healthcare providers.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <Card className="lg:col-span-1">
                <CardHeader>
                    <CardTitle>Your Doctors</CardTitle>
                    <div className="relative pt-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search doctors..." 
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <ScrollArea className="h-[50vh]">
                    <CardContent className="p-0">
                        <div className="space-y-2">
                            {filteredDoctors.map(doctor => (
                                <button key={doctor.id} onClick={() => setSelectedDoctorId(doctor.id)} className={cn("w-full text-left p-4 hover:bg-muted/50", selectedDoctorId === doctor.id && "bg-muted")}>
                                    <div className="flex items-center gap-4">
                                        <Avatar className="h-10 w-10 relative">
                                            <AvatarImage src={doctor.avatar} alt={doctor.name} data-ai-hint="doctor portrait"/>
                                            <AvatarFallback>{doctor.name.charAt(0)}</AvatarFallback>
                                            {doctor.online && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />}
                                        </Avatar>
                                        <div className="flex-grow">
                                            <p className="font-semibold">{doctor.name}</p>
                                            <p className="text-sm text-muted-foreground truncate">{messages[doctor.id]?.slice(-1)[0]?.text || 'No messages yet'}</p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </ScrollArea>
            </Card>

            <Card className="lg:col-span-2">
                {selectedDoctor ? (
                    <>
                        <CardHeader className="flex-row items-center gap-4 space-y-0">
                             <Avatar className="h-12 w-12">
                                <AvatarImage src={selectedDoctor.avatar} alt={selectedDoctor.name} data-ai-hint="doctor portrait" />
                                <AvatarFallback>{selectedDoctor.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className='flex-1'>
                                <CardTitle>{selectedDoctor.name}</CardTitle>
                                <p className="text-sm text-muted-foreground">{selectedDoctor.online ? 'Online' : 'Offline'}</p>
                            </div>
                        </CardHeader>
                        <Separator />
                        <ScrollArea className="h-[50vh] p-6">
                            <div className="space-y-6">
                                {currentMessages.map((msg, index) => (
                                    <div key={index} className={cn("flex items-end gap-2", msg.sender === 'patient' ? 'justify-end' : 'justify-start')}>
                                        {msg.sender === 'doctor' && (
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={selectedDoctor.avatar} alt={selectedDoctor.name} data-ai-hint="doctor portrait" />
                                                <AvatarFallback>{selectedDoctor.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                        )}
                                        <div className={cn("max-w-[70%] rounded-xl p-3", msg.sender === 'patient' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                                            <p>{msg.text}</p>
                                        </div>
                                        {msg.sender === 'patient' && (
                                            <Avatar className="h-8 w-8">
                                                <AvatarFallback><User /></AvatarFallback>
                                            </Avatar>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                        <div className="p-4 border-t">
                            <div className="relative flex items-center gap-2">
                                <Input 
                                    placeholder="Type your message..." 
                                    className="pr-12" 
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                />
                                <Button size="icon" onClick={handleSendMessage} disabled={!inputValue.trim()}>
                                    <Send className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-12">
                        <p>Select a doctor to start a conversation</p>
                    </div>
                )}
            </Card>
        </div>
    </div>
  )
}
