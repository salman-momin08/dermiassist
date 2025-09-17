
"use client"

import { AppHeader } from "@/components/layout/header";
import { AppFooter } from "@/components/layout/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function TermsPage() {
    return (
        <div className="flex flex-col min-h-screen">
            <AppHeader />
            <main className="flex-1 bg-muted/20">
                <div className="container mx-auto p-4 md:p-8">
                    <Card className="max-w-4xl mx-auto">
                        <CardHeader>
                            <CardTitle className="text-3xl font-headline">Terms & Conditions</CardTitle>
                            <CardDescription>Last updated: {new Date().toLocaleDateString()}</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <ScrollArea className="h-[60vh] pr-6">
                                <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
                                    <h3 className="font-semibold text-lg text-foreground">1. Introduction</h3>
                                    <p>Welcome to DermiAssist-AI ("we", "our", "us"). These Terms and Conditions govern your use of our application and services. By accessing or using DermiAssist-AI, you agree to be bound by these terms.</p>

                                    <h3 className="font-semibold text-lg text-foreground">2. Description of Service</h3>
                                    <p>DermiAssist-AI is a platform that uses artificial intelligence to provide a preliminary analysis of skin conditions based on user-submitted images and information. It also facilitates connections between patients and certified dermatologists for professional consultation.</p>

                                    <h3 className="font-semibold text-lg text-foreground">3. Medical Disclaimer</h3>
                                    <p className="font-bold text-destructive">The services and information provided by DermiAssist-AI are for informational purposes only and do not constitute medical advice. The AI analysis is a preliminary assessment and is not a substitute for a diagnosis from a qualified healthcare professional. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition.</p>

                                    <h3 className="font-semibold text-lg text-foreground">4. User Accounts</h3>
                                    <p>To access certain features, you must create an account. You are responsible for maintaining the confidentiality of your account information and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.</p>

                                    <h3 className="font-semibold text-lg text-foreground">5. User-Generated Content</h3>
                                    <p>You retain ownership of any images and information you submit. By using the service, you grant DermiAssist-AI a worldwide, non-exclusive, royalty-free license to use, process, and analyze your submitted data to provide you with the services and to improve our AI models. This data is anonymized before being used for model training.</p>
                                    
                                    <h3 className="font-semibold text-lg text-foreground">6. Limitation of Liability</h3>
                                    <p>In no event shall DermiAssist-AI, nor any of its officers, directors, and employees, be held liable for anything arising out of or in any way connected with your use of this application. DermiAssist-AI shall not be held liable for any indirect, consequential, or special liability arising out of or in any way related to your use of this application, especially concerning any health-related outcomes.</p>

                                    <h3 className="font-semibold text-lg text-foreground">7. Governing Law & Jurisdiction</h3>
                                    <p>These Terms will be governed by and interpreted in accordance with the laws of the jurisdiction in which the company is based, and you submit to the non-exclusive jurisdiction of the state and federal courts located in that jurisdiction for the resolution of any disputes.</p>
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </main>
            <AppFooter />
        </div>
    )
}
