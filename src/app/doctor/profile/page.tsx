"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, AlertTriangle, Upload, XCircle, ShieldCheck, ShieldAlert, Loader2, BadgeHelp } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import Image from "next/image";
import { uploadFile, deleteFile } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import { invalidateUserProfileCache } from "@/lib/redis/user-cache";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ProfessionalInfoForm, type EducationEntry, type CertificateEntry } from "@/components/ProfessionalInfoForm";


type VerificationStatus = 'Verified' | 'Pending' | 'Not Verified';

// Combined state for the entire form to make it easier to manage
type ProfileFormState = {
    displayName: string;
    specialization: string;
    bio: string;
    location: string;
    phone: string;
    photoURL: string | null;
    photoPublicId: string | null;
    newImageFile: File | null;
    signatureUrl: string | null;
    signaturePublicId: string | null;
    newSignatureFile: File | null;
    yearsOfExperience: number;
    languages: string[];
    consultationFee: string;
    education: EducationEntry[];
    certificates: CertificateEntry[];
    documentsPublic: boolean;
};

export default function DoctorProfilePage() {
    const { user, userData, loading, forceReload } = useAuth();
    const { toast } = useToast();

    // Single state object for profile form
    const [formState, setFormState] = useState<ProfileFormState>({
        displayName: "",
        specialization: "General Dermatology",
        bio: "",
        location: "",
        phone: "",
        photoURL: null,
        photoPublicId: null,
        newImageFile: null,
        signatureUrl: null,
        signaturePublicId: null,
        newSignatureFile: null,
        yearsOfExperience: 0,
        languages: [],
        consultationFee: "",
        education: [],
        certificates: [],
        documentsPublic: false,
    });

    // State for verification documents
    const [verificationDocuments, setVerificationDocuments] = useState<any>(null);
    const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);

    // State for verification section
    const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('Not Verified');

    // State for account settings
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [deleteConfirmName, setDeleteConfirmName] = useState('');
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    // Loading states
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [isSubmittingVerification, setIsSubmittingVerification] = useState(false);
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

    const photoInputRef = useRef<HTMLInputElement>(null);
    const signatureInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (userData) {
            setFormState({
                displayName: userData.display_name || '',
                specialization: userData.specialization || 'General Dermatology',
                bio: userData.bio || '',
                location: userData.location || '',
                phone: userData.phone || '',
                photoURL: userData.photo_url || null,
                photoPublicId: userData.photo_public_id || null,
                newImageFile: null,
                signatureUrl: userData.signature_url || null,
                signaturePublicId: userData.signature_public_id || null,
                newSignatureFile: null,
                yearsOfExperience: userData.years_of_experience || 0,
                languages: userData.languages || [],
                consultationFee: userData.consultation_fee || '',
                education: userData.education || [],
                certificates: userData.certificates || [],
                documentsPublic: userData.documents_public ?? false,
            });

            if (userData.verified) {
                setVerificationStatus('Verified');
            } else {
                setVerificationStatus('Not Verified');
            }
        }
    }, [userData]);

    // Fetch verification documents
    useEffect(() => {
        if (!user) return;

        const fetchDocuments = async () => {
            setIsLoadingDocuments(true);
            const supabase = createClient();

            const { data, error } = await supabase
                .from('contact_requests')
                .select('data')
                .eq('user_id', user.id)
                .eq('request_type', 'role-change')
                .eq('status', 'approved')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (!error && data?.data?.documents) {
                // Validate and extract URLs (documents can be stored as strings or objects with url property)
                const validDocuments: Record<string, string> = {};
                Object.entries(data.data.documents).forEach(([key, value]) => {
                    // Skip the submitted_at timestamp
                    if (key === 'submitted_at') return;

                    // Extract URL from either string or object format
                    let url: string | null = null;
                    if (typeof value === 'string') {
                        url = value;
                    } else if (value && typeof value === 'object' && 'url' in value) {
                        url = (value as any).url;
                    }

                    // Validate URL format
                    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
                        validDocuments[key] = url;
                    }
                });
                setVerificationDocuments(validDocuments);
            }
            setIsLoadingDocuments(false);
        };

        fetchDocuments();
    }, [user]);

    const handleProfileInputChange = (field: keyof ProfileFormState, value: any) => {
        setFormState(prev => ({ ...prev, [field]: value }));
    };

    const handleSignatureFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            // Store the file object and the preview URL
            handleProfileInputChange('newSignatureFile', file);
            handleProfileInputChange('signatureUrl', reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleDocumentsPublicChange = async (checked: boolean) => {
        if (!user) return;

        // Update local state immediately for responsive UI
        handleProfileInputChange('documentsPublic', checked);

        try {
            const supabase = createClient();
            const { error } = await supabase
                .from('profiles')
                .update({ documents_public: checked })
                .eq('id', user.id);

            if (error) throw error;

            toast({
                title: "Privacy Updated",
                description: checked
                    ? "Your documents are now visible to patients"
                    : "Your documents are now private",
            });
        } catch (error: any) {
            // Revert on error
            handleProfileInputChange('documentsPublic', !checked);
            toast({
                title: "Update Failed",
                description: "Could not update document privacy setting",
                variant: "destructive"
            });
        }
    };



    const handleProfileSave = async () => {
        if (!user) return;
        const supabase = createClient();
        setIsSavingProfile(true);

        const dataToSave = { ...formState };
        const oldSignaturePublicId = userData?.signature_public_id;

        try {
            // 1. Handle signature upload
            if (dataToSave.newSignatureFile) {
                if (oldSignaturePublicId) {
                    await deleteFile(oldSignaturePublicId);
                }
                const formData = new FormData();
                formData.append('file', dataToSave.newSignatureFile);
                const uploadResult = await uploadFile(formData);
                if (!uploadResult.success) throw new Error(uploadResult.message || "Signature upload failed");
                dataToSave.signatureUrl = uploadResult.url!;
                dataToSave.signaturePublicId = uploadResult.publicId!;
            }

            // 2. Prepare data for Supabase
            const profileUpdateData = {
                display_name: dataToSave.displayName,
                specialization: dataToSave.specialization,
                bio: dataToSave.bio,
                location: dataToSave.location,
                phone: dataToSave.phone,
                signature_url: dataToSave.signatureUrl,
                signature_public_id: dataToSave.signaturePublicId,
                years_of_experience: dataToSave.yearsOfExperience,
                languages: dataToSave.languages,
                consultation_fee: dataToSave.consultationFee,
                education: dataToSave.education,
                certificates: dataToSave.certificates,
                documents_public: dataToSave.documentsPublic,
            };

            // 3. Save to Supabase
            const { error: profileError } = await supabase
                .from('profiles')
                .update(profileUpdateData)
                .eq('id', user.id);

            if (profileError) throw profileError;

            // Also update Auth metadata
            await supabase.auth.updateUser({
                data: {
                    display_name: dataToSave.displayName,
                }
            });

            toast({
                title: "Profile Saved",
                description: "Your professional information has been updated.",
            });
            await invalidateUserProfileCache(user.id);
            forceReload();
        } catch (error: any) {
            toast({ title: "Error Saving Profile", description: error.message || "Could not update your profile.", variant: "destructive" });
        } finally {
            setIsSavingProfile(false);
        }
    };



    const handlePasswordChange = async () => {
        if (!user || !user.email) return;
        const supabase = createClient();

        if (newPassword !== confirmPassword) {
            toast({ title: "Error", description: "New passwords do not match.", variant: "destructive" });
            return;
        }
        if (newPassword.length < 8) {
            toast({ title: "Error", description: "New password must be at least 8 characters long.", variant: "destructive" });
            return;
        }

        const hasUpperCase = /[A-Z]/.test(newPassword);
        const hasNumber = /[0-9]/.test(newPassword);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);

        if (!hasUpperCase || !hasNumber || !hasSpecialChar) {
            toast({
                title: "Weak Password",
                description: "Password must contain at least one uppercase letter, one number, and one special character.",
                variant: "destructive"
            });
            return;
        }

        setIsUpdatingPassword(true);
        try {
            // Re-authenticate
            const { error: authError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: currentPassword,
            });

            if (authError) throw authError;

            // Update password
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (updateError) throw updateError;

            toast({ title: "Success", description: "Your password has been updated." });
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (error: any) {
            toast({ title: "Password Change Failed", description: error.message || "Could not update password.", variant: "destructive" });
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!user?.email) return;
        const supabase = createClient();

        const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
            redirectTo: `${window.location.origin}/auth/reset-password`,
        });

        if (error) {
            toast({
                title: "Error",
                description: "Could not send password reset email.",
                variant: "destructive"
            });
        } else {
            toast({
                title: "Password Reset Email Sent",
                description: `An email has been sent to ${user.email} with instructions.`
            });
        }
    };

    const handleDeleteAccount = async () => {
        if (!user) return;
        const supabase = createClient();

        try {
            // Delete user profile from database
            const { error: profileError } = await supabase
                .from('profiles')
                .delete()
                .eq('id', user.id);

            if (profileError) throw profileError;

            // Sign out the user
            await supabase.auth.signOut();

            toast({
                title: "Account Deleted",
                description: "Your account has been permanently deleted.",
            });

            // Redirect to home page
            window.location.href = '/';
        } catch (error: any) {
            toast({
                title: "Error Deleting Account",
                description: error.message || "Could not delete your account.",
                variant: "destructive"
            });
        }
    };

    if (!user || !userData) return null;

    const isProfileComplete = !!(formState.displayName && formState.specialization && formState.location && formState.phone && formState.signatureUrl);

    const hasVerificationDocuments = verificationDocuments && Object.keys(verificationDocuments).length > 0;

    return (
        <div className="container mx-auto p-4 md:p-8 max-w-5xl">
            <div className="space-y-2 mb-8">
                <h1 className="text-3xl font-bold tracking-tight font-headline">
                    Doctor Profile &amp; Settings
                </h1>
                <p className="text-muted-foreground">
                    Manage your professional profile and account settings.
                </p>
            </div>
            {!userData.verified && (
                <Alert className="mb-8" variant={isProfileComplete ? "default" : "destructive"}>
                    <BadgeHelp className="h-4 w-4" />
                    <AlertTitle>{isProfileComplete ? "Profile Complete!" : "Complete Your Profile!"}</AlertTitle>
                    <AlertDescription>
                        {isProfileComplete
                            ? "Your professional profile is complete and pending admin verification. Providing thorough details helps patients understand your expertise and builds trust during consultations."
                            : "Please complete your professional profile. Providing thorough details helps patients understand your expertise and builds trust during consultations."}
                    </AlertDescription>
                </Alert>
            )}

            <div className="space-y-6">

                {/* Row 1: Professional Information - full width */}
                <Card>
                    <CardHeader>
                        <CardTitle>Professional Information</CardTitle>
                        <CardDescription>This information will be visible to patients and used in appointment letters.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Full Name</Label>
                                <Input id="name" value={formState.displayName} onChange={(e) => handleProfileInputChange('displayName', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="specialization">Specialization</Label>
                                <Select value={formState.specialization} onValueChange={(v) => handleProfileInputChange('specialization', v)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select your specialization" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="General Dermatology">General Dermatology</SelectItem>
                                        <SelectItem value="Cosmetic Dermatology">Cosmetic Dermatology</SelectItem>
                                        <SelectItem value="Pediatric Dermatology">Pediatric Dermatology</SelectItem>
                                        <SelectItem value="Dermatopathology">Dermatopathology</SelectItem>
                                        <SelectItem value="Mohs Surgery">Mohs Surgery</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="bio">Professional Bio</Label>
                            <Textarea id="bio" placeholder="A short bio about your expertise and experience." value={formState.bio} onChange={(e) => handleProfileInputChange('bio', e.target.value)} />
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="location">Clinic Location</Label>
                                <Input id="location" value={formState.location} onChange={(e) => handleProfileInputChange('location', e.target.value)} placeholder="e.g. 123 Health St, Medtown" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone Number</Label>
                                <Input id="phone" value={formState.phone} onChange={(e) => handleProfileInputChange('phone', e.target.value)} placeholder="+1 (555) 123-4567" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Digital Signature</Label>
                            <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center cursor-pointer" onClick={() => signatureInputRef.current?.click()}>
                                {formState.signatureUrl ? (
                                    <div className="relative inline-block">
                                        <Image
                                            src={formState.signatureUrl}
                                            alt="Doctor's signature"
                                            width={200}
                                            height={75}
                                            style={{ height: 'auto' }}
                                            className="mx-auto rounded-lg bg-white"
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="absolute top-0 right-0 bg-background/50 hover:bg-background/80 rounded-full h-7 w-7"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleProfileInputChange('signatureUrl', null);
                                                handleProfileInputChange('newSignatureFile', null);
                                            }}
                                        >
                                            <XCircle className="h-5 w-5" />
                                        </Button>
                                    </div>
                                ) : (
                                    <Button variant="outline" type="button">
                                        <Upload className="mr-2 h-4 w-4" />
                                        Upload Signature
                                    </Button>
                                )}
                                <Input ref={signatureInputRef} type="file" className="hidden" accept="image/png, image/jpeg" onChange={handleSignatureFileChange} />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Row 2: Professional Info Form - full width */}
                <ProfessionalInfoForm
                    yearsOfExperience={formState.yearsOfExperience}
                    languages={formState.languages}
                    consultationFee={formState.consultationFee}
                    education={formState.education}
                    certificates={formState.certificates}
                    onYearsOfExperienceChange={(years) => handleProfileInputChange('yearsOfExperience', years)}
                    onLanguagesChange={(langs) => handleProfileInputChange('languages', langs)}
                    onConsultationFeeChange={(fee) => handleProfileInputChange('consultationFee', fee)}
                    onEducationChange={(edu) => handleProfileInputChange('education', edu)}
                    onCertificatesChange={(certs) => handleProfileInputChange('certificates', certs)}
                />

                <div className="flex justify-end">
                    <Button onClick={handleProfileSave} disabled={isSavingProfile} size="lg">
                        {isSavingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </div>

                {/* Row 3: My Documents (conditional) - full width */}
                {hasVerificationDocuments && (
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>My Documents</CardTitle>
                                    <CardDescription>Professional documents and certifications for patient trust</CardDescription>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Label htmlFor="documents-public" className="text-sm font-normal cursor-pointer">
                                        {formState.documentsPublic ? 'Public' : 'Private'}
                                    </Label>
                                    <Switch
                                        id="documents-public"
                                        checked={formState.documentsPublic}
                                        onCheckedChange={handleDocumentsPublicChange}
                                    />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {isLoadingDocuments ? (
                                <div className="flex items-center justify-center p-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            ) : Object.keys(verificationDocuments).length === 0 ? (
                                <div className="text-center p-8 text-muted-foreground">
                                    <p>No professional documents found.</p>
                                    <p className="text-xs mt-2">Your professional documents will appear here after approval.</p>
                                </div>
                            ) : (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {Object.entries(verificationDocuments).map(([key, url]: [string, any]) => (
                                        <a
                                            key={key}
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-3 p-4 border rounded-lg hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all cursor-pointer group"
                                        >
                                            <Upload className="h-5 w-5 text-muted-foreground group-hover:text-white transition-colors" />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium capitalize truncate">
                                                    {key.replace(/_/g, ' ')}
                                                </p>
                                                <p className="text-xs text-muted-foreground group-hover:text-blue-100 transition-colors">Click to view</p>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            )}
                            <p className="text-xs text-muted-foreground mt-4">
                                {formState.documentsPublic
                                    ? <span>&#10003; These documents are visible to patients viewing your profile</span>
                                    : <span>&#10003; These documents are private and only visible to you</span>}
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Row 4: Account Settings + Danger Zone - side by side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    <Card>
                        <CardHeader>
                            <CardTitle>Account Settings</CardTitle>
                            <CardDescription>Manage your login and notification preferences.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" type="email" value={user.email || ''} disabled />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="current-password">Current Password</Label>
                                <Input id="current-password" type="password" placeholder="Enter your current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new-password">New Password</Label>
                                <Input id="new-password" type="password" placeholder="Enter a new strong password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirm-password">Confirm New Password</Label>
                                <Input id="confirm-password" type="password" placeholder="Confirm your new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                            </div>
                            <div className="text-right">
                                <Button variant="link" className="text-sm p-0 h-auto" onClick={handleForgotPassword}>
                                    Forgot Password?
                                </Button>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button onClick={handlePasswordChange} disabled={isUpdatingPassword}>
                                {isUpdatingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Update Password
                            </Button>
                        </CardFooter>
                    </Card>

                    <Card className="border-destructive">
                        <CardHeader>
                            <CardTitle className="text-destructive flex items-center gap-2">
                                <AlertTriangle />
                                Danger Zone
                            </CardTitle>
                            <CardDescription>This action is irreversible. Please be certain.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col gap-3">
                                <div>
                                    <h3 className="font-semibold">Delete Your Account</h3>
                                    <p className="text-sm text-muted-foreground">Permanently remove your account and all of your data.</p>
                                </div>
                                <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => { setIsDeleteDialogOpen(open); if (!open) setDeleteConfirmName(''); }}>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" className="w-full sm:w-auto">Delete Account</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This action cannot be undone. This will permanently delete your account and remove all your data from our servers.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <div className="space-y-2 py-2">
                                            <Label htmlFor="delete-confirm" className="text-sm font-medium">
                                                Type your name <span className="font-bold text-foreground">{formState.displayName}</span> to confirm:
                                            </Label>
                                            <Input
                                                id="delete-confirm"
                                                value={deleteConfirmName}
                                                onChange={(e) => setDeleteConfirmName(e.target.value)}
                                                placeholder="Type your name here"
                                            />
                                        </div>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={handleDeleteAccount}
                                                className="bg-destructive hover:bg-destructive/90"
                                                disabled={deleteConfirmName !== formState.displayName}
                                            >
                                                Delete Account
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </CardContent>
                    </Card>
                </div>

            </div>
        </div>
    );
}
