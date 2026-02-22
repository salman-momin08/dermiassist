"use client"

import { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, ShieldCheck, Star, Loader2, CalendarIcon, Upload, User, Info, MessageSquare, UserPlus, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAnalyses, type AnalysisReport } from '@/hooks/use-analyses';
import { useToast } from '@/hooks/use-toast';
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
import { uploadFile } from '@/lib/actions';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DoctorProfileModal } from '@/components/DoctorProfileModal';

type Doctor = {
    id: string;
    name: string;
    avatar: string;
    verified: boolean;
    specialization: string;
    location: string;
    bio?: string;
    phone?: string;
    signatureUrl?: string;
    education?: Array<{
        degree: string;
        institution: string;
        year: string;
        field?: string;
    }>;
    certificates?: Array<{
        name: string;
        issuer: string;
        year: string;
        url?: string;
    }>;
    years_of_experience?: number;
    languages?: string[];
    consultation_fee?: string;
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
    const [isError, setIsError] = useState(false);
    const [connectionRequests, setConnectionRequests] = useState<any[]>([]);
    const [isConnectingMap, setIsConnectingMap] = useState<Record<string, boolean>>({});
    const router = useRouter();

    // State for the appointment request form
    const [formState, setFormState] = useState<AppointmentFormState>(initialFormState);
    const [isRequesting, setIsRequesting] = useState(false);

    // Refs for file inputs
    const imageUploadRef = useRef<HTMLInputElement>(null);
    const reportUploadRef = useRef<HTMLInputElement>(null);
    const supabase = createClient();


    useEffect(() => {
        setIsLoadingDoctors(true);

        async function fetchData() {
            try {
                // Fetch Doctors using cache
                const { getCachedDoctorList } = await import('@/lib/redis/doctor-cache');
                const data = await getCachedDoctorList({ verified: true });

                if (data && data.length > 0) {
                    const fetchedDoctors: Doctor[] = data.map(item => ({
                        id: item.id,
                        name: item.display_name || "Dr. Anonymous",
                        avatar: item.photo_url || `https://placehold.co/100x100.png?text=${(item.display_name || 'D').charAt(0)}`,
                        verified: item.verified || false,
                        specialization: item.specialization || "Dermatology",
                        location: item.location || "Not specified",
                        bio: item.bio,
                        phone: item.phone,
                        signatureUrl: item.signature_url,
                        education: item.education,
                        certificates: item.certificates,
                        years_of_experience: item.years_of_experience,
                        languages: item.languages,
                        consultation_fee: item.consultation_fee ? String(item.consultation_fee) : undefined,
                    }));
                    setDoctors(fetchedDoctors);
                }

                // Fetch Connection Requests if user is logged in
                if (user) {
                    const { data: reqs, error: reqsError } = await supabase
                        .from('connection_requests')
                        .select('*')
                        .eq('patient_id', user.id);

                    if (reqs) {
                        setConnectionRequests(reqs);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch doctors:", error);
                setIsError(true);
                toast({ title: "Error", description: "Failed to load doctor list. Please try again later.", variant: "destructive" });
            } finally {
                setIsLoadingDoctors(false);
            }
        }

        fetchData();

        const channel = supabase
            .channel('verified-doctors')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'profiles',
                filter: 'role=eq.doctor'
            }, () => {
                fetchData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, toast, user]);

    const handleFormChange = (field: keyof AppointmentFormState, value: any) => {
        setFormState(prev => ({ ...prev, [field]: value }));
    }

    const resetForm = () => {
        setFormState(initialFormState);
        if (imageUploadRef.current) imageUploadRef.current.value = "";
        if (reportUploadRef.current) reportUploadRef.current.value = "";
    }

    const handleConnect = async (doctorId: string) => {
        if (!user) {
            toast({ title: "Authentication Required", description: "Please log in to connect with doctors.", variant: "destructive" });
            return;
        }

        setIsConnectingMap(prev => ({ ...prev, [doctorId]: true }));

        try {
            const response = await fetch('/api/connections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ doctorId, patientId: user.id }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to send request');
            }

            // Optimistic update
            setConnectionRequests(prev => [...prev, { doctor_id: doctorId, patient_id: user.id, status: 'pending' }]);

            toast({ title: "Request Sent", description: "Connection request sent to the doctor." });

        } catch (error: any) {
            console.error("Connection request failed:", error);
            toast({ title: "Error", description: error.message || "Failed to connect", variant: "destructive" });
        } finally {
            setIsConnectingMap(prev => ({ ...prev, [doctorId]: false }));
        }
    };

    const handleRequestAppointment = async (doctor: Doctor) => {
        if (!user || !userData) {
            toast({ title: "Authentication Error", description: "You must be logged in to send a request.", variant: "destructive" });
            return;
        }
        if (!formState.consentData || !formState.agreeTerms) {
            toast({ title: "Consent Required", description: "You must agree to the terms and consent to data sharing.", variant: "destructive" });
            return;
        }
        if (!formState.preferredDate || !formState.preferredTime || !formState.reasonForVisit || !formState.symptomsDuration || !formState.symptomsSeverity) {
            toast({ title: "Required Fields Missing", description: "Please fill out all the required fields marked with an asterisk (*).", variant: "destructive" });
            return;
        }
        setIsRequesting(true);

        try {
            let uploadedImageUrls: string[] = [];
            let uploadedReportUrls: string[] = [];

            // Upload skin condition photos
            if (imageUploadRef.current?.files && imageUploadRef.current.files.length > 0) {
                const imageFiles = Array.from(imageUploadRef.current.files);
                const uploadPromises = imageFiles.map(async file => {
                    const formData = new FormData();
                    formData.append('file', file);
                    const result = await uploadFile(formData);
                    if (result.success && result.url) {
                        return result.url;
                    }
                    throw new Error(result.message || 'Image upload failed.');
                });
                uploadedImageUrls = await Promise.all(uploadPromises);
            }

            // Upload previous reports
            if (reportUploadRef.current?.files && reportUploadRef.current.files.length > 0) {
                const reportFiles = Array.from(reportUploadRef.current.files);
                const uploadPromises = reportFiles.map(async file => {
                    const formData = new FormData();
                    formData.append('file', file);
                    const result = await uploadFile(formData);
                    if (result.success && result.url) {
                        return result.url;
                    }
                    throw new Error(result.message || 'Report upload failed.');
                });
                uploadedReportUrls = await Promise.all(uploadPromises);
            }

            const attachedReport = formState.attachedReportId
                ? analyses.find(a => a.id === formState.attachedReportId)
                : null;

            const { error: insertError } = await supabase
                .from('appointments')
                .insert({
                    patient_id: user.id,
                    patient_name: userData.displayName,
                    doctor_id: doctor.id,
                    doctor_name: doctor.name,
                    doctor_location: doctor.location,
                    doctor_phone: doctor.phone,
                    doctor_signature: doctor.signatureUrl,
                    status: 'Pending',
                    appointment_mode: formState.appointmentMode,
                    preferred_date: formState.preferredDate ? format(formState.preferredDate, 'yyyy-MM-dd') : null,
                    preferred_time: formState.preferredTime,
                    reason_for_visit: formState.reasonForVisit,
                    symptoms_duration: formState.symptomsDuration,
                    symptoms_severity: formState.symptomsSeverity,
                    past_treatments: formState.pastTreatments,
                    current_medications: formState.currentMedications,
                    allergies: formState.allergies,
                    is_emergency: formState.isEmergency,
                    consent_data: formState.consentData,
                    agree_terms: formState.agreeTerms,
                    attached_report_id: formState.attachedReportId || null,
                    attached_report_summary: attachedReport ? { condition: attachedReport.condition, recommendations: attachedReport.recommendations, conditionName: attachedReport.conditionName } : null,
                    uploaded_image_urls: uploadedImageUrls,
                    uploaded_report_urls: uploadedReportUrls,
                });

            if (insertError) throw new Error(insertError.message || insertError.details || 'Failed to save appointment. Please try again.');

            toast({
                title: "Request Submitted",
                description: `Your request has been submitted. Our team will contact you shortly to confirm.`,
            });
            setOpenDialog(null);
            resetForm();
        } catch (error) {
            console.error("Failed to send appointment request:", error);
            const errorMessage = error instanceof Error ? error.message : "Could not send your appointment request. Please try again.";
            toast({ title: "Request Failed", description: errorMessage, variant: "destructive" });
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

    const getConnectionStatus = (doctorId: string) => {
        const req = connectionRequests.find(r => r.doctor_id === doctorId);
        return req ? req.status : null; // 'pending', 'accepted', 'rejected', or null
    }

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="flex flex-col items-center justify-center space-y-2 mb-8 text-center">
                <h1 className="text-3xl font-bold tracking-tight font-headline">
                    Find a Certified Doctor
                </h1>
                <p className="text-muted-foreground max-w-2xl">
                    Browse our network of professional dermatologists and book an appointment.
                    Connect to start a direct chat.
                </p>
            </div>

            {isLoadingDoctors ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => <Card key={i}>{renderSkeleton()}</Card>)}
                </div>
            ) : doctors.length > 0 ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {doctors.map((doctor) => {
                        const connectionStatus = getConnectionStatus(doctor.id);
                        return (
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
                                    <div className="flex justify-center items-center text-sm text-muted-foreground border-t pt-4">
                                        <div className="flex items-center gap-1">
                                            <MapPin className="h-4 w-4" />
                                            {doctor.location}
                                        </div>
                                    </div>
                                    <div className="mt-4 flex gap-2 justify-center">
                                        {connectionStatus === 'accepted' ? (
                                            <Button className="w-full flex gap-2" variant="secondary" onClick={() => router.push('/chat')}>
                                                <MessageSquare className="h-4 w-4" /> Chat
                                            </Button>
                                        ) : connectionStatus === 'pending' ? (
                                            <Button className="w-full flex gap-2" variant="outline" disabled>
                                                <Clock className="h-4 w-4" /> Pending
                                            </Button>
                                        ) : (
                                            <Button
                                                className="w-full flex gap-2"
                                                variant="outline"
                                                onClick={() => handleConnect(doctor.id)}
                                                disabled={isConnectingMap[doctor.id]}
                                            >
                                                {isConnectingMap[doctor.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                                                Connect
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                                <CardFooter className="flex flex-col gap-2">
                                    <DoctorProfileModal
                                        doctor={{
                                            id: doctor.id,
                                            name: doctor.name,
                                            avatar: doctor.avatar,
                                            verified: doctor.verified,
                                            specialization: doctor.specialization,
                                            location: doctor.location,
                                            bio: doctor.bio,
                                            phone: doctor.phone,
                                            education: doctor.education,
                                            certificates: doctor.certificates,
                                            years_of_experience: doctor.years_of_experience,
                                            languages: doctor.languages,
                                            consultation_fee: doctor.consultation_fee,
                                            documents_public: doctor.documents_public,
                                        }}
                                        open={openDialog === `profile-${doctor.id}`}
                                        onOpenChange={(isOpen) => setOpenDialog(isOpen ? `profile-${doctor.id}` : null)}
                                        connectionStatus={connectionStatus}
                                        onConnect={() => handleConnect(doctor.id)}
                                        isConnecting={isConnectingMap[doctor.id] || false}
                                    />
                                    <Button
                                        className="w-full"
                                        variant="ghost"
                                        onClick={() => setOpenDialog(`profile-${doctor.id}`)}
                                    >
                                        <User className="mr-2 h-4 w-4" /> View Profile
                                    </Button>
                                    <Dialog open={openDialog === doctor.id} onOpenChange={(isOpen) => { setOpenDialog(isOpen ? doctor.id : null); if (!isOpen) resetForm(); }}>
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
                                                        <Label>Preferred Date <span className="text-destructive">*</span></Label>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !formState.preferredDate && "text-muted-foreground")}>
                                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                                    {formState.preferredDate ? format(formState.preferredDate, "PPP") : <span>Pick a date</span>}
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-auto p-0">
                                                                <Calendar
                                                                    mode="single"
                                                                    selected={formState.preferredDate}
                                                                    onSelect={(d) => handleFormChange('preferredDate', d)}
                                                                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                                                    initialFocus
                                                                />
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Preferred Time <span className="text-destructive">*</span></Label>
                                                        <Select value={formState.preferredTime} onValueChange={(v) => handleFormChange('preferredTime', v)}>
                                                            <SelectTrigger><SelectValue placeholder="Select a time" /></SelectTrigger>
                                                            <SelectContent>
                                                                {timeSlots.map(time => <SelectItem key={time} value={time}>{time}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label>Appointment Mode <span className="text-destructive">*</span></Label>
                                                    <RadioGroup
                                                        defaultValue={formState.appointmentMode}
                                                        onValueChange={(v) => handleFormChange('appointmentMode', v as 'Online' | 'In-Person')}
                                                        className="flex gap-4"
                                                    >
                                                        <div className="flex items-center space-x-2">
                                                            <RadioGroupItem value="Online" id="mode-online" />
                                                            <Label htmlFor="mode-online" className="font-normal cursor-pointer">Online Consultation</Label>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <RadioGroupItem value="In-Person" id="mode-in-person" />
                                                            <Label htmlFor="mode-in-person" className="font-normal cursor-pointer">In-Person Visit</Label>
                                                        </div>
                                                    </RadioGroup>
                                                </div>

                                                <div className="grid md:grid-cols-3 gap-4">
                                                    <div className="space-y-2 md:col-span-1">
                                                        <Label>Reason for Visit <span className="text-destructive">*</span></Label>
                                                        <Input placeholder="e.g., Acne, rash" value={formState.reasonForVisit} onChange={(e) => handleFormChange('reasonForVisit', e.target.value)} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Duration of Symptoms <span className="text-destructive">*</span></Label>
                                                        <Input placeholder="e.g., 2 weeks" value={formState.symptomsDuration} onChange={(e) => handleFormChange('symptomsDuration', e.target.value)} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Severity of Symptoms <span className="text-destructive">*</span></Label>
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
                                                        <Input type="file" ref={reportUploadRef} accept="image/*,application/pdf" multiple />
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
                                                        <Label htmlFor={`terms-${doctor.id}`} className="text-xs text-muted-foreground">I agree to the DermiAssist-AI privacy policy and terms of service.</Label>
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
                        );
                    })}
                </div>
            ) : isError ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="rounded-full bg-destructive/10 p-4 mb-4">
                        <Info className="h-8 w-8 text-destructive" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Connection Issue</h3>
                    <p className="text-muted-foreground max-w-sm mt-2 mb-6">
                        We couldn't load the doctor list due to a network error. Please check your connection and try again.
                    </p>
                    <Button onClick={() => window.location.reload()} variant="outline">
                        Refresh Page
                    </Button>
                </div>
            ) : (
                <div className="text-center py-16 text-muted-foreground">
                    <p>No doctors are available at this time. Please check back later.</p>
                </div>
            )}
        </div>
    );
}
