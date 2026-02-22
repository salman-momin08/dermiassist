/**
 * Enhanced Doctor Profile Modal Component
 * 
 * Displays comprehensive doctor information including education,
 * certificates, and professional details.
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import {
    MapPin,
    ShieldCheck,
    GraduationCap,
    Award,
    MessageSquare,
    Star,
    Clock,
    Languages,
    DollarSign,
    FileText,
    UserPlus,
    Loader2,
    ExternalLink,
    ThumbsUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EducationEntry {
    degree: string;
    institution: string;
    year: string;
    field?: string;
}

export interface CertificateEntry {
    name: string;
    issuer: string;
    year: string;
    url?: string;
}

export interface Review {
    id: string;
    rating: number;
    kudos: string;
    created_at: string;
    patient_name?: string; // We might need to join this or just show 'Patient'
}

export interface DoctorProfileData {
    id: string;
    name: string;
    avatar: string;
    verified: boolean;
    specialization: string;
    location: string;
    bio?: string;
    phone?: string;
    education?: EducationEntry[];
    certificates?: CertificateEntry[];
    consultation_fee?: string;
    years_of_experience?: number;
    languages?: string[];
    documents_public?: boolean;
}

interface DoctorProfileModalProps {
    doctor: DoctorProfileData;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    connectionStatus: 'pending' | 'accepted' | null;
    onConnect: () => void;
    isConnecting: boolean;
}

export function DoctorProfileModal({
    doctor,
    open,
    onOpenChange,
    connectionStatus,
    onConnect,
    isConnecting
}: DoctorProfileModalProps) {
    const [activeTab, setActiveTab] = useState('overview');
    const [reviews, setReviews] = useState<Review[]>([]);
    const [isLoadingReviews, setIsLoadingReviews] = useState(false);
    const [showReviewForm, setShowReviewForm] = useState(false);
    const [newReview, setNewReview] = useState({ rating: 5, kudos: '', feedback: '' });
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const [verificationDocs, setVerificationDocs] = useState<Record<string, string>>({});
    const [isLoadingDocs, setIsLoadingDocs] = useState(false);
    const { toast } = useToast();

    const hasEducation = doctor.education && doctor.education.length > 0;
    const hasCertificates = doctor.certificates && doctor.certificates.length > 0;

    useEffect(() => {
        if (open && doctor.id) {
            fetchReviews();
            if (doctor.documents_public) {
                fetchVerificationDocs();
            }
        }
    }, [open, doctor.id, doctor.documents_public]);

    const fetchVerificationDocs = async () => {
        setIsLoadingDocs(true);
        const supabase = createClient();
        const { data, error } = await supabase
            .from('contact_requests')
            .select('data')
            .eq('user_id', doctor.id)
            .eq('request_type', 'role-change')
            .eq('status', 'approved')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (!error && data?.data?.documents) {
            const docs: Record<string, string> = {};
            Object.entries(data.data.documents).forEach(([key, value]) => {
                if (key === 'submitted_at') return;
                let url: string | null = null;
                if (typeof value === 'string') url = value;
                else if (value && typeof value === 'object' && 'url' in value) url = (value as any).url;

                if (url) docs[key] = url;
            });
            setVerificationDocs(docs);
        }
        setIsLoadingDocs(false);
    };

    const fetchReviews = async () => {
        setIsLoadingReviews(true);
        const supabase = createClient();
        const { data, error } = await supabase
            .from('doctor_reviews')
            .select('id, rating, kudos, created_at')
            .eq('doctor_id', doctor.id)
            .eq('is_public', true)
            .order('created_at', { ascending: false });

        if (!error && data) {
            setReviews(data as Review[]);
        }
        setIsLoadingReviews(false);
    };

    const handleSubmitReview = async () => {
        if (!newReview.kudos.trim()) {
            toast({ title: "Review required", description: "Please tell us what you think!", variant: "destructive" });
            return;
        }

        setIsSubmittingReview(true);
        const supabase = createClient();

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            toast({ title: "Authentication required", description: "Please sign in to leave a review.", variant: "destructive" });
            setIsSubmittingReview(false);
            return;
        }

        try {
            const { error } = await supabase.from('doctor_reviews').insert({
                doctor_id: doctor.id,
                patient_id: user.id,
                rating: newReview.rating,
                kudos: newReview.kudos,
                feedback: newReview.feedback,
                is_public: true
            });

            if (error) throw error;

            toast({ title: "Review Submitted", description: "Thank you for your feedback!" });
            setNewReview({ rating: 5, kudos: '', feedback: '' });
            setShowReviewForm(false);
            fetchReviews(); // Refresh list
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Failed to submit review.", variant: "destructive" });
        } finally {
            setIsSubmittingReview(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                {/* Header Section */}
                <DialogHeader className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                        <Avatar className="w-24 h-24 border-4 border-primary/10">
                            <AvatarImage src={doctor.avatar} alt={doctor.name} />
                            <AvatarFallback className="text-2xl">{doctor.name.charAt(0)}</AvatarFallback>
                        </Avatar>

                        <div className="flex-1 text-center sm:text-left space-y-2">
                            <DialogTitle className="flex items-center justify-center sm:justify-start gap-2 text-2xl">
                                {doctor.name}
                                {doctor.verified && <ShieldCheck className="h-6 w-6 text-primary" />}
                            </DialogTitle>
                            <DialogDescription className="text-base">
                                {doctor.specialization}
                            </DialogDescription>

                            {/* Quick Stats */}
                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-2">
                                <Badge variant="secondary" className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {doctor.location}
                                </Badge>

                                {doctor.years_of_experience && (
                                    <Badge variant="secondary" className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {doctor.years_of_experience} years exp.
                                    </Badge>
                                )}

                                {doctor.languages && doctor.languages.length > 0 && (
                                    <Badge variant="secondary" className="flex items-center gap-1">
                                        <Languages className="h-3 w-3" />
                                        {doctor.languages.join(', ')}
                                    </Badge>
                                )}

                                {doctor.consultation_fee && (
                                    <Badge variant="secondary" className="flex items-center gap-1">
                                        <DollarSign className="h-3 w-3" />
                                        {doctor.consultation_fee}
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                <Separator />

                {/* Tabbed Content */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="education">Education</TabsTrigger>
                        <TabsTrigger value="certificates">Certificates</TabsTrigger>
                        <TabsTrigger value="reviews">Reviews</TabsTrigger>
                    </TabsList>

                    {/* Overview Tab */}
                    <TabsContent value="overview" className="space-y-4 mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="h-5 w-5" />
                                    Professional Bio
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground leading-relaxed">
                                    {doctor.bio || "No biography provided."}
                                </p>
                            </CardContent>
                        </Card>

                        {/* Summary Cards */}
                        <div className="grid sm:grid-cols-2 gap-4">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                                        <GraduationCap className="h-4 w-4" />
                                        Education
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{hasEducation ? doctor.education!.length : 0}</div>
                                    <p className="text-xs text-muted-foreground">Degrees & Qualifications</p>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                                        <Award className="h-4 w-4" />
                                        Certifications
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{hasCertificates ? doctor.certificates!.length : 0}</div>
                                    <p className="text-xs text-muted-foreground">Professional Certificates</p>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* Education Tab */}
                    <TabsContent value="education" className="space-y-4 mt-4">
                        {hasEducation ? (
                            doctor.education!.map((edu, index) => (
                                <Card key={index}>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <GraduationCap className="h-5 w-5 text-primary" />
                                            {edu.degree}
                                        </CardTitle>
                                        <CardDescription>{edu.institution}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        {edu.field && (
                                            <p className="text-sm">
                                                <span className="font-medium">Field:</span> {edu.field}
                                            </p>
                                        )}
                                        <p className="text-sm text-muted-foreground">
                                            <span className="font-medium">Year:</span> {edu.year}
                                        </p>
                                    </CardContent>
                                </Card>
                            ))
                        ) : (
                            <Card>
                                <CardContent className="py-8 text-center text-muted-foreground">
                                    No education information available.
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    {/* Certificates Tab */}
                    <TabsContent value="certificates" className="space-y-4 mt-4">
                        {/* Manually added certificates */}
                        {hasCertificates && (
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Professional Certifications</h3>
                                {doctor.certificates!.map((cert, index) => (
                                    <Card key={index}>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <Award className="h-5 w-5 text-primary" />
                                                {cert.name}
                                            </CardTitle>
                                            <CardDescription>{cert.issuer}</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-2">
                                            <p className="text-sm text-muted-foreground">
                                                <span className="font-medium">Year:</span> {cert.year}
                                            </p>
                                            {cert.url && cert.url.startsWith('http') && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="mt-2"
                                                    onClick={() => window.open(cert.url, '_blank')}
                                                >
                                                    <ExternalLink className="h-4 w-4 mr-2" />
                                                    View Document
                                                </Button>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}

                        {/* Public Verification Documents */}
                        {doctor.documents_public && Object.keys(verificationDocs).length > 0 && (
                            <div className="space-y-4 pt-4">
                                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Verified Credentials</h3>
                                <div className="grid sm:grid-cols-2 gap-4">
                                    {Object.entries(verificationDocs).map(([key, url]) => (
                                        <Card key={key} className="bg-primary/5 border-primary/20">
                                            <CardHeader className="p-4">
                                                <CardTitle className="text-sm flex items-center gap-2">
                                                    <ShieldCheck className="h-4 w-4 text-primary" />
                                                    <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                                                </CardTitle>
                                            </CardHeader>
                                            <CardFooter className="p-4 pt-0">
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    className="w-full text-xs"
                                                    onClick={() => window.open(url, '_blank')}
                                                >
                                                    <ExternalLink className="h-3 w-3 mr-2" />
                                                    View Verified File
                                                </Button>
                                            </CardFooter>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!hasCertificates && (!doctor.documents_public || Object.keys(verificationDocs).length === 0) && (
                            <Card>
                                <CardContent className="py-8 text-center text-muted-foreground">
                                    No certificates or verified documents available.
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    {/* Reviews Tab */}
                    <TabsContent value="reviews" className="space-y-4 mt-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold">Patient Reviews</h3>
                            <Button onClick={() => setShowReviewForm(!showReviewForm)} variant="outline">
                                {showReviewForm ? "Cancel Review" : "Write a Review"}
                            </Button>
                        </div>

                        {showReviewForm && (
                            <Card className="bg-muted/50">
                                <CardHeader>
                                    <CardTitle className="text-base">Share your experience</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Rating</Label>
                                        <div className="flex gap-2">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <button
                                                    key={star}
                                                    type="button"
                                                    onClick={() => setNewReview({ ...newReview, rating: star })}
                                                    className="focus:outline-none transition-transform hover:scale-110"
                                                >
                                                    <Star
                                                        className={cn(
                                                            "h-6 w-6",
                                                            star <= newReview.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
                                                        )}
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="kudos">Public Review (Kudos)</Label>
                                        <Textarea
                                            id="kudos"
                                            placeholder="What did you like about this doctor?"
                                            value={newReview.kudos}
                                            onChange={(e) => setNewReview({ ...newReview, kudos: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="feedback">Private Feedback (Optional)</Label>
                                        <Textarea
                                            id="feedback"
                                            placeholder="Any private feedback for the doctor?"
                                            value={newReview.feedback}
                                            onChange={(e) => setNewReview({ ...newReview, feedback: e.target.value })}
                                        />
                                        <p className="text-xs text-muted-foreground">Only the doctor sees this part.</p>
                                    </div>
                                    <Button onClick={handleSubmitReview} disabled={isSubmittingReview}>
                                        {isSubmittingReview && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Submit Review
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        {isLoadingReviews ? (
                            <div className="flex justify-center p-8">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : reviews.length > 0 ? (
                            reviews.map((review) => (
                                <Card key={review.id}>
                                    <CardHeader className="pb-2">
                                        <div className="flex items-start justify-between">
                                            <div className="flex gap-1">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star
                                                        key={i}
                                                        className={cn(
                                                            "h-4 w-4",
                                                            i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
                                                        )}
                                                    />
                                                ))}
                                            </div>
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(review.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm italic">"{review.kudos}"</p>
                                    </CardContent>
                                </Card>
                            ))
                        ) : (
                            <Card>
                                <CardContent className="py-8 text-center text-muted-foreground">
                                    No reviews yet. Be the first to leave one!
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>
                </Tabs>

                {/* Footer with Connect Button */}
                <Separator />
                <div className="flex justify-end gap-2 pt-2">
                    {connectionStatus === 'accepted' ? (
                        <Button variant="secondary" disabled>
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Connected
                        </Button>
                    ) : connectionStatus === 'pending' ? (
                        <Button variant="outline" disabled>
                            <Clock className="h-4 w-4 mr-2" />
                            Request Pending
                        </Button>
                    ) : (
                        <Button onClick={onConnect} disabled={isConnecting}>
                            {isConnecting ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <UserPlus className="h-4 w-4 mr-2" />
                            )}
                            Connect with Doctor
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
