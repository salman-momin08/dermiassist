"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { Loader2, MessageSquare, UserCog, AlertCircle, Lightbulb, CheckCircle, XCircle, Eye, Clock } from "lucide-react"
import { format } from "date-fns"
import { useAuth } from "@/hooks/use-auth"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Upload, FileText, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { uploadFile, validateDocumentUpload, deleteFile } from "@/lib/actions"

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

export default function MyRequestsPage() {
    const { user } = useAuth()
    const { toast } = useToast()
    const [requests, setRequests] = useState<ContactRequest[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedRequest, setSelectedRequest] = useState<ContactRequest | null>(null)
    const [activeTab, setActiveTab] = useState<string>("all")

    useEffect(() => {
        if (!user) return
        fetchRequests()

        // Subscribe to real-time updates
        const supabase = createClient()
        const channel = supabase
            .channel('user-requests')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'contact_requests',
                filter: `user_id=eq.${user.id}`
            }, () => {
                fetchRequests()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [user])

    const fetchRequests = async () => {
        if (!user) return
        const supabase = createClient()
        setIsLoading(true)

        const { data, error } = await supabase
            .from('contact_requests')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

        if (error) {
            toast({ title: "Error", description: "Could not fetch requests.", variant: "destructive" })
        } else {
            setRequests(data as ContactRequest[])
        }
        setIsLoading(false)
    }

    const getRequestIcon = (type: RequestType) => {
        switch (type) {
            case 'enquiry': return <MessageSquare className="h-4 w-4" />
            case 'role-change': return <UserCog className="h-4 w-4" />
            case 'technical-support': return <AlertCircle className="h-4 w-4" />
            case 'feedback': return <Lightbulb className="h-4 w-4" />
        }
    }

    const getStatusBadge = (status: string, hasDocuments?: boolean) => {
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
                return <Badge variant="default" className="flex items-center gap-1 bg-indigo-600 w-fit"><CheckCircle className="h-3 w-3" />Uploaded - Verifying</Badge>
            default:
                return <Badge variant="outline" className="w-fit">{status}</Badge>
        }
    }

    const handleUploadDocs = async (requestId: string, currentData: any) => {
        const fileInput1 = document.getElementById('file-registration') as HTMLInputElement;
        const fileInput2 = document.getElementById('file-degree') as HTMLInputElement;
        const fileInput3 = document.getElementById('file-id') as HTMLInputElement;

        // Validate all files are selected before starting
        if (!fileInput1?.files?.length || !fileInput2?.files?.length || !fileInput3?.files?.length) {
            toast({
                title: "Missing Files",
                description: "Please select all 3 required documents before submitting.",
                variant: "destructive"
            });
            return;
        }

        setIsLoading(true);
        const supabase = createClient(); // Use client-side Supabase for proper RLS
        const uploadedPublicIds: string[] = []; // Track for rollback

        try {
            // Step 1: Upload all files to Cloudinary
            const documents: Record<string, { url: string; publicId: string }> = {};
            const files = [
                { key: 'medicalRegistration', file: fileInput1.files[0], label: 'Medical Registration' },
                { key: 'degreeCertificate', file: fileInput2.files[0], label: 'Degree Certificate' },
                { key: 'governmentId', file: fileInput3.files[0], label: 'Government ID' },
            ];

            for (const item of files) {
                const formData = new FormData();
                formData.append('file', item.file);

                const result = await uploadFile(formData, undefined, { folder: 'verification-docs' });

                if (!result.success || !result.url || !result.publicId) {
                    throw new Error(`Failed to upload ${item.label}: ${result.message || 'Unknown error'}`);
                }

                documents[item.key] = {
                    url: result.url,
                    publicId: result.publicId
                };
                uploadedPublicIds.push(result.publicId);
            }

            // Step 2: Validate all documents
            const validationResult = await validateDocumentUpload(documents);

            if (!validationResult.success) {
                throw new Error(`Document validation failed: ${validationResult.message}`);
            }

            // Step 3: Fetch current request data to merge properly
            const { data: currentRequest, error: fetchError } = await supabase
                .from('contact_requests')
                .select('data, status, updated_at')
                .eq('id', requestId)
                .single();

            if (fetchError) {
                throw new Error(`Failed to fetch request: ${fetchError.message}`);
            }

            // Verify request is in correct status
            if (currentRequest.status !== 'approved_for_docs') {
                throw new Error(`Request is not in the correct status for document upload. Current status: ${currentRequest.status}`);
            }

            // Step 4: Prepare updated data with documents and timestamp
            const documentsWithTimestamp = {
                ...documents,
                submitted_at: new Date().toISOString()
            };

            const updatedData = {
                ...currentRequest.data,
                documents: documentsWithTimestamp
            };

            // Step 5: Update database with client-side Supabase (respects RLS)
            const { error: updateError } = await supabase
                .from('contact_requests')
                .update({
                    data: updatedData,
                    status: 'verification_pending',
                    updated_at: new Date().toISOString()
                })
                .eq('id', requestId)
                .eq('updated_at', currentRequest.updated_at); // Optimistic locking

            if (updateError) {
                // Check if it's an RLS policy error
                if (updateError.code === '42501' || updateError.message.includes('policy')) {
                    throw new Error('Permission denied. Please ensure you are logged in and have access to update this request.');
                }

                // Check if it's a concurrent update
                if (updateError.code === '23505' || updateError.message.includes('updated_at')) {
                    throw new Error('This request was modified by another process. Please refresh and try again.');
                }

                throw new Error(`Database update failed: ${updateError.message}`);
            }

            // Step 6: Refresh requests to show updated status
            await fetchRequests();

            toast({
                title: "Documents Uploaded Successfully! ✓",
                description: `All 3 documents have been submitted for verification. Your request status has been updated to "Verifying".`
            });

            setSelectedRequest(null);

        } catch (error: any) {
            // Rollback: Delete uploaded files from Cloudinary
            if (uploadedPublicIds.length > 0) {
                for (const publicId of uploadedPublicIds) {
                    try {
                        await deleteFile(publicId);
                    } catch (deleteError) {
                        // ignore delete errors on rollback
                    }
                }
            }

            // User-friendly error messages
            let errorTitle = "Upload Failed";
            let errorDescription = error.message;

            if (error.message.includes('network') || error.message.includes('fetch')) {
                errorTitle = "Network Error";
                errorDescription = "Please check your internet connection and try again.";
            } else if (error.message.includes('Permission denied')) {
                errorTitle = "Permission Error";
                errorDescription = "You don't have permission to upload documents. Please contact support.";
            } else if (error.message.includes('concurrent') || error.message.includes('modified')) {
                errorTitle = "Conflict Error";
                errorDescription = "This request was modified. Please refresh the page and try again.";
            }

            toast({
                title: errorTitle,
                description: errorDescription,
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    }

    const filteredRequests = activeTab === "all"
        ? requests
        : requests.filter(r => r.status === activeTab)

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

                        {request.status === 'approved_for_docs' && (
                            <div className="pt-4 border-t space-y-4">
                                <div className="bg-blue-50 p-3 rounded-md border border-blue-100 dark:bg-blue-950/30 dark:border-blue-800">
                                    <h4 className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                                        <Upload className="h-4 w-4" /> Action Required: Upload Documents
                                    </h4>
                                    <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                                        Please upload the following documents to complete your verification.
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <Label htmlFor="file-registration">Medical Registration Certificate</Label>
                                        <Input id="file-registration" type="file" accept=".pdf,.jpg,.jpeg,.png" />
                                    </div>
                                    <div>
                                        <Label htmlFor="file-degree">Degree Certificate</Label>
                                        <Input id="file-degree" type="file" accept=".pdf,.jpg,.jpeg,.png" />
                                    </div>
                                    <div>
                                        <Label htmlFor="file-id">Government ID</Label>
                                        <Input id="file-id" type="file" accept=".pdf,.jpg,.jpeg,.png" />
                                    </div>
                                    <Button className="w-full" onClick={() => handleUploadDocs(request.id, request.data)} disabled={isLoading}>
                                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Submit Documents
                                    </Button>
                                </div>
                            </div>
                        )}

                        {data.documents && (
                            <div className="pt-4 border-t">
                                <Label className="text-sm font-semibold text-green-600 flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4" /> Documents Submitted Successfully
                                </Label>
                                {data.documents.submitted_at && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Submitted on {format(new Date(data.documents.submitted_at), 'PPp')}
                                    </p>
                                )}
                                <p className="text-sm text-muted-foreground mt-2">
                                    Your documents are currently under review by our admin team.
                                </p>
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
        <div className="container mx-auto p-4 md:p-8 max-w-6xl">
            <div className="space-y-2 mb-8">
                <h1 className="text-3xl font-bold tracking-tight font-headline">My Requests</h1>
                <p className="text-muted-foreground">
                    Track the status of your contact requests and view admin responses.
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto mb-4">
                    <TabsTrigger value="all" className="truncate">All ({requests.length})</TabsTrigger>
                    <TabsTrigger value="pending" className="truncate">Pending ({requests.filter(r => r.status === 'pending').length})</TabsTrigger>
                    <TabsTrigger value="approved" className="truncate">Approved ({requests.filter(r => r.status === 'approved').length})</TabsTrigger>
                    <TabsTrigger value="rejected" className="truncate">Rejected ({requests.filter(r => r.status === 'rejected').length})</TabsTrigger>
                </TabsList>

                <Card>
                    <CardHeader>
                        <CardTitle>Your Requests</CardTitle>
                        <CardDescription>
                            {activeTab === "all" ? "All your contact requests" : `${activeTab} requests`}
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
                                                    <div className="flex items-center gap-2">
                                                        {getRequestIcon(request.request_type)}
                                                        <span className="capitalize">{request.request_type.replace('-', ' ')}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{format(new Date(request.created_at), 'PPp')}</TableCell>
                                                <TableCell>{getStatusBadge(request.status, !!request.data?.documents)}</TableCell>
                                                <TableCell className="text-right">
                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => setSelectedRequest(request)}
                                                            >
                                                                <Eye className="h-4 w-4 mr-2" />
                                                                View Details
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent className="max-w-2xl">
                                                            <DialogHeader>
                                                                <DialogTitle className="flex items-center gap-2">
                                                                    {getRequestIcon(request.request_type)}
                                                                    {request.request_type.replace('-', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} Request
                                                                </DialogTitle>
                                                                <DialogDescription>
                                                                    Submitted on {format(new Date(request.created_at), 'PPp')}
                                                                </DialogDescription>
                                                            </DialogHeader>
                                                            <div className="max-h-[70vh] overflow-y-auto pr-4">
                                                                <div className="space-y-6">
                                                                    <div>
                                                                        <Label className="text-sm font-semibold">Status</Label>
                                                                        <div className="mt-1">{getStatusBadge(request.status, !!request.data?.documents)}</div>
                                                                    </div>

                                                                    {renderRequestDetails(request)}

                                                                    {request.admin_notes && (
                                                                        <div className="border-t pt-4">
                                                                            <Label className="text-sm font-semibold">Admin Response</Label>
                                                                            <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-2 bg-muted p-3 rounded-md">
                                                                                {request.admin_notes}
                                                                            </p>
                                                                            {request.reviewed_at && (
                                                                                <p className="text-xs text-muted-foreground mt-2">
                                                                                    Reviewed on {format(new Date(request.reviewed_at), 'PPp')}
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {!request.admin_notes && request.status === 'pending' && (
                                                                        <div className="border-t pt-4">
                                                                            <p className="text-sm text-muted-foreground">
                                                                                Your request is pending review. You'll be notified once an admin responds.
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </DialogContent>
                                                    </Dialog>
                                                </TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
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
