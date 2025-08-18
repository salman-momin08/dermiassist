
"use client"

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, ArrowLeft, Loader2, Upload, CalendarIcon, CreditCard, FileText, Lock } from "lucide-react";
import Link from "next/link";
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
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { uploadFile } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { updateProfile } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

const indianStates: Record<string, string[]> = {
    "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur", "Tirupati"],
    "Arunachal Pradesh": ["Itanagar", "Naharlagun"],
    "Assam": ["Guwahati", "Dibrugarh", "Silchar"],
    "Bihar": ["Patna", "Gaya", "Bhagalpur"],
    "Chhattisgarh": ["Raipur", "Bhilai", "Bilaspur"],
    "Goa": ["Panaji", "Vasco da Gama", "Margao"],
    "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot"],
    "Haryana": ["Faridabad", "Gurugram", "Panipat"],
    "Himachal Pradesh": ["Shimla", "Dharamshala", "Solan"],
    "Jharkhand": ["Ranchi", "Jamshedpur", "Dhanbad"],
    "Karnataka": ["Bengaluru", "Mysuru", "Hubballi", "Mangaluru"],
    "Kerala": ["Thiruvananthapuram", "Kochi", "Kozhikode"],
    "Madhya Pradesh": ["Indore", "Bhopal", "Jabalpur", "Gwalior"],
    "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Thane", "Nashik"],
    "Manipur": ["Imphal"],
    "Meghalaya": ["Shillong"],
    "Mizoram": ["Aizawl"],
    "Nagaland": ["Kohima", "Dimapur"],
    "Odisha": ["Bhubaneswar", "Cuttack", "Rourkela"],
    "Punjab": ["Ludhiana", "Amritsar", "Jalandhar"],
    "Rajasthan": ["Jaipur", "Jodhpur", "Kota", "Udaipur"],
    "Sikkim": ["Gangtok"],
    "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli"],
    "Telangana": ["Hyderabad", "Warangal", "Nizamabad"],
    "Tripura": ["Agartala"],
    "Uttar Pradesh": ["Lucknow", "Kanpur", "Ghaziabad", "Agra", "Varanasi"],
    "Uttarakhand": ["Dehradun", "Haridwar", "Roorkee"],
    "West Bengal": ["Kolkata", "Howrah", "Asansol", "Siliguri"],
    "Delhi": ["New Delhi", "North Delhi", "South Delhi", "West Delhi", "East Delhi"],
};


