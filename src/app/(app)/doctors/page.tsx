
"use client"

import { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, ShieldCheck, Star, Loader2, CalendarIcon, Upload, User, Info } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

type Doctor = {
    id: string;
    name: string;
    avatar: string;
    verified: boolean;
    specialization: string;
    location: string;
    rating: number;
    reviews: number;
    bio?: string;
    [key: string]: any;
};

type AppointmentFormState = {
    preferredDate?: Date;
    preferredTime: string;
    appointmentType: string;
    appointmentMode: string;
    reasonForVisit: string;
    symptomsDuration: string;
    symptomsSeverity: string;
    pastTreatments: string;
    currentMedications: string;
    allergies: string;
    isEmergency: boolean;
    consentData: boolean;
    agreeTerms: boolean;
    attachedReportId: string;
};

const initialFormState: AppointmentFormState = {
    preferredDate: undefined,
    preferredTime: '',
    appointmentType: 'first-time',
    appointmentMode: 'Online',
    reasonForVisit: '',
    symptomsDuration: '',
    symptomsSeverity: '',
    pastTreatments: '',
    currentMedications: '',
    allergies: '',
    isEmergency: false,
    consentData: false,
    agreeTerms: false,
    attachedReportId: '',
};

const timeSlots = [
    '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
    '01:00 PM', '01:30 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM'
];


