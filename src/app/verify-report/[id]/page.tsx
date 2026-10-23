import React from 'react';
import crypto from 'crypto';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ShieldCheck, ShieldAlert, Cpu, ArrowLeft, FileText } from 'lucide-react';
import { Logo } from '@/components/logo';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

interface VerifyReportPageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ sig?: string }>;
}

interface VerificationSummaryRow {
    found: boolean;
    condition_name: string | null;
    review_status: string | null;
    reviewer_name: string | null;
    reviewer_badge: string | null;
    report_date: string | null;
    reviewed_at: string | null;
    stored_signature: string | null;
}

interface VerificationResult {
    verified: boolean;
    reason: string;
    summary: VerificationSummaryRow | null;
}

/**
 * Recompute the expected HMAC exactly as `src/lib/case-review-actions.ts`
 * computed it at release time (`${analysisId}:${reviewStatus}:${reviewedAt}`),
 * and compare against the stored signature using a constant-time comparison
 * to avoid a timing side-channel on the verification endpoint.
 */
function verifySignature(
    analysisId: string,
    reviewStatus: string,
    reviewedAtIso: string,
    storedSignatureHex: string
): boolean {
    const secret = process.env.REPORT_SIGNING_SECRET;
    if (!secret) {
        logger.error('verify_report.missing_secret', { analysisId });
        return false;
    }

    const expected = crypto
        .createHmac('sha256', secret)
        .update(`${analysisId}:${reviewStatus}:${reviewedAtIso}`)
        .digest('hex');

    const expectedBuf = Buffer.from(expected, 'hex');
    const storedBuf = Buffer.from(storedSignatureHex, 'hex');

    // timingSafeEqual throws if buffer lengths differ — treat that as "not equal"
    // rather than letting it bubble up as an unhandled error.
    if (expectedBuf.length !== storedBuf.length) {
        return false;
    }

    return crypto.timingSafeEqual(expectedBuf, storedBuf);
}

async function verifyReport(analysisId: string, sig: string | undefined): Promise<VerificationResult> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(analysisId)
        || !sig || !/^[0-9a-f]{64}$/i.test(sig)) {
        return { verified: false, reason: 'A valid report identifier and verification signature are required.', summary: null };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
        .rpc('get_report_verification_summary', { p_analysis_id: analysisId, p_signature: sig })
        .maybeSingle();

    if (error) {
        logger.error('verify_report.rpc_failed', { analysisId, error: error.message });
        return { verified: false, reason: 'Verification lookup failed.', summary: null };
    }

    const summary = data as VerificationSummaryRow | null;

    if (!summary || !summary.found) {
        return { verified: false, reason: 'No report exists for this identifier.', summary: null };
    }

    if (summary.review_status !== 'released') {
        return { verified: false, reason: 'This report has not been released by a reviewing clinician.', summary };
    }

    if (!summary.stored_signature || !summary.reviewed_at) {
        return { verified: false, reason: 'This report has no verification signature on file.', summary };
    }

    if (!sig) {
        return { verified: false, reason: 'No verification signature was provided in the URL.', summary };
    }

    // The stored signature is authoritative — recompute against it directly
    // rather than trusting the `sig` query param's own bytes, then confirm the
    // caller-supplied `sig` actually matches what's stored (constant-time).
    const signatureMatchesStored = (() => {
        try {
            const storedBuf = Buffer.from(summary.stored_signature!, 'hex');
            const suppliedBuf = Buffer.from(sig, 'hex');
            if (storedBuf.length !== suppliedBuf.length) return false;
            return crypto.timingSafeEqual(storedBuf, suppliedBuf);
        } catch {
            return false;
        }
    })();

    if (!signatureMatchesStored) {
        return { verified: false, reason: 'The verification signature does not match this report.', summary };
    }

    const recomputedMatches = verifySignature(
        analysisId,
        summary.review_status,
        new Date(summary.reviewed_at).toISOString(),
        summary.stored_signature
    );

    if (!recomputedMatches) {
        return { verified: false, reason: 'The stored signature failed cryptographic verification.', summary };
    }

    return { verified: true, reason: 'Signature verified.', summary };
}

