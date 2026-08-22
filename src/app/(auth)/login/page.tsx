
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
import { X, Loader2 } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";

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

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
});


export default function LoginPage() {
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        throw error;
      }

      // Fetch user profile to determine role
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      // If profile missing, default to patient
      const role = profile?.role || 'patient';

      toast({
        title: "Login Successful",
        description: "Welcome back! Redirecting you to your dashboard.",
      });

      let destination = '/dashboard';
      if (role === 'doctor') {
        destination = '/doctor/dashboard';
      } else if (role === 'admin') {
        destination = '/admin/dashboard';
      }
      router.push(destination);

    } catch (error: any) {
      console.error("Login failed:", error);
      let description = "An unexpected error occurred. Please try again.";
      if (error.message) {
        if (error.message.includes('Invalid login credentials')) {
          description = "Invalid email or password. Please check your credentials.";
        } else {
          description = error.message;
        }
      }

      toast({
        title: "Login Failed",
        description,
        variant: "destructive",
      });
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        delay: 0.1,
        when: "beforeChildren",
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0 },
  };


  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm relative">
        <Button variant="ghost" size="icon" className="absolute top-2 right-2 z-10" asChild>
          <Link href="/"><X className="h-4 w-4" /></Link>
        </Button>
        <motion.div variants={containerVariants} initial="hidden" animate="visible">
          <Card>
            <CardHeader className="text-center">
              <motion.div variants={itemVariants} className="mb-4 flex justify-center">
                <Link href="/">
                  <Logo />
                </Link>
              </motion.div>
              <motion.div variants={itemVariants}>
                <CardTitle className="text-2xl font-headline">Welcome Back</CardTitle>
                <CardDescription>
                  Enter your email below to login to your account.
                </CardDescription>
              </motion.div>
            </CardHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <CardContent className="grid gap-4">
                  <motion.div variants={itemVariants}>
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem className="grid gap-2">
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="dermiassist@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </motion.div>
                  <motion.div variants={itemVariants}>
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem className="grid gap-2">
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="********" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </motion.div>
                  <motion.div variants={itemVariants}>
                    <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                      {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Login
                    </Button>
                  </motion.div>
                  <motion.div variants={itemVariants} className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">
                        Or continue with
                      </span>
                    </div>
                  </motion.div>
                  <motion.div variants={itemVariants} className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="w-full">
                      <GoogleIcon />
                      Google
                    </Button>
                    <Button variant="outline" className="w-full">
                      <FacebookIcon />
                      Facebook
                    </Button>
                  </motion.div>
                </CardContent>
              </form>
            </Form>
            <CardFooter className="text-sm">
              <motion.p variants={itemVariants} className="w-full text-center text-muted-foreground">
                Don't have an account?{' '}
                <Link href="/signup" className="font-semibold text-primary underline-offset-4 hover:underline">
                  Sign up
                </Link>
              </motion.p>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
