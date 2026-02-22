"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { Loader2, MessageSquare, UserCog, AlertCircle, Lightbulb, CheckCircle, XCircle, Eye, Clock, FileText, Upload } from "lucide-react"
import { format } from "date-fns"
import { useAuth } from "@/hooks/use-auth"
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
import { ScrollArea } from "@/components/ui/scroll-area"

type RequestType = "role-change" | "enquiry" | "technical-support" | "feedback"

type ContactRequest = {
    id: string
    user_id: string
    user_name: string
    user_email: string
    request_type: RequestType
    status: 'pending' | 'approved' | 'rejected' | 'approved_for_docs' | 'verification_pending'
    data: any
    admin_notes?: string
    reviewed_by?: string
    reviewed_at?: string
    created_at: string
    updated_at: string
}

export default function AdminRequestsPage() {
    const { user } = useAuth()
    const { toast } = useToast()
    const [requests, setRequests] = useState<ContactRequest[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedRequest, setSelectedRequest] = useState<ContactRequest | null>(null)
    const [adminNotes, setAdminNotes] = useState("")
    const [isProcessing, setIsProcessing] = useState(false)
    const [activeTab, setActiveTab] = useState<string>("all")

    useEffect(() => {
        if (!user) return
        fetchRequests()

        // Subscribe to real-time updates
        const supabase = createClient()
        const channel = supabase
            .channel('admin-requests')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'contact_requests'
            }, () => {
                fetchRequests()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [user])

    const fetchRequests = async () => {
        const supabase = createClient()
        setIsLoading(true)

        try {
            // Debug: Check current user and session
            const { data: { user }, error: userError } = await supabase.auth.getUser()

            if (userError) {
                toast({
                    title: "Authentication Error",
                    description: "You are not logged in. Please log in again.",
                    variant: "destructive"
                })
                setIsLoading(false)
                return
            }

            if (!user) {
                toast({
                    title: "Not Authenticated",
                    description: "Please log in to access this page.",
                    variant: "destructive"
                })
                setIsLoading(false)
                return
            }


            // Debug: Check user's profile and role
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('id, email, role')
                .eq('id', user.id)
                .single()

            if (profileError) {
                toast({
                    title: "Profile Error",
                    description: "Could not fetch your profile. Please refresh the page.",
                    variant: "destructive"
                })
                setIsLoading(false)
                return
            }


            if (profile?.role !== 'admin') {
                toast({
                    title: "Access Denied",
                    description: "You do not have admin permissions.",
                    variant: "destructive"
                })
                setIsLoading(false)
                return
            }


            // Fetch contact requests
            const { data, error } = await supabase
                .from('contact_requests')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) {
                toast({
                    title: "Error Fetching Requests",
                    description: error.message || "Could not fetch requests. Check console for details.",
                    variant: "destructive"
                })
            } else {
                setRequests(data as ContactRequest[])
            }
        } catch (err) {
            toast({
                title: "Unexpected Error",
                description: "An unexpected error occurred. Please refresh the page.",
                variant: "destructive"
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleApprove = async (request: ContactRequest) => {
        setIsProcessing(true)
        const supabase = createClient()

        try {
            // For role-change, this is just the INITIAL approval
            if (request.request_type === 'role-change') {
                const { error: requestError } = await supabase
                    .from('contact_requests')
                    .update({
                        status: 'approved_for_docs',
                        admin_notes: adminNotes,
                        reviewed_by: user?.id,
                        reviewed_at: new Date().toISOString()
                    })
                    .eq('id', request.id)

                if (requestError) throw requestError

                toast({
                    title: "Initial Approval Granted",
                    description: "User can now upload verification documents.",
                })
            } else {
                // For other requests, handle as full approval
                const { error: requestError } = await supabase
                    .from('contact_requests')
                    .update({
                        status: 'approved',
                        admin_notes: adminNotes,
                        reviewed_by: user?.id,
                        reviewed_at: new Date().toISOString()
                    })
                    .eq('id', request.id)

                if (requestError) throw requestError

                toast({
                    title: "Request Approved",
                    description: "Request has been approved.",
                })
            }

            setSelectedRequest(null)
            setAdminNotes("")
            fetchRequests()
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Could not approve request.",
                variant: "destructive"
            })
        } finally {
            setIsProcessing(false)
        }
    }

    const handleFinalVerify = async (request: ContactRequest) => {
        setIsProcessing(true)
        const supabase = createClient()

        try {

            if (request.request_type === 'role-change') {
                // Update user role in profiles table

                const { data: roleUpdateData, error: roleError } = await supabase
                    .from('profiles')
                    .update({
                        role: request.data.requestedRole,
                        verified: request.data.requestedRole === 'doctor' ? true : undefined,
                        verification_pending: request.data.requestedRole === 'doctor' ? false : undefined
                    })
                    .eq('id', request.user_id)
                    .select('id, role')

                if (roleError) {
                    throw new Error(`Failed to update user role: ${roleError.message}`);
                }

                if (!roleUpdateData || roleUpdateData.length === 0) {
                    throw new Error('User profile not found. Cannot update role.');
                }


                // CRITICAL: Invalidate Redis cache so user gets fresh role data
                try {
                    const { invalidateUserProfileCache } = await import('@/lib/redis/user-cache');
                    await invalidateUserProfileCache(request.user_id);
                } catch (cacheError) {
                    // Don't throw - cache invalidation failure shouldn't block the role change
                }
            }

            // Update request status to approved
            const { error: requestError } = await supabase
                .from('contact_requests')
                .update({
                    status: 'approved',
                    admin_notes: adminNotes,
                    reviewed_by: user?.id,
                    reviewed_at: new Date().toISOString()
                })
                .eq('id', request.id)

            if (requestError) {
                throw new Error(`Failed to update request status: ${requestError.message}`);
            }


            toast({
                title: "Verified & Approved ✓",
                description: `User role has been successfully updated to ${request.data.requestedRole}.`,
            })

            // Notify user via Novu (fire-and-forget)
            fetch('/api/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workflowId: 'role-change-approved',
                    subscriberId: request.user_id,
                    email: request.user_email,
                    firstName: request.user_name?.split(' ')[0],
                    payload: {},
                }),
            }).catch(() => { });

            setSelectedRequest(null)
            setAdminNotes("")
            fetchRequests()
        } catch (error: any) {
            toast({
                title: "Verification Failed",
                description: error.message || "Could not verify request. Check console for details.",
                variant: "destructive"
            })
        } finally {
            setIsProcessing(false)
        }
    }

    const handleReject = async (request: ContactRequest) => {
        setIsProcessing(true)
        const supabase = createClient()

        try {
            const { error } = await supabase
                .from('contact_requests')
                .update({
                    status: 'rejected',
                    admin_notes: adminNotes,
                    reviewed_by: user?.id,
                    reviewed_at: new Date().toISOString()
                })
                .eq('id', request.id)

            if (error) throw error

            toast({
                title: "Request Rejected",
                description: "Request has been rejected.",
                variant: "destructive"
            })

            setSelectedRequest(null)
            setAdminNotes("")
            fetchRequests()
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Could not reject request.",
                variant: "destructive"
            })
        } finally {
            setIsProcessing(false)
        }
    }

    const getRequestIcon = (type: RequestType) => {
        switch (type) {
            case 'enquiry': return <MessageSquare className="h-4 w-4" />
            case 'role-change': return <UserCog className="h-4 w-4" />
            case 'technical-support': return <AlertCircle className="h-4 w-4" />
            case 'feedback': return <Lightbulb className="h-4 w-4" />
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return <Badge variant="outline" className="flex items-center gap-1 w-fit"><Clock className="h-3 w-3" />Pending</Badge>
            case 'approved':
                return <Badge variant="default" className="flex items-center gap-1 bg-green-600 w-fit"><CheckCircle className="h-3 w-3" />Approved</Badge>
            case 'rejected':
                return <Badge variant="destructive" className="flex items-center gap-1 w-fit"><XCircle className="h-3 w-3" />Rejected</Badge>
            case 'approved_for_docs':
                return <Badge variant="secondary" className="flex items-center gap-1 w-fit"><Upload className="h-3 w-3" />Awaiting Upload</Badge>
            case 'verification_pending':
                return <Badge variant="default" className="flex items-center gap-1 bg-indigo-600 w-fit"><FileText className="h-3 w-3" />Docs Uploaded - Verify</Badge>
            default:
                return <Badge variant="outline" className="w-fit">{status}</Badge>
        }
    }

    const filteredRequests = activeTab === "all"
        ? requests
        : requests.filter(r => r.request_type === activeTab)

    const renderRequestDetails = (request: ContactRequest) => {
        const data = request.data

        switch (request.request_type) {
            case 'enquiry':
                return (
                    <div className="space-y-3">
                        <div>
                            <Label className="text-sm font-semibold">Category</Label>
                            <p className="text-sm text-muted-foreground capitalize">{data.category || 'N/A'}</p>
                        </div>
                        <div>
                            <Label className="text-sm font-semibold">Subject</Label>
                            <p className="text-sm">{data.subject}</p>
                        </div>
                        <div>
                            <Label className="text-sm font-semibold">Message</Label>
                            <p className="text-sm whitespace-pre-wrap">{data.message}</p>
                        </div>
                    </div>
                )
            case 'role-change':
                return (
                    <div className="space-y-3">
                        <div>
                            <Label className="text-sm font-semibold">Current Role</Label>
                            <p className="text-sm capitalize">{data.currentRole}</p>
                        </div>
                        <div>
                            <Label className="text-sm font-semibold">Requested Role</Label>
                            <p className="text-sm capitalize">{data.requestedRole}</p>
                        </div>
                        <div>
                            <Label className="text-sm font-semibold">Reason</Label>
                            <p className="text-sm whitespace-pre-wrap">{data.reason}</p>
                        </div>
                        {data.qualifications && (
                            <div>
                                <Label className="text-sm font-semibold">Qualifications</Label>
                                <p className="text-sm whitespace-pre-wrap">{data.qualifications}</p>
                            </div>
                        )}
                        {/* Show documents section if documents exist - ALWAYS show regardless of status */}
                        {data.documents && Object.keys(data.documents).filter(k => k !== 'submitted_at').length > 0 && (
                            <div className="pt-4 border-t space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm font-semibold text-green-600 flex items-center gap-2">
                                        <CheckCircle className="h-4 w-4" /> Verification Documents Uploaded
                                    </Label>
                                    <Badge variant="secondary" className="text-xs">
                                        {Object.keys(data.documents).filter(k => k !== 'submitted_at').length} documents
                                    </Badge>
                                </div>
                                {data.documents.submitted_at && (
                                    <p className="text-xs text-muted-foreground mb-2">
                                        Submitted on {format(new Date(data.documents.submitted_at), 'PPp')}
                                    </p>
                                )}
                                <div className="grid gap-2">
                                    {Object.entries(data.documents)
                                        .filter(([key]) => key !== 'submitted_at')
                                        .map(([key, value]: [string, any]) => {
                                            const docUrl = typeof value === 'string' ? value : value?.url;
                                            if (!docUrl) {
                                                return (
                                                    <div key={key} className="flex items-center gap-2 p-2 rounded-md border text-sm bg-yellow-50 dark:bg-yellow-950/20">
                                                        <FileText className="h-4 w-4 text-yellow-600" />
                                                        <span className="capitalize text-yellow-700 dark:text-yellow-400">
                                                            {key.replace(/([A-Z])/g, ' $1').trim()} - URL Missing
                                                        </span>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <a
                                                    key={key}
                                                    href={docUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-2 p-2 rounded-md border text-sm hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-200 text-blue-600 dark:text-blue-400 hover:underline transition-colors"
                                                >
                                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                                    <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                                    <span className="ml-auto text-xs text-muted-foreground">View Document</span>
                                                </a>
                                            )
                                        })}
                                </div>
                            </div>
                        )}
                    </div>
                )
            case 'technical-support':
                return (
                    <div className="space-y-3">
                        <div>
                            <Label className="text-sm font-semibold">Issue Type</Label>
                            <p className="text-sm capitalize">{data.issueType}</p>
                        </div>
                        <div>
                            <Label className="text-sm font-semibold">Priority</Label>
                            <Badge variant={data.priority === 'critical' ? 'destructive' : 'outline'} className="capitalize">
                                {data.priority}
                            </Badge>
                        </div>
                        <div>
                            <Label className="text-sm font-semibold">Description</Label>
                            <p className="text-sm whitespace-pre-wrap">{data.description}</p>
                        </div>
                        {data.stepsToReproduce && (
                            <div>
                                <Label className="text-sm font-semibold">Steps to Reproduce</Label>
                                <p className="text-sm whitespace-pre-wrap">{data.stepsToReproduce}</p>
                            </div>
                        )}
                    </div>
                )
            case 'feedback':
                return (
                    <div className="space-y-3">
                        <div>
                            <Label className="text-sm font-semibold">Category</Label>
                            <p className="text-sm capitalize">{data.category}</p>
                        </div>
                        <div>
                            <Label className="text-sm font-semibold">Rating</Label>
                            <p className="text-sm">{'⭐'.repeat(parseInt(data.rating || '0'))}</p>
                        </div>
                        <div>
                            <Label className="text-sm font-semibold">Feedback</Label>
                            <p className="text-sm whitespace-pre-wrap">{data.feedback}</p>
                        </div>
                        {data.suggestions && (
                            <div>
                                <Label className="text-sm font-semibold">Suggestions</Label>
                                <p className="text-sm whitespace-pre-wrap">{data.suggestions}</p>
                            </div>
                        )}
                    </div>
                )
        }
    }

    if (!user) return null

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="space-y-2 mb-8">
                <h1 className="text-3xl font-bold tracking-tight font-headline">Contact Requests</h1>
                <p className="text-muted-foreground">
                    Review and manage user contact requests and support tickets.
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 h-auto mb-4">
                    <TabsTrigger value="all" className="truncate">All ({requests.length})</TabsTrigger>
                    <TabsTrigger value="enquiry" className="truncate">Enquiries ({requests.filter(r => r.request_type === 'enquiry').length})</TabsTrigger>
                    <TabsTrigger value="role-change" className="truncate">Role Changes ({requests.filter(r => r.request_type === 'role-change').length})</TabsTrigger>
                    <TabsTrigger value="technical-support" className="truncate">Tech Support ({requests.filter(r => r.request_type === 'technical-support').length})</TabsTrigger>
                    <TabsTrigger value="feedback" className="truncate">Feedback ({requests.filter(r => r.request_type === 'feedback').length})</TabsTrigger>
                </TabsList>

                <Card>
                    <CardHeader>
                        <CardTitle>Requests</CardTitle>
                        <CardDescription>
                            {activeTab === "all" ? "All contact requests" : `${activeTab.replace('-', ' ')} requests`}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            <div className="rounded-md border overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>User</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredRequests.length > 0 ? filteredRequests.map(request => (
                                            <TableRow key={request.id}>
                                                <TableCell>
                                                    <div className="font-medium">{request.user_name}</div>
                                                    <div className="text-sm text-muted-foreground">{request.user_email}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        {getRequestIcon(request.request_type)}
                                                        <span className="capitalize">{request.request_type.replace('-', ' ')}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{format(new Date(request.created_at), 'PPp')}</TableCell>
                                                <TableCell>{getStatusBadge(request.status)}</TableCell>
                                                <TableCell className="text-right">
                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => {
                                                                    setSelectedRequest(request)
                                                                    setAdminNotes(request.admin_notes || "")
                                                                }}
                                                            >
                                                                <Eye className="h-4 w-4 mr-2" />
                                                                View
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent className="max-w-2xl">
                                                            <DialogHeader>
                                                                <DialogTitle className="flex items-center gap-2">
                                                                    {getRequestIcon(request.request_type)}
                                                                    {request.request_type.replace('-', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} Request
                                                                </DialogTitle>
                                                                <DialogDescription>
                                                                    From {request.user_name} • {format(new Date(request.created_at), 'PPp')}
                                                                </DialogDescription>
                                                            </DialogHeader>
                                                            <div className="max-h-[70vh] overflow-y-auto pr-4">
                                                                <div className="space-y-6">
                                                                    {renderRequestDetails(request)}

                                                                    {request.status !== 'pending' && request.admin_notes && (
                                                                        <div>
                                                                            <Label className="text-sm font-semibold">Admin Notes</Label>
                                                                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{request.admin_notes}</p>
                                                                        </div>
                                                                    )}

                                                                    {request.status === 'pending' && (
                                                                        <div className="space-y-2">
                                                                            <Label htmlFor="admin-notes">Admin Notes (Optional)</Label>
                                                                            <Textarea
                                                                                id="admin-notes"
                                                                                placeholder="Add notes about this request..."
                                                                                value={adminNotes}
                                                                                onChange={(e) => setAdminNotes(e.target.value)}
                                                                                className="min-h-[100px]"
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {request.status === 'pending' && (
                                                                <DialogFooter className="gap-2">
                                                                    <AlertDialog>
                                                                        <AlertDialogTrigger asChild>
                                                                            <Button variant="destructive" disabled={isProcessing}>
                                                                                <XCircle className="h-4 w-4 mr-2" />
                                                                                Reject
                                                                            </Button>
                                                                        </AlertDialogTrigger>
                                                                        <AlertDialogContent>
                                                                            <AlertDialogHeader>
                                                                                <AlertDialogTitle>Reject Request?</AlertDialogTitle>
                                                                                <AlertDialogDescription>
                                                                                    This will mark the request as rejected. The user will be notified.
                                                                                </AlertDialogDescription>
                                                                            </AlertDialogHeader>
                                                                            <AlertDialogFooter>
                                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                                <AlertDialogAction onClick={() => handleReject(request)} className="bg-destructive hover:bg-destructive/90">
                                                                                    Reject
                                                                                </AlertDialogAction>
                                                                            </AlertDialogFooter>
                                                                        </AlertDialogContent>
                                                                    </AlertDialog>
                                                                    <Button onClick={() => handleApprove(request)} disabled={isProcessing}>
                                                                        {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                                                        <CheckCircle className="h-4 w-4 mr-2" />
                                                                        {request.request_type === 'role-change' ? "Allow Docs Upload" : "Approve"}
                                                                    </Button>
                                                                </DialogFooter>
                                                            )}

                                                            {request.status === 'verification_pending' && (
                                                                <DialogFooter className="gap-2">
                                                                    <AlertDialog>
                                                                        <AlertDialogTrigger asChild>
                                                                            <Button variant="destructive" disabled={isProcessing} size="sm">
                                                                                Reject
                                                                            </Button>
                                                                        </AlertDialogTrigger>
                                                                        <AlertDialogContent>
                                                                            <AlertDialogHeader>
                                                                                <AlertDialogTitle>Reject Verification?</AlertDialogTitle>
                                                                                <AlertDialogDescription>
                                                                                    This will reject the request and the user will have to start over or re-upload.
                                                                                </AlertDialogDescription>
                                                                            </AlertDialogHeader>
                                                                            <AlertDialogFooter>
                                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                                <AlertDialogAction onClick={() => handleReject(request)} className="bg-destructive hover:bg-destructive/90">
                                                                                    Reject
                                                                                </AlertDialogAction>
                                                                            </AlertDialogFooter>
                                                                        </AlertDialogContent>
                                                                    </AlertDialog>
                                                                    <Button onClick={() => handleFinalVerify(request)} disabled={isProcessing} className="bg-indigo-600 hover:bg-indigo-700">
                                                                        {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                                                        <CheckCircle className="h-4 w-4 mr-2" />
                                                                        Verify & Promote
                                                                    </Button>
                                                                </DialogFooter>
                                                            )}
                                                        </DialogContent>
                                                    </Dialog>
                                                </TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                                    No requests found.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </Tabs>
        </div>
    )
}

