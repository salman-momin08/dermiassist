
"use client"

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/logo';
import Link from 'next/link';
import { X, Loader2, CalendarIcon } from 'lucide-react';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";


function GoogleIcon() {
    return (
        <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="size-4 mr-2">
            <title>Google</title>
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path><path d="M1 1h22v22H1z" fill="none"></path>
        </svg>
    )
}

function FacebookIcon() {
    return (
        <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="size-4 mr-2 fill-[#1877F2]">
            <title>Facebook</title>
            <path d="M22.675 0h-21.35C.59 0 0 .59 0 1.325v21.35C0 23.41.59 24 1.325 24H12.82v-9.29H9.69v-3.62h3.13V8.41c0-3.1 1.89-4.78 4.66-4.78 1.33 0 2.46.1 2.79.14v3.24h-1.92c-1.5 0-1.79.72-1.79 1.76v2.3h3.59l-.47 3.62h-3.12V24h5.68c.73 0 1.32-.59 1.32-1.32V1.32C24 .59 23.4.59 22.675 0z" />
        </svg>
    )
}

const signupSchema = z.object({
  role: z.enum(["patient", "doctor"], { required_error: "You must select a role."}),
  firstName: z.string().min(1, { message: "First name is required." }),
  lastName: z.string().min(1, { message: "Last name is required." }),
  dob: z.date({ required_error: "Date of birth is required."}),
  gender: z.string().optional(),
  email: z.string().email({ message: "Invalid email address." }),
  mobile: z.string().min(10, { message: "Please enter a valid mobile number."}),
  password: z.string().min(8, { message: "Password must be at least 8 characters." })
      .refine((password) => /[A-Z]/.test(password), { message: "Password must contain at least one uppercase letter."})
      .refine((password) => /[0-9]/.test(password), { message: "Password must contain at least one number."})
      .refine((password) => /[^A-Za-z0-9]/.test(password), { message: "Password must contain at least one special character."}),
  confirmPassword: z.string(),
  medicalId: z.string().optional(),
  specialization: z.string().optional(),
  acceptTerms: z.boolean().refine(val => val === true, { message: "You must accept the terms and conditions."}),
  acceptPrivacy: z.boolean().refine(val => val === true, { message: "You must accept the privacy policy."}),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
}).refine(data => {
    if (data.role === 'doctor') {
        return !!data.medicalId && data.medicalId.length > 0;
    }
    return true;
}, {
    message: "Medical Registration Number is required for doctors.",
    path: ["medicalId"],
}).refine(data => {
    if (data.role === 'doctor') {
        return !!data.specialization && data.specialization.length > 0;
    }
    return true;
}, {
    message: "Specialization is required for doctors.",
    path: ["specialization"],
});

export default function SignupPage() {
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      role: "patient",
      firstName: "",
      lastName: "",
      gender: "prefer-not-to-say",
      email: "",
      mobile: "",
      password: "",
      confirmPassword: "",
      medicalId: "",
      specialization: "",
      acceptTerms: false,
      acceptPrivacy: false,
    },
  });

  const role = form.watch("role");

  const onSubmit = (values: z.infer<typeof signupSchema>) => {
    // In a real app, you would handle account creation here (e.g., call an API)
    console.log("Signup form submitted with values:", values);
     toast({
        title: "Account Creation Submitted",
        description: "Check the console for the submitted form data.",
    });
    // On successful account creation from your API, you would then redirect.
    // const destination = values.role === 'doctor' ? '/doctor/dashboard' : '/dashboard';
    // router.push(destination);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4 py-12">
      <div className="w-full max-w-lg relative">
         <Button variant="ghost" size="icon" className="absolute top-4 right-4 z-10" asChild>
            <Link href="/"><X className="h-4 w-4" /></Link>
        </Button>
        <Card>
          <CardHeader className="text-center">
            <div className="mb-4 flex justify-center">
                <Link href="/">
                    <Logo />
                </Link>
            </div>
            <CardTitle className="text-2xl font-headline">Create a Secure Account</CardTitle>
            <CardDescription>
              Join SkinWise to take control of your skin health.
            </CardDescription>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="space-y-6">
                 <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>I am a...</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex space-x-4"
                        >
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="patient" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Patient
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="doctor" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Doctor
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Separator />
                
                <div className="grid sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="firstName" render={({ field }) => (
                        <FormItem><FormLabel>First Name</FormLabel><FormControl><Input placeholder="John" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="lastName" render={({ field }) => (
                        <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input placeholder="Doe" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                
                 <div className="grid sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="dob" render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Date of Birth</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                            {field.value ? (format(field.value, "PPP")) : (<span>Pick a date</span>)}
                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date() || date < new Date("1900-01-01")} initialFocus />
                                </PopoverContent>
                            </Popover>
                             <FormMessage />
                        </FormItem>
                    )} />
                     <FormField control={form.control} name="gender" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Gender</FormLabel>
                             <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select a gender" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="male">Male</SelectItem>
                                    <SelectItem value="female">Female</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                    <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                     )} />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" placeholder="m@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="mobile" render={({ field }) => (
                        <FormItem><FormLabel>Mobile Number</FormLabel><FormControl><Input placeholder="e.g. +1 123 456 7890" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="password" render={({ field }) => (
                        <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                     <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                        <FormItem><FormLabel>Confirm Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                
                {role === 'doctor' && (
                  <>
                    <Separator />
                    <div className="space-y-4 rounded-md border p-4">
                        <p className="text-sm font-medium">Doctor Verification</p>
                         <FormField control={form.control} name="medicalId" render={({ field }) => (
                            <FormItem><FormLabel>Medical Registration Number</FormLabel><FormControl><Input placeholder="Your medical ID" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="specialization" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Specialization</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select your specialization" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="general-dermatology">General Dermatology</SelectItem>
                                        <SelectItem value="cosmetic-dermatology">Cosmetic Dermatology</SelectItem>
                                        <SelectItem value="pediatric-dermatology">Pediatric Dermatology</SelectItem>
                                        <SelectItem value="dermatopathology">Dermatopathology</SelectItem>
                                        <SelectItem value="mohs-surgery">Mohs Surgery</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                         )} />
                    </div>
                  </>
                )}
                
                <Separator />

                <div className="space-y-4">
                    <FormField control={form.control} name="acceptTerms" render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel>I agree to the <Link href="#" className="text-primary hover:underline">Terms & Conditions</Link>.</FormLabel>
                                <FormMessage />
                            </div>
                        </FormItem>
                    )} />
                     <FormField control={form.control} name="acceptPrivacy" render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel>I agree to the <Link href="#" className="text-primary hover:underline">Privacy Policy</Link>.</FormLabel>
                                <FormMessage />
                            </div>
                        </FormItem>
                    )} />
                </div>


                 <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                   {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                   Create Account
                </Button>
                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">
                        Or sign up with
                        </span>
                    </div>
                </div>
                 <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="w-full">
                      <GoogleIcon />
                      Google
                    </Button>
                    <Button variant="outline" className="w-full">
                      <FacebookIcon />
                      Facebook
                    </Button>
                </div>
              </CardContent>
            </form>
          </Form>
          <CardFooter className="text-sm">
            <p className="w-full text-center text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
                Login
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
