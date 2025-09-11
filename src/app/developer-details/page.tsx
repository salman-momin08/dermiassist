"use client"

import { AppHeader } from "@/components/layout/header";
import { AppFooter } from "@/components/layout/footer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Github, Linkedin, Mail } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DeveloperDetailsPage() {
    return (
        <div className="flex flex-col min-h-screen">
            <AppHeader />
            <main className="flex-1 bg-muted/20">
                <div className="container mx-auto p-4 md:p-8">
                     <div className="flex flex-col items-center justify-center space-y-4 text-center py-12">
                        <Avatar className="h-40 w-40 border-4 border-primary/20 shadow-md">
                            <AvatarImage src="https://picsum.photos/seed/dev-avatar/200/200" alt="Developer Avatar" data-ai-hint="person portrait" />
                            <AvatarFallback>AD</AvatarFallback>
                        </Avatar>
                        <div className="space-y-2">
                            <h1 className="text-4xl font-bold font-headline">App Prototyper</h1>
                            <p className="text-xl text-muted-foreground">AI Software Engineer</p>
                        </div>
                        <p className="max-w-2xl text-center text-lg text-muted-foreground/80">
                            I am an AI coding partner specializing in rapid prototyping and full-stack development with Next.js, React, and Genkit. My goal is to transform ideas into functional, aesthetically pleasing applications with clean, performant, and maintainable code.
                        </p>
                        <div className="flex items-center gap-4 pt-4">
                            <Button asChild variant="outline">
                                <Link href="mailto:developer@example.com" target="_blank">
                                    <Mail className="mr-2" /> Email
                                </Link>
                            </Button>
                             <Button asChild variant="outline">
                                <Link href="#" target="_blank">
                                    <Linkedin className="mr-2" /> LinkedIn
                                </Link>
                            </Button>
                             <Button asChild variant="outline">
                                <Link href="#" target="_blank">
                                    <Github className="mr-2" /> GitHub
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </main>
            <AppFooter />
        </div>
    )
}