export default function DoctorsPage() {
    const { user, userData } = useAuth();
    const { toast } = useToast();
    const { analyses } = useAnalyses();
    const [openDialog, setOpenDialog] = useState<string | null>(null);
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [isLoadingDoctors, setIsLoadingDoctors] = useState(true);
    
    // State for the appointment request form
    const [formState, setFormState] = useState<AppointmentFormState>(initialFormState);
    const [isRequesting, setIsRequesting] = useState(false);

    // Refs for file inputs
    const imageUploadRef = useRef<HTMLInputElement>(null);
    const reportUploadRef = useRef<HTMLInputElement>(null);


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
                    bio: data.bio,
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

    const handleFormChange = (field: keyof AppointmentFormState, value: any) => {
        setFormState(prev => ({...prev, [field]: value}));
    }
    
    const resetForm = () => {
        setFormState(initialFormState);
        if(imageUploadRef.current) imageUploadRef.current.value = "";
        if(reportUploadRef.current) reportUploadRef.current.value = "";
    }

    const handleRequestAppointment = async (doctor: Doctor) => {
        if (!user || !userData) {
            toast({ title: "Authentication Error", description: "You must be logged in to send a request.", variant: "destructive"});
            return;
        }
        if (!formState.consentData || !formState.agreeTerms) {
            toast({ title: "Consent Required", description: "You must agree to the terms and consent to data sharing.", variant: "destructive"});
            return;
        }
        setIsRequesting(true);

        const attachedReport = formState.attachedReportId 
            ? analyses.find(a => a.id === formState.attachedReportId) 
            : null;

        try {
            await addDoc(collection(db, "appointments"), {
                patientId: user.uid,
                patientName: userData.displayName,
                doctorId: doctor.id,
                doctorName: doctor.name,
                doctorLocation: doctor.location,
                doctorPhone: doctor.phone,
                doctorSignature: doctor.signatureUrl,
                status: 'Pending',
                requestDate: serverTimestamp(),
                ...formState,
                preferredDate: formState.preferredDate ? formState.preferredDate.toISOString() : null,
                attachedReport: attachedReport ? { condition: attachedReport.condition, recommendations: attachedReport.recommendations, conditionName: attachedReport.conditionName } : null,
            });

            toast({
                title: "Request Submitted",
                description: `Your request has been submitted. Our team will contact you shortly to confirm.`,
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
                            <CardFooter className="flex flex-col gap-2">
                                 <Dialog>
                                    <DialogTrigger asChild>
                                        <Button className="w-full" variant="outline">
                                            <User className="mr-2" /> View Profile
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-lg">
                                        <DialogHeader className="items-center text-center">
                                            <Avatar className="w-24 h-24 mb-4">
                                                <AvatarImage src={doctor.avatar} alt={doctor.name} data-ai-hint="doctor portrait" />
                                                <AvatarFallback>{doctor.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <DialogTitle className="flex items-center gap-2 text-2xl">
                                                {doctor.name}
                                                {doctor.verified && <ShieldCheck className="h-6 w-6 text-primary" />}
                                            </DialogTitle>
                                            <DialogDescription>{doctor.specialization}</DialogDescription>
                                        </DialogHeader>
                                        <div className="py-4 space-y-4">
                                            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                                                <div className="flex items-center gap-1">
                                                    <MapPin className="h-4 w-4" />
                                                    {doctor.location}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                                                    {doctor.rating} ({doctor.reviews} reviews)
                                                </div>
                                            </div>
                                            <Separator />
                                            <div>
                                                <h4 className="font-semibold mb-2">Professional Bio</h4>
                                                <p className="text-sm text-muted-foreground">{doctor.bio || "No biography provided."}</p>
                                            </div>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                                <Dialog open={openDialog === doctor.id} onOpenChange={(isOpen) => {setOpenDialog(isOpen ? doctor.id : null); if (!isOpen) resetForm(); }}>
                                    <DialogTrigger asChild>
                                        <Button className="w-full">Request Appointment</Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-2xl">
                                        <DialogHeader>
                                            <DialogTitle>Appointment with {doctor.name}</DialogTitle>
                                            <DialogDescription>
                                               Please provide the following details for your appointment.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto px-1">
                                            
                                            <div className="grid md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Preferred Date</Label>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !formState.preferredDate && "text-muted-foreground")}>
                                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                                {formState.preferredDate ? format(formState.preferredDate, "PPP") : <span>Pick a date</span>}
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0">
                                                            <Calendar mode="single" selected={formState.preferredDate} onSelect={(d) => handleFormChange('preferredDate', d)} initialFocus />
                                                        </PopoverContent>
                                                    </Popover>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Preferred Time</Label>
                                                    <Select value={formState.preferredTime} onValueChange={(v) => handleFormChange('preferredTime', v)}>
                                                        <SelectTrigger><SelectValue placeholder="Select a time" /></SelectTrigger>
                                                        <SelectContent>
                                                            {timeSlots.map(time => <SelectItem key={time} value={time}>{time}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            <div className="grid md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Type of Appointment</Label>
                                                    <RadioGroup value={formState.appointmentType} onValueChange={(v) => handleFormChange('appointmentType', v)} className="flex gap-4 pt-2">
                                                        <div className="flex items-center space-x-2"><RadioGroupItem value="first-time" id={`first-time-${doctor.id}`} /><Label htmlFor={`first-time-${doctor.id}`}>First-time</Label></div>
                                                        <div className="flex items-center space-x-2"><RadioGroupItem value="follow-up" id={`follow-up-${doctor.id}`} /><Label htmlFor={`follow-up-${doctor.id}`}>Follow-up</Label></div>
                                                    </RadioGroup>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Mode of Appointment</Label>
                                                    <RadioGroup value={formState.appointmentMode} onValueChange={(v) => handleFormChange('appointmentMode', v)} className="flex gap-4 pt-2">
                                                        <div className="flex items-center space-x-2"><RadioGroupItem value="Online" id={`online-${doctor.id}`} /><Label htmlFor={`online-${doctor.id}`}>Online</Label></div>
                                                        <div className="flex items-center space-x-2"><RadioGroupItem value="Offline" id={`offline-${doctor.id}`} /><Label htmlFor={`offline-${doctor.id}`}>Offline</Label></div>
                                                    </RadioGroup>
                                                </div>
                                            </div>

                                            <div className="grid md:grid-cols-3 gap-4">
                                                <div className="space-y-2 md:col-span-1">
                                                    <Label>Reason for Visit</Label>
                                                    <Input placeholder="e.g., Acne, rash" value={formState.reasonForVisit} onChange={(e) => handleFormChange('reasonForVisit', e.target.value)} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Duration of Symptoms</Label>
                                                    <Input placeholder="e.g., 2 weeks" value={formState.symptomsDuration} onChange={(e) => handleFormChange('symptomsDuration', e.target.value)} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Severity of Symptoms</Label>
                                                    <Select value={formState.symptomsSeverity} onValueChange={(v) => handleFormChange('symptomsSeverity', v)}>
                                                        <SelectTrigger><SelectValue placeholder="Select severity" /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Mild">Mild</SelectItem>
                                                            <SelectItem value="Moderate">Moderate</SelectItem>
                                                            <SelectItem value="Severe">Severe</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-2">
                                                <Label>Attach AI Report (optional)</Label>
                                                <Select value={formState.attachedReportId} onValueChange={(v) => handleFormChange('attachedReportId', v)}>
                                                    <SelectTrigger><SelectValue placeholder="Select a past analysis report" /></SelectTrigger>
                                                    <SelectContent>
                                                        {analyses.map(analysis => (
                                                            <SelectItem key={analysis.id} value={analysis.id}>
                                                                {`${analysis.conditionName} - ${format(new Date(analysis.date), "MMM d, yyyy")}`}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                             <div className="space-y-2">
                                                <Label>Past Dermatology Treatments</Label>
                                                <Textarea placeholder="List any past treatments you have tried." value={formState.pastTreatments} onChange={(e) => handleFormChange('pastTreatments', e.target.value)} />
                                            </div>

                                             <div className="grid md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Current Medications</Label>
                                                    <Textarea placeholder="List any medications you are currently taking." value={formState.currentMedications} onChange={(e) => handleFormChange('currentMedications', e.target.value)} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Allergies</Label>
                                                    <Textarea placeholder="List any known allergies (drug, food, skin-related)." value={formState.allergies} onChange={(e) => handleFormChange('allergies', e.target.value)} />
                                                </div>
                                            </div>

                                            <div className="grid md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Upload Skin Condition Photos</Label>
                                                    <Input type="file" ref={imageUploadRef} accept="image/*" multiple />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Upload Previous Reports</Label>
                                                    <Input type="file" ref={reportUploadRef} accept="image/*,application/pdf" />
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between rounded-lg border p-4">
                                                <div className="space-y-0.5">
                                                    <Label>Is this an Emergency?</Label>
                                                    <p className="text-xs text-muted-foreground">Check if you believe this is an urgent case.</p>
                                                </div>
                                                <Switch checked={formState.isEmergency} onCheckedChange={(c) => handleFormChange('isEmergency', c)} />
                                            </div>
                                            
                                            <div className="space-y-4">
                                                <div className="flex items-start space-x-3">
                                                    <Checkbox id={`consent-${doctor.id}`} checked={formState.consentData} onCheckedChange={(c) => handleFormChange('consentData', !!c)} />
                                                    <Label htmlFor={`consent-${doctor.id}`} className="text-xs text-muted-foreground">I consent to share my medical data for consultation purposes.</Label>
                                                </div>
                                                 <div className="flex items-start space-x-3">
                                                    <Checkbox id={`terms-${doctor.id}`} checked={formState.agreeTerms} onCheckedChange={(c) => handleFormChange('agreeTerms', !!c)} />
                                                    <Label htmlFor={`terms-${doctor.id}`} className="text-xs text-muted-foreground">I agree to the SkinWise privacy policy and terms of service.</Label>
                                                </div>
                                            </div>

                                        </div>
                                        <DialogFooter className="pt-4 border-t">
                                             <Button variant="outline" onClick={resetForm}>Reset</Button>
                                            <Button type="submit" onClick={() => handleRequestAppointment(doctor)} disabled={isRequesting || !formState.consentData || !formState.agreeTerms}>
                                                {isRequesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Book Appointment
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
