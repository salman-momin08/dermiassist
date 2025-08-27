
"use client"

import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, ShieldCheck, Star, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAnalyses, type AnalysisReport } from '@/hooks/use-analyses';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';

type Doctor = {
    id: string;
    name: string;
    avatar: string;
    verified: boolean;
    specialization: string;
    location: string;
    rating: number;
    reviews: number;
    [key: string]: any;
};


export default function DoctorsPage() {
    const { analyses, isLoading: isLoadingAnalyses } = useAnalyses();
    const { user, userData } = useAuth();
    const { toast } = useToast();
    const [openDialog, setOpenDialog] = useState<string | null>(null);
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [isLoadingDoctors, setIsLoadingDoctors] = useState(true);
    
    // State for the appointment request form
    const [appointmentMode, setAppointmentMode] = useState("Online");
    const [attachedReportId, setAttachedReportId] = useState<string | null>(null);
    const [additionalNotes, setAdditionalNotes] = useState("");
    const [isRequesting, setIsRequesting] = useState(false);


    useEffect(() => {
        const q = query(collection(db, "users"), where("role", "==", "doctor"), where("verified", "==", true));
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const fetchedDoctors: Doctor[] = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                fetchedDoctors.push({
                    id: doc.id,
                    name: data.displayName || "Dr. Anonymous",
                    avatar: data.photoURL || `https://placehold.co/100x100.png?text=${(data.displayName || 'D').charAt(0)}`,
                    verified: data.verified,
                    specialization: data.specialization || "Dermatology",
                    location: data.location || "Not specified",
                    // Mocking rating and reviews as they are not in the DB
                    rating: 4.9, 
                    reviews: 120,
                    ...data
                });
            });
            setDoctors(fetchedDoctors);
            setIsLoadingDoctors(false);
        }, (error) => {
            console.error("Error fetching doctors:", error);
            setIsLoadingDoctors(false);
        });

        return () => unsubscribe();
    }, []);
    
    const resetForm = () => {
        setAppointmentMode("Online");
        setAttachedReportId(null);
        setAdditionalNotes("");
    }

    const handleRequestAppointment = async (doctor: Doctor) => {
        if (!user || !userData) {
            toast({ title: "Authentication Error", description: "You must be logged in to send a request.", variant: "destructive"});
            return;
        }
        setIsRequesting(true);

        try {
            const selectedAnalysis = attachedReportId ? analyses.find(a => a.id === attachedReportId) : null;
            
            await addDoc(collection(db, "appointments"), {
                patientId: user.uid,
                patientName: userData.displayName,
                doctorId: doctor.id,
                doctorName: doctor.name,
                doctorLocation: doctor.location,
                doctorPhone: doctor.phone,
                doctorSignature: doctor.signatureUrl,
                mode: appointmentMode,
                notes: additionalNotes,
                attachedReportId: attachedReportId || null,
                attachedReport: selectedAnalysis ? {
                    condition: selectedAnalysis.condition,
                    date: selectedAnalysis.date,
                    recommendations: selectedAnalysis.recommendations,
                    dos: selectedAnalysis.dos,
                    donts: selectedAnalysis.donts,
                    image: selectedAnalysis.image
                } : null,
                status: 'Pending',
                requestDate: serverTimestamp(),
            });

            toast({
                title: "Request Sent",
                description: `Your appointment request has been sent to ${doctor.name}. You will be notified once it's confirmed.`,
            });
            setOpenDialog(null);
            resetForm();
        } catch (error) {
            console.error("Failed to send appointment request:", error);
            toast({ title: "Request Failed", description: "Could not send your appointment request. Please try again.", variant: "destructive" });
        } finally {
            setIsRequesting(false);
        }
    }
    
    const renderSkeleton = () => (
        <div className="flex flex-col">
            <CardHeader className="items-center text-center">
                <Skeleton className="w-24 h-24 rounded-full mb-4" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
            </CardHeader>
            <CardContent className="flex-grow">
                <Skeleton className="h-10 w-full" />
            </CardContent>
            <CardFooter>
                <Skeleton className="h-10 w-full" />
            </CardFooter>
        </div>
    );

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="flex flex-col items-center justify-center space-y-2 mb-8 text-center">
                <h1 className="text-3xl font-bold tracking-tight font-headline">
                    Find a Certified Doctor
                </h1>
                <p className="text-muted-foreground max-w-2xl">
                    Browse our network of professional dermatologists and book an appointment. Attach your AI report for a more informed consultation.
                </p>
            </div>

            {isLoadingDoctors ? (
                 <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => <Card key={i}>{renderSkeleton()}</Card>)}
                </div>
            ) : doctors.length > 0 ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {doctors.map((doctor) => (
                        <Card key={doctor.id} className="flex flex-col">
                            <CardHeader className="items-center text-center">
                                <Avatar className="w-24 h-24 mb-4">
                                    <AvatarImage src={doctor.avatar} alt={doctor.name} data-ai-hint="doctor portrait" />
                                    <AvatarFallback>{doctor.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <CardTitle className="flex items-center gap-2">
                                    {doctor.name}
                                    {doctor.verified && <ShieldCheck className="h-5 w-5 text-primary" />}
                                </CardTitle>
                                <CardDescription>{doctor.specialization}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <div className="flex justify-between items-center text-sm text-muted-foreground border-t pt-4">
                                    <div className="flex items-center gap-1">
                                        <MapPin className="h-4 w-4" />
                                        {doctor.location}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                                        {doctor.rating} ({doctor.reviews})
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Dialog open={openDialog === doctor.id} onOpenChange={(isOpen) => {setOpenDialog(isOpen ? doctor.id : null); if (!isOpen) resetForm(); }}>
                                    <DialogTrigger asChild>
                                        <Button className="w-full">Request Appointment</Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[480px]">
                                        <DialogHeader>
                                            <DialogTitle>Request Appointment with {doctor.name}</DialogTitle>
                                            <DialogDescription>
                                                Please fill out the details below to request your appointment.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            <div className="space-y-2">
                                                <Label>Appointment Mode</Label>
                                                <RadioGroup value={appointmentMode} onValueChange={setAppointmentMode} className="flex gap-4">
                                                    <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value="Online" id={`online-${doctor.id}`} />
                                                        <Label htmlFor={`online-${doctor.id}`}>Online</Label>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value="Offline" id={`offline-${doctor.id}`} />
                                                        <Label htmlFor={`offline-${doctor.id}`}>Offline</Label>
                                                    </div>
                                                </RadioGroup>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="report">Attach AI Report (Optional)</Label>
                                                <Select value={attachedReportId || ""} onValueChange={(value) => setAttachedReportId(value)}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select a report to attach" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {isLoadingAnalyses ? (
                                                            <SelectItem value="loading" disabled>Loading reports...</SelectItem>
                                                        ) : (
                                                          analyses.map(a => (
                                                              <SelectItem key={a.id} value={a.id}>
                                                                  {a.condition} - {new Date(a.date).toLocaleDateString()}
                                                              </SelectItem>
                                                          ))
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="notes">Additional Notes</Label>
                                                <Textarea id="notes" placeholder="Tell the doctor anything else you'd like them to know." value={additionalNotes} onChange={(e) => setAdditionalNotes(e.target.value)} />
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button type="submit" onClick={() => handleRequestAppointment(doctor)} disabled={isRequesting}>
                                                {isRequesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Send Request
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 text-muted-foreground">
                    <p>No doctors are available at this time. Please check back later.</p>
                </div>
            )}
        </div>
    );
}
