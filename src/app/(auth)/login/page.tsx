
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
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/logo';
import Link from 'next/link';
import { X, Loader2 } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

function GoogleIcon() {
    return (
        <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="size-4 mr-2">
            <title>Google</title>
            <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.02 1.02-2.62 1.9-4.63 1.9-3.87 0-7-3.13-7-7s3.13-7 7-7c2.25 0 3.67.9 4.5 1.7l2.48-2.48C18.43 2.13 15.87 1 12.48 1 7.03 1 3 5.03 3 10s4.03 9 9.48 9c5.22 0 8.92-3.62 8.92-8.92 0-.6-.08-1.2-.2-1.76h-8.72z" fill="currentColor"></path>
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
  password: z.string().min(1, { message: "Password is required." }),
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

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    // Simulate API call
    console.log(values);
    return new Promise((resolve) => {
      setTimeout(() => {
        toast({
          title: "Login Successful",
          description: "Welcome back! Redirecting you to your dashboard.",
        });
        router.push("/dashboard");
        resolve(true);
      }, 1000);
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm relative">
        <Button variant="ghost" size="icon" className="absolute top-2 right-2 z-10" asChild>
            <Link href="/"><X className="h-4 w-4" /></Link>
        </Button>
        <Card>
          <CardHeader className="text-center">
            <div className="mb-4 flex justify-center">
                <Link href="/">
                    <Logo />
                </Link>
            </div>
            <CardTitle className="text-2xl font-headline">Welcome Back</CardTitle>
            <CardDescription>
              Enter your email below to login to your account.
            </CardDescription>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardContent className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="grid gap-2">
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="m@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem className="grid gap-2">
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                 <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Login
                </Button>
                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">
                        Or continue with
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
              Don't have an account?{' '}
              <Link href="/signup" className="font-semibold text-primary underline-offset-4 hover:underline">
                Sign up
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
