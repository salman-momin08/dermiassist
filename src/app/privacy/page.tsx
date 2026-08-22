
"use client"

import { AppHeader } from "@/components/layout/header";
import { AppFooter } from "@/components/layout/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function PrivacyPage() {
    return (
        <div className="flex flex-col min-h-screen">
            <AppHeader />
            <main className="flex-1 bg-muted/20">
                <div className="container mx-auto p-4 md:p-8">
                     <Card className="max-w-4xl mx-auto">
                        <CardHeader>
                            <CardTitle className="text-3xl font-headline">Privacy Policy</CardTitle>
                            <CardDescription>Last updated: {new Date().toLocaleDateString()}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[60vh] pr-6">
                                <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
                                    <h3 className="font-semibold text-lg text-foreground">1. Introduction</h3>
                                    <p>Your privacy is critically important to us. At DermiAssist-AI, we have a few fundamental principles: We are thoughtful about the personal information we ask you to provide and the personal information that we collect about you through the operation of our services. We store personal information for only as long as we have a reason to keep it. We aim for full transparency on how we gather, use, and share your personal information.</p>
                                    
                                    <h3 className="font-semibold text-lg text-foreground">2. Information We Collect</h3>
                                    <p>We collect information about you only if we have a reason to do so — for example, to provide our Services, to communicate with you, or to make our Services better.</p>
                                    <ul className="list-disc pl-5 space-y-2">
                                        <li><strong>Account Information:</strong> Name, email address, password, and user role (patient or doctor).</li>
                                        <li><strong>Health & Medical Information:</strong> Images of skin conditions you upload, answers to proforma questions, and any other health-related details you provide.</li>
                                        <li><strong>Transaction Information:</strong> If you subscribe to a paid plan, we collect information related to the transaction, but we do not store your credit card details ourselves.</li>
                                        <li><strong>Log Data:</strong> We collect information that web browsers, mobile devices, and servers typically make available, such as the browser type, IP address, unique device identifiers, language preference, referring site, the date and time of access, operating system, and mobile network information.</li>
                                    </ul>

                                    <h3 className="font-semibold text-lg text-foreground">3. How We Use Your Information</h3>
                                    <p>We use information about you for the purposes listed below:</p>
                                    <ul className="list-disc pl-5 space-y-2">
                                        <li>To provide and maintain our Service, including to generate AI analysis reports and connect you with doctors.</li>
                                        <li>To improve our AI models. For this purpose, all data such as images and related text are anonymized to remove personally identifiable information.</li>
                                        <li>To communicate with you, for example through an email, about your account, and our services.</li>
                                        <li>To personalize your experience and to provide you with content and features that are most relevant to you.</li>
                                    </ul>

                                    <h3 className="font-semibold text-lg text-foreground">4. Data Sharing</h3>
                                    <p>We do not sell our users’ private personal information. We share information about you in the limited circumstances spelled out below:</p>
                                     <ul className="list-disc pl-5 space-y-2">
                                        <li><strong>With Your Consent:</strong> We will share your information with doctors only when you explicitly book an appointment and consent to share your data and AI reports for consultation purposes.</li>
                                        <li><strong>Third-Party Vendors:</strong> We may share information with third-party vendors who need the information in order to provide their services to us (e.g., payment providers, cloud storage services, AI service providers).</li>
                                        <li><strong>Legal Requests:</strong> We may disclose information about you in response to a subpoena, court order, or other governmental request.</li>
                                    </ul>

                                    <h3 className="font-semibold text-lg text-foreground">5. Data Security</h3>
                                    <p>While no online service is 100% secure, we work very hard to protect information about you against unauthorized access, use, alteration, or destruction, and take reasonable measures to do so, such as using HTTPS and storing sensitive data in secure, encrypted databases.</p>
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