export default async function VerifyReportPage({ params, searchParams }: VerifyReportPageProps) {
    const { id } = await params;
    const { sig } = await searchParams;

    const result = await verifyReport(id, sig);
    const { verified, summary } = result;

    return (
        <div className="min-h-screen bg-muted/20 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto space-y-6">

                {/* Header Logo */}
                <div className="flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <Logo className="h-8 w-8" showText={false} />
                        <span className="font-bold text-xl font-headline">DermiAssist-AI</span>
                    </Link>
                    {verified ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 flex items-center gap-1.5 py-1 px-3">
                            <ShieldCheck className="h-4 w-4 text-emerald-500" />
                            Cryptographically Verified
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 flex items-center gap-1.5 py-1 px-3">
                            <ShieldAlert className="h-4 w-4 text-destructive" />
                            Invalid or Not Found
                        </Badge>
                    )}
                </div>

                {/* Verification Card */}
                <Card className="border shadow-lg">
                    <CardHeader className="bg-card border-b pb-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <CardTitle className="text-2xl font-bold font-headline flex items-center gap-2 text-foreground">
                                    {verified ? (
                                        <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                                    ) : (
                                        <ShieldAlert className="h-6 w-6 text-destructive" />
                                    )}
                                    {verified ? 'Authentic Clinical Assessment Report' : 'Report Could Not Be Verified'}
                                </CardTitle>
                                <CardDescription className="mt-1">
                                    {verified
                                        ? 'This official digital record was generated by the DermiAssist-AI Multi-Agent Diagnostic Engine and digitally signed by the reviewing clinician.'
                                        : result.reason}
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">

                        {/* Certificate Details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/40 p-4 rounded-lg border">
                            <div>
                                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Report Identifier</span>
                                <p className="font-mono text-sm font-bold text-foreground mt-0.5">{id}</p>
                            </div>
                            <div>
                                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Verification Status</span>
                                <p className={`text-sm font-semibold flex items-center gap-1 mt-0.5 ${verified ? 'text-emerald-600' : 'text-destructive'}`}>
                                    {verified ? '✓ HMAC-SHA256 Signature Valid' : '✗ Signature Not Verified'}
                                </p>
                            </div>
                            {verified && summary?.condition_name && (
                                <div>
                                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Clinical Classification</span>
                                    <p className="text-sm font-bold text-primary mt-0.5">{summary.condition_name}</p>
                                </div>
                            )}
                            {verified && summary?.reviewer_name && (
                                <div>
                                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Reviewing Clinician</span>
                                    <p className="text-sm text-foreground mt-0.5">
                                        {summary.reviewer_name}{summary.reviewer_badge ? ` · ${summary.reviewer_badge}` : ''}
                                    </p>
                                </div>
                            )}
                            {verified && summary?.reviewed_at && (
                                <div>
                                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Released On</span>
                                    <p className="text-sm text-foreground mt-0.5">
                                        {new Date(summary.reviewed_at).toLocaleString()}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* AI Governance & Notice */}
                        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
                            <div className="flex items-center gap-2 font-semibold text-sm text-primary">
                                <Cpu className="h-4 w-4" />
                                AI Model Claims, Intended Use & Limitations
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                DermiAssist-AI generates preliminary assistive triage assessments. The diagnostic probabilities and morphological findings contained in this document reflect optical pattern recognition and medical knowledge retrieval. They do not constitute a replacement for professional clinical judgment, histology, or tissue biopsy.
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-4 border-t">
                            <Button variant="outline" asChild size="sm">
                                <Link href="/login" className="flex items-center gap-2">
                                    <ArrowLeft className="h-4 w-4" />
                                    Back to Portal
                                </Link>
                            </Button>
                            <Button asChild size="sm" className="bg-primary text-primary-foreground">
                                <Link href="/project-details" className="flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    View Architecture & Compliance
                                </Link>
                            </Button>
                        </div>

                    </CardContent>
                </Card>

                {/* Footer Note */}
                <p className="text-center text-xs text-muted-foreground">
                    © {new Date().getFullYear()} DermiAssist-AI • Enterprise Clinical Decision Support System
                </p>

            </div>
        </div>
    );
}
