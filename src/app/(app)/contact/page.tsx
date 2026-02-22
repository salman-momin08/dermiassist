"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { Loader2, Mail, MessageSquare, UserCog, AlertCircle, Lightbulb, Send } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createClient } from "@/lib/supabase/client"

type RequestType = "role-change" | "enquiry" | "technical-support" | "feedback"

export default function ContactPage() {
    const { user, userData } = useAuth()
    const { toast } = useToast()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [activeTab, setActiveTab] = useState<RequestType>("enquiry")

    // Form states
    const [roleChangeForm, setRoleChangeForm] = useState({
        currentRole: userData?.role || "",
        requestedRole: "",
        reason: "",
        qualifications: ""
    })

    const [enquiryForm, setEnquiryForm] = useState({
        subject: "",
        category: "",
        message: ""
    })



    const [technicalSupportForm, setTechnicalSupportForm] = useState({
        issueType: "",
        priority: "",
        description: "",
        stepsToReproduce: ""
    })

    const [feedbackForm, setFeedbackForm] = useState({
        category: "",
        rating: "",
        feedback: "",
        suggestions: ""
    })

    const handleSubmit = async (type: RequestType) => {
        if (!user) return

        setIsSubmitting(true)
        const supabase = createClient()

        let formData: any
        let title = ""

        switch (type) {
            case "role-change":
                formData = roleChangeForm
                title = "Role Change Request Submitted"
                break
            case "enquiry":
                formData = enquiryForm
                title = "Enquiry Submitted"
                break
            case "technical-support":
                formData = technicalSupportForm
                title = "Support Ticket Created"
                break
            case "feedback":
                formData = feedbackForm
                title = "Feedback Submitted"
                break
        }

        try {
            // Save to database
            const { error } = await supabase
                .from('contact_requests')
                .insert({
                    user_id: user.id,
                    user_name: userData?.display_name || user.email?.split('@')[0] || 'User',
                    user_email: user.email || '',
                    request_type: type,
                    status: 'pending',
                    data: formData
                })

            if (error) throw error

            toast({
                title,
                description: "Our team will review your request and get back to you within 24-48 hours.",
            })

            // Reset form
            resetForm(type)
        } catch (error: any) {
            console.error("Error submitting request:", error)
            toast({
                title: "Submission Failed",
                description: error.message || "Could not submit your request. Please try again.",
                variant: "destructive"
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    const resetForm = (type: RequestType) => {
        switch (type) {
            case "role-change":
                setRoleChangeForm({ currentRole: userData?.role || "", requestedRole: "", reason: "", qualifications: "" })
                break
            case "enquiry":
                setEnquiryForm({ subject: "", category: "", message: "" })
                break

            case "technical-support":
                setTechnicalSupportForm({ issueType: "", priority: "", description: "", stepsToReproduce: "" })
                break
            case "feedback":
                setFeedbackForm({ category: "", rating: "", feedback: "", suggestions: "" })
                break
        }
    }

    if (!user) return null

    return (
        <div className="container mx-auto p-4 md:p-8 max-w-4xl">
            <div className="space-y-2 mb-8">
                <h1 className="text-3xl font-bold tracking-tight font-headline">Contact & Support</h1>
                <p className="text-muted-foreground">
                    Get help, submit requests, or share your feedback with our team.
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as RequestType)} className="space-y-6">
                <TabsList className={`grid w-full ${userData?.role === 'doctor' ? 'grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'}`}>
                    <TabsTrigger value="enquiry" className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        <span className="hidden sm:inline">Enquiry</span>
                    </TabsTrigger>
                    {userData?.role !== 'doctor' && (
                        <TabsTrigger value="role-change" className="flex items-center gap-2">
                            <UserCog className="h-4 w-4" />
                            <span className="hidden sm:inline">Role Change</span>
                        </TabsTrigger>
                    )}
                    <TabsTrigger value="technical-support" className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        <span className="hidden sm:inline">Tech Support</span>
                    </TabsTrigger>
                    <TabsTrigger value="feedback" className="flex items-center gap-2">
                        <Lightbulb className="h-4 w-4" />
                        <span className="hidden sm:inline">Feedback</span>
                    </TabsTrigger>
                </TabsList>

                {/* General Enquiry */}
                <TabsContent value="enquiry">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MessageSquare className="h-5 w-5" />
                                General Enquiry
                            </CardTitle>
                            <CardDescription>
                                Have a question? We're here to help!
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="enquiry-category">Category</Label>
                                <Select value={enquiryForm.category} onValueChange={(value) => setEnquiryForm({ ...enquiryForm, category: value })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="general">General Question</SelectItem>
                                        <SelectItem value="billing">Billing & Subscription</SelectItem>
                                        <SelectItem value="appointments">Appointments</SelectItem>
                                        <SelectItem value="analysis">Skin Analysis</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="enquiry-subject">Subject</Label>
                                <Input
                                    id="enquiry-subject"
                                    placeholder="Brief description of your enquiry"
                                    value={enquiryForm.subject}
                                    onChange={(e) => setEnquiryForm({ ...enquiryForm, subject: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="enquiry-message">Message</Label>
                                <Textarea
                                    id="enquiry-message"
                                    placeholder="Provide details about your enquiry..."
                                    className="min-h-[150px]"
                                    value={enquiryForm.message}
                                    onChange={(e) => setEnquiryForm({ ...enquiryForm, message: e.target.value })}
                                />
                            </div>
                            <Button onClick={() => handleSubmit("enquiry")} disabled={isSubmitting || !enquiryForm.subject || !enquiryForm.message}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                <Send className="mr-2 h-4 w-4" />
                                Submit Enquiry
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Role Change Request */}
                <TabsContent value="role-change">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <UserCog className="h-5 w-5" />
                                Role Change Request
                            </CardTitle>
                            <CardDescription>
                                Request to change your account role (e.g., Patient to Doctor)
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="requested-role">Requested Role</Label>
                                <Select value={roleChangeForm.requestedRole} onValueChange={(value) => setRoleChangeForm({ ...roleChangeForm, requestedRole: value })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="doctor">Doctor</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="role-reason">Reason for Change</Label>
                                <Textarea
                                    id="role-reason"
                                    placeholder="Explain why you need this role change..."
                                    className="min-h-[100px]"
                                    value={roleChangeForm.reason}
                                    onChange={(e) => setRoleChangeForm({ ...roleChangeForm, reason: e.target.value })}
                                />
                            </div>
                            {roleChangeForm.requestedRole === "doctor" && (
                                <div className="space-y-2">
                                    <Label htmlFor="qualifications">Medical Qualifications</Label>
                                    <Textarea
                                        id="qualifications"
                                        placeholder="List your medical qualifications, registration number, etc."
                                        className="min-h-[100px]"
                                        value={roleChangeForm.qualifications}
                                        onChange={(e) => setRoleChangeForm({ ...roleChangeForm, qualifications: e.target.value })}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Note: You'll need to upload verification documents after approval.
                                    </p>
                                </div>
                            )}
                            <Button onClick={() => handleSubmit("role-change")} disabled={isSubmitting || !roleChangeForm.requestedRole || !roleChangeForm.reason}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                <Send className="mr-2 h-4 w-4" />
                                Submit Request
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Technical Support */}
                <TabsContent value="technical-support">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <AlertCircle className="h-5 w-5" />
                                Technical Support
                            </CardTitle>
                            <CardDescription>
                                Report bugs, errors, or technical issues
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="issue-type">Issue Type</Label>
                                <Select value={technicalSupportForm.issueType} onValueChange={(value) => setTechnicalSupportForm({ ...technicalSupportForm, issueType: value })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select issue type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="bug">Bug/Error</SelectItem>
                                        <SelectItem value="performance">Performance Issue</SelectItem>
                                        <SelectItem value="feature">Feature Not Working</SelectItem>
                                        <SelectItem value="login">Login/Authentication</SelectItem>
                                        <SelectItem value="other">Other Technical Issue</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="priority">Priority</Label>
                                <Select value={technicalSupportForm.priority} onValueChange={(value) => setTechnicalSupportForm({ ...technicalSupportForm, priority: value })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select priority" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Low - Minor inconvenience</SelectItem>
                                        <SelectItem value="medium">Medium - Affects functionality</SelectItem>
                                        <SelectItem value="high">High - Cannot use feature</SelectItem>
                                        <SelectItem value="critical">Critical - Cannot use app</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="issue-description">Issue Description</Label>
                                <Textarea
                                    id="issue-description"
                                    placeholder="Describe the issue in detail..."
                                    className="min-h-[100px]"
                                    value={technicalSupportForm.description}
                                    onChange={(e) => setTechnicalSupportForm({ ...technicalSupportForm, description: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="steps-to-reproduce">Steps to Reproduce</Label>
                                <Textarea
                                    id="steps-to-reproduce"
                                    placeholder="1. Go to...&#10;2. Click on...&#10;3. See error..."
                                    className="min-h-[100px]"
                                    value={technicalSupportForm.stepsToReproduce}
                                    onChange={(e) => setTechnicalSupportForm({ ...technicalSupportForm, stepsToReproduce: e.target.value })}
                                />
                            </div>
                            <Button onClick={() => handleSubmit("technical-support")} disabled={isSubmitting || !technicalSupportForm.issueType || !technicalSupportForm.description}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                <Send className="mr-2 h-4 w-4" />
                                Submit Ticket
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Feedback */}
                <TabsContent value="feedback">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Lightbulb className="h-5 w-5" />
                                Feedback & Suggestions
                            </CardTitle>
                            <CardDescription>
                                Help us improve DermiAssist-AI with your feedback
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="feedback-category">Category</Label>
                                <Select value={feedbackForm.category} onValueChange={(value) => setFeedbackForm({ ...feedbackForm, category: value })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ui">User Interface</SelectItem>
                                        <SelectItem value="features">Features</SelectItem>
                                        <SelectItem value="performance">Performance</SelectItem>
                                        <SelectItem value="experience">User Experience</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="rating">Overall Rating</Label>
                                <Select value={feedbackForm.rating} onValueChange={(value) => setFeedbackForm({ ...feedbackForm, rating: value })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Rate your experience" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="5">⭐⭐⭐⭐⭐ Excellent</SelectItem>
                                        <SelectItem value="4">⭐⭐⭐⭐ Good</SelectItem>
                                        <SelectItem value="3">⭐⭐⭐ Average</SelectItem>
                                        <SelectItem value="2">⭐⭐ Poor</SelectItem>
                                        <SelectItem value="1">⭐ Very Poor</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="feedback-message">Your Feedback</Label>
                                <Textarea
                                    id="feedback-message"
                                    placeholder="Share your thoughts, experiences, or concerns..."
                                    className="min-h-[100px]"
                                    value={feedbackForm.feedback}
                                    onChange={(e) => setFeedbackForm({ ...feedbackForm, feedback: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="suggestions">Suggestions for Improvement</Label>
                                <Textarea
                                    id="suggestions"
                                    placeholder="What features or improvements would you like to see?"
                                    className="min-h-[100px]"
                                    value={feedbackForm.suggestions}
                                    onChange={(e) => setFeedbackForm({ ...feedbackForm, suggestions: e.target.value })}
                                />
                            </div>
                            <Button onClick={() => handleSubmit("feedback")} disabled={isSubmitting || !feedbackForm.feedback}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                <Send className="mr-2 h-4 w-4" />
                                Submit Feedback
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Contact Information */}
            <Card className="mt-8">
                <CardHeader>
                    <CardTitle>Other Ways to Reach Us</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <h3 className="font-semibold flex items-center gap-2">
                                <Mail className="h-4 w-4" />
                                Email Support
                            </h3>
                            <p className="text-sm text-muted-foreground">support@dermiassist.ai</p>
                            <p className="text-xs text-muted-foreground">Response time: 24-48 hours</p>
                        </div>
                        <div className="space-y-2">
                            <h3 className="font-semibold flex items-center gap-2">
                                <MessageSquare className="h-4 w-4" />
                                Live Chat
                            </h3>
                            <p className="text-sm text-muted-foreground">Available Mon-Fri, 9 AM - 6 PM IST</p>
                            <Button variant="outline" size="sm" disabled>
                                Start Chat (Coming Soon)
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
