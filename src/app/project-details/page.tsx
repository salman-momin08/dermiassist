
"use client"

import { AppHeader } from "@/components/layout/header";
import { AppFooter } from "@/components/layout/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Bot, User, Shield, Lock, MessageSquare, LineChart, FileText, Video, Bell, Palette, Languages, Cpu } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const features = [
    {
        icon: <User className="h-8 w-8 text-primary" />,
        title: "Role-Based User Authentication",
        description: "The platform supports distinct roles (Patient, Doctor, Admin) with secure signup and login. Each role has a tailored dashboard and permissions, ensuring users only access relevant features.",
        tech: ["Supabase Auth", "Supabase Policies", "React Context"],
    },
    {
        icon: <Bot className="h-8 w-8 text-primary" />,
        title: "AI-Powered Skin Analysis",
        description: "Patients can upload an image of a skin condition and receive an instant, AI-driven analysis. The system uses a conversational proforma to ask follow-up questions, leading to a highly detailed and personalized final report with actionable recommendations (Do's and Don'ts).",
        tech: ["Genkit AI", "Gemini Pro Vision", "Zod"],
    },
    {
        icon: <FileText className="h-8 w-8 text-primary" />,
        title: "Comprehensive Report Generation",
        description: "Generated reports include detailed information about the identified condition, expert recommendations, and a summary of the patient's provided answers. These reports are downloadable as professional-grade PDFs for sharing or personal records.",
        tech: ["jsPDF", "html2canvas", "React"],
    },
    {
        icon: <LineChart className="h-8 w-8 text-primary" />,
        title: "Visual Progress Tracking & Healing Video",
        description: "Patients can track their healing journey by uploading new photos. The AI compares the new image with the original, providing a summary of the visual progress. A premium feature allows generating a 'healing video' that visualizes the transition between the two states.",
        tech: ["Genkit AI", "Gemini Pro Vision", "Veo"],
    },
    {
        icon: <Languages className="h-8 w-8 text-primary" />,
        title: "Multilingual Report Explanation",
        description: "To enhance accessibility, patients can request an explanation of their report in various languages. The feature provides both translated text and a text-to-speech audio version of the explanation, and allows for conversational follow-up questions.",
        tech: ["Genkit AI", "Gemini TTS", "WAV"],
    },
    {
        icon: <MessageSquare className="h-8 w-8 text-primary" />,
        title: "Secure Real-time Chat",
        description: "Once an appointment is confirmed, a secure chat channel is created between the patient and doctor. This allows for direct, real-time communication for follow-ups and consultations.",
        tech: ["Stream Chat SDK", "Next.js API Routes"],
    },
    {
        icon: <Video className="h-8 w-8 text-primary" />,
        title: "Live Video Consultations",
        description: "For online appointments, the platform integrates a real-time video calling feature, enabling face-to-face consultations between doctors and patients directly within the browser.",
        tech: ["Agora RTC", "Agora Token Generation"],
    },
    {
        icon: <Shield className="h-8 w-8 text-primary" />,
        title: "Doctor & Admin Dashboards",
        description: "Doctors have a dedicated portal to manage appointments, review patient cases, and write private notes. Admins have an oversight dashboard to manage all users, verify new doctors, and monitor platform activity.",
        tech: ["Supabase Queries", "React State Management"],
    },
    {
        icon: <Palette className="h-8 w-8 text-primary" />,
        title: "Modern & Responsive UI",
        description: "The entire application is built with a modern, clean, and responsive user interface using ShadCN UI components and Tailwind CSS. It includes a dark mode theme for user comfort.",
        tech: ["ShadCN UI", "Tailwind CSS", "Next-themes"],
    },
];

const techStack = [
    "Next.js", "React", "TypeScript", "Genkit", "Gemini", "ShadCN UI",
    "Tailwind CSS", "Supabase", "Postgres", "Stream Chat", "Agora"
];

export default function ProjectDetailsPage() {
    return (
        <div className="flex flex-col min-h-screen">
            <AppHeader />
            <main className="flex-1 bg-muted/20">
                <div className="container mx-auto p-4 md:p-8">
                    <div className="flex flex-col items-center justify-center space-y-4 text-center py-12">
                        <h1 className="text-4xl font-bold tracking-tight font-headline">
                            Project Features & Tech Stack
                        </h1>
                        <p className="text-xl text-muted-foreground max-w-3xl">
                            An in-depth look at the cutting-edge technologies and features that power the DermiAssist-AI intelligent dermatology platform.
                        </p>
                    </div>

                    <Card className="mb-8">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3">
                                <Cpu className="h-6 w-6" />
                                Core Technology Stack
                            </CardTitle>
                            <CardDescription>
                                This project is built with a modern, server-centric, and AI-first technology stack.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                {techStack.map(tech => (
                                    <Badge key={tech} variant="default" className="text-sm py-1 px-3">{tech}</Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                        {features.map((feature, index) => (
                            <Card key={index} className="flex flex-col">
                                <CardHeader className="flex flex-row items-start gap-4">
                                    {feature.icon}
                                    <div className="space-y-1">
                                        <CardTitle>{feature.title}</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-grow space-y-4">
                                    <p className="text-muted-foreground">{feature.description}</p>
                                    <div className="flex flex-wrap gap-2">
                                        {feature.tech.map(t => (
                                            <Badge key={t} variant="secondary">{t}</Badge>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </main>
            <AppFooter />
        </div>
    )
}