export default function ProfilePage() {
    const { user, userData, loading, forceReload } = useAuth();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [dob, setDob] = useState<Date | undefined>();
    const [gender, setGender] = useState('');
    const [bloodGroup, setBloodGroup] = useState('');
    const [address, setAddress] = useState('');
    const [state, setState] = useState('');
    const [city, setCity] = useState('');
    const [otherState, setOtherState] = useState('');
    const [otherCity, setOtherCity] = useState('');
    const [profileImage, setProfileImage] = useState<string | null>(null);

    // Settings
    const [allowDataSharing, setAllowDataSharing] = useState(true);
    const [emailNotifications, setEmailNotifications] = useState(true);

    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (user && userData) {
            setName(userData.displayName || user.displayName || '');
            setProfileImage(user.photoURL || null);
            setPhone(userData.phone || '');
            if (userData.dob) setDob(new Date(userData.dob));
            setGender(userData.gender || '');
            setBloodGroup(userData.bloodGroup || '');
            setAddress(userData.address || '');
            
            const userState = userData.state || '';
            const isKnownState = Object.keys(indianStates).includes(userState);
            if (isKnownState) {
                setState(userState);
            } else if (userState) {
                setState('Other');
                setOtherState(userState);
            } else {
                setState('');
            }

            const userCity = userData.city || '';
            if (userState && isKnownState && indianStates[userState as keyof typeof indianStates]?.includes(userCity)) {
                setCity(userCity);
            } else if (userCity) {
                setCity('Other');
                setOtherCity(userCity);
            } else {
                setCity('');
            }

            setAllowDataSharing(userData.allowDataSharing !== false);
            setEmailNotifications(userData.emailNotifications !== false);
        }
    }, [user, userData]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        const result = await uploadFile(formData);

        if (result.success && result.url) {
            try {
                 await updateProfile(user, { photoURL: result.url });
                 await updateDoc(doc(db, "users", user.uid), { photoURL: result.url });
                 setProfileImage(result.url);
                 toast({
                    title: "Image Uploaded",
                    description: "Your profile picture has been updated.",
                });
                forceReload();
            } catch (error) {
                 toast({ title: "Update Failed", description: "Could not update profile picture.", variant: "destructive"});
            }
        } else {
            toast({
                title: "Upload Failed",
                description: result.message || "An error occurred during upload.",
                variant: "destructive",
            });
        }
        setIsUploading(false);
    };

    const handleSaveChanges = async () => {
        if (!user || !name.trim()) return;
        setIsSaving(true);
        try {
            const userDocRef = doc(db, 'users', user.uid);
            const updatedData = {
                displayName: name,
                firstName: name.split(' ')[0] || '',
                lastName: name.split(' ').slice(1).join(' ') || '',
                phone,
                dob: dob ? dob.toISOString() : null,
                gender,
                bloodGroup,
                address,
                state: state === 'Other' ? otherState : state,
                city: city === 'Other' ? otherCity : city,
                allowDataSharing,
                emailNotifications,
            };

            await updateProfile(user, { displayName: name });
            await updateDoc(userDocRef, updatedData);

            toast({ title: "Profile Updated", description: "Your information has been updated." });
            forceReload();
        } catch (error) {
            console.error("Profile update error:", error);
            toast({ title: "Error", description: "Could not update your profile.", variant: "destructive"});
        }
        setIsSaving(false);
    }
    
    const handlePasswordChange = () => {
        toast({
            title: "Password Change (UI Demo)",
            description: "Password change functionality would be implemented here.",
        });
    };

    if (loading) {
      return (
        <div className="container mx-auto p-4 md:p-8 flex justify-center">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
      )
    }

    if (!user) return null;


    return (
        <div className="container mx-auto p-4 md:p-8 max-w-4xl">
             <div className="mb-6">
                <Button variant="outline" asChild>
                    <Link href="/dashboard">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Dashboard
                    </Link>
                </Button>
            </div>
            <div className="space-y-2 mb-8">
                 <h1 className="text-3xl font-bold tracking-tight font-headline">
                    Profile & Settings
                </h1>
                <p className="text-muted-foreground">
                    Manage your account details and preferences.
                </p>
            </div>
           
            <div className="space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Personal Information</CardTitle>
                        <CardDescription>Update your personal details here.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center space-x-6">
                            <div className="relative">
                                <Avatar className="h-24 w-24">
                                    <AvatarImage src={profileImage || `https://placehold.co/100x100.png?text=${name.charAt(0)}`} alt={name} data-ai-hint="person portrait"/>
                                    <AvatarFallback>{name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <Button size="icon" variant="outline" className="absolute bottom-0 right-0 rounded-full h-8 w-8" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                    <span className="sr-only">Upload Profile Picture</span>
                                </Button>
                                <Input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-xl font-bold">{userData?.displayName}</h3>
                                <p className="text-muted-foreground">{user.email}</p>
                            </div>
                        </div>
                        <Separator />
                         <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Full Name</Label>
                                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone Number</Label>
                                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Your phone number" />
                            </div>
                        </div>
                        <div className="grid md:grid-cols-3 gap-4">
                             <div className="space-y-2">
                                <Label htmlFor="dob">Date of Birth</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !dob && "text-muted-foreground")}>
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {dob ? format(dob, "PPP") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar 
                                            mode="single" 
                                            selected={dob} 
                                            onSelect={setDob} 
                                            initialFocus 
                                            disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="gender">Gender</Label>
                                <Select value={gender} onValueChange={setGender}>
                                    <SelectTrigger id="gender"><SelectValue placeholder="Select..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="male">Male</SelectItem>
                                        <SelectItem value="female">Female</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                        <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="blood-group">Blood Group</Label>
                                <Select value={bloodGroup} onValueChange={setBloodGroup}>
                                    <SelectTrigger id="blood-group"><SelectValue placeholder="Select..." /></SelectTrigger>
                                    <SelectContent>
                                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(group => (
                                            <SelectItem key={group} value={group}>{group}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <Label htmlFor="state">State</Label>
                                <Select value={state} onValueChange={(value) => {setState(value); setCity(''); setOtherState(''); setOtherCity('');}}>
                                    <SelectTrigger id="state"><SelectValue placeholder="Select state..." /></SelectTrigger>
                                    <SelectContent>
                                        {Object.keys(indianStates).map(s => (
                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                        ))}
                                        <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {state === 'Other' && (
                                <div className="space-y-2">
                                    <Label htmlFor="other-state">Please specify your state</Label>
                                    <Input id="other-state" value={otherState} onChange={(e) => setOtherState(e.target.value)} />
                                </div>
                            )}
                             <div className="space-y-2">
                                <Label htmlFor="city">City</Label>
                                <Select value={city} onValueChange={(value) => {setCity(value); setOtherCity('');}} disabled={!state || state === 'Other'}>
                                    <SelectTrigger id="city"><SelectValue placeholder="Select city..." /></SelectTrigger>
                                    <SelectContent>
                                        {state && indianStates[state as keyof typeof indianStates]?.map(c => (
                                            <SelectItem key={c} value={c}>{c}</SelectItem>
                                        ))}
                                        <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {city === 'Other' && (
                                <div className="space-y-2">
                                    <Label htmlFor="other-city">Please specify your city</Label>
                                    <Input id="other-city" value={otherCity} onChange={(e) => setOtherCity(e.target.value)} />
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="address">Address (Street, Zip Code)</Label>
                            <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 123 Main St, 400001" />
                        </div>
                    </CardContent>
                </Card>
                
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Lock className="w-5 h-5" /> Account Security</CardTitle>
                        <CardDescription>Manage your account security settings.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="current-password">Current Password</Label>
                            <Input id="current-password" type="password" placeholder="Enter your current password" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-password">New Password</Label>
                            <Input id="new-password" type="password" placeholder="Enter a new strong password" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirm New Password</Label>
                            <Input id="confirm-password" type="password" placeholder="Confirm your new password" />
                        </div>
                    </CardContent>
                    <CardFooter>
                       <Button onClick={handlePasswordChange}>Update Password</Button>
                    </CardFooter>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Settings &amp; Privacy</CardTitle>
                        <CardDescription>Manage your notification and data sharing preferences.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <Label htmlFor="email-notifications">Email Notifications</Label>
                                <p className="text-xs text-muted-foreground">Receive emails about appointments and platform updates.</p>
                            </div>
                             <Switch id="email-notifications" checked={emailNotifications} onCheckedChange={setEmailNotifications} />
                        </div>
                         <div className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <Label htmlFor="data-sharing">Share Data with Doctors</Label>
                                <p className="text-xs text-muted-foreground">Allow your analysis reports to be shared with doctors during consultations.</p>
                            </div>
                             <Switch id="data-sharing" checked={allowDataSharing} onCheckedChange={setAllowDataSharing} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email-auth">Email Address</Label>
                             <div className="flex items-center space-x-2">
                                <Input id="email-auth" type="email" value={user.email || ''} disabled />
                                <Button variant="outline" disabled>Change</Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Subscription &amp; Billing</CardTitle>
                        <CardDescription>Manage your plan and view payment history.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                         <div className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <Label className="text-base font-semibold">Current Plan</Label>
                                <p className="text-2xl font-bold">{userData?.subscriptionPlan || 'Free'}</p>
                            </div>
                            <Button variant="outline" asChild>
                                <Link href="/subscription">Change Plan</Link>
                            </Button>
                        </div>
                        <div>
                             <Label className="text-lg font-semibold flex items-center gap-2 mb-2">Payment History</Label>
                             <div className="rounded-md border p-8 text-center text-muted-foreground">
                                <p>You have no payment history.</p>
                             </div>
                        </div>
                    </CardContent>
                </Card>
                
                 <div className="flex justify-start">
                    <Button onClick={handleSaveChanges} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save All Changes
                    </Button>
                </div>
                
                <Card className="border-destructive">
                    <CardHeader>
                        <CardTitle className="text-destructive flex items-center gap-2">
                            <AlertTriangle /> Danger Zone
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold">Delete Your Account</h3>
                                <p className="text-sm text-muted-foreground">Permanently remove your account and all of your data.</p>
                            </div>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive">Delete Account</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete your account, subscription, and all of your data.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction className="bg-destructive hover:bg-destructive/90">Delete Account</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

    

    