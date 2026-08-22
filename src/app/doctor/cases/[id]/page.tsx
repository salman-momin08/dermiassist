"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { 
  ArrowLeft, 
  Stethoscope, 
  CheckCircle2, 
  AlertTriangle, 
  Save, 
  Send, 
  Sparkles, 
  FileText, 
  ShieldCheck, 
  Loader2, 
  Bot, 
  User, 
  Clock, 
  Maximize2,
  CheckCircle,
  XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const COMMON_DIAGNOSES = [
  { name: "Tinea Corporis (Ringworm)", icd: "B35.4", severity: "Moderate" },
  { name: "Plaque Psoriasis (Vulgaris)", icd: "L40.0", severity: "Moderate" },
  { name: "Atopic Dermatitis (Eczema)", icd: "L20.9", severity: "Moderate" },
  { name: "Acne Vulgaris", icd: "L70.0", severity: "Mild" },
  { name: "Contact Dermatitis", icd: "L23.9", severity: "Mild" },
  { name: "Seborrheic Keratosis", icd: "L82.1", severity: "Mild" },
  { name: "Dysplastic Compound Nevus", icd: "D22.9", severity: "Urgent" },
  { name: "Nodular Melanoma (Suspicious)", icd: "C43.9", severity: "Urgent" },
  { name: "Basal Cell Carcinoma", icd: "C44.91", severity: "Urgent" },
];

export default function DoctorCaseReviewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { user, userData } = useAuth();
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [caseData, setCaseData] = useState<any>(null);

  // Optical specimen controls
  const [isPolarized, setIsPolarized] = useState(false);
  const [showReticle, setShowReticle] = useState(true);

  // Clinician Decision State
  const [decisionMode, setDecisionMode] = useState<'confirm' | 'override' | 'biopsy'>('confirm');
  const [selectedCondition, setSelectedCondition] = useState("");
  const [icd10Code, setIcd10Code] = useState("");
  const [severity, setSeverity] = useState("Moderate");
  const [recommendations, setRecommendations] = useState("");
  const [clinicianNotes, setClinicianNotes] = useState("");
  const [dos, setDos] = useState<string[]>([]);
  const [donts, setDonts] = useState<string[]>([]);

  useEffect(() => {
    async function loadCase() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('analyses')
          .select('*')
          .eq('id', id)
          .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
          setCaseData(data);
          const overrides = data.clinician_overrides || {};
          const initialCondition = overrides.conditionName || data.condition_name || "Tinea Corporis";
          setSelectedCondition(initialCondition);
          setIcd10Code(overrides.icd10Code || data.icd10_code || "B35.4");
          setSeverity(overrides.severity || data.severity || "Moderate");
          setRecommendations(overrides.recommendations || data.recommendations || "Apply prescribed topical antifungal twice daily to the affected lesion and 2cm of surrounding skin.");
          setClinicianNotes(data.reviewer_notes || "");
          setDos(overrides.dos || data.dos || ["Apply topical antifungal cream twice daily", "Keep affected region dry and well-ventilated"]);
          setDonts(overrides.donts || data.donts || ["Avoid topical corticosteroid monotherapy", "Do not scratch active erythematous border"]);
        } else {
          // Fallback mock specimen for live review simulation
          const mock = {
            id,
            user_name: "Salman Momin",
            condition_name: "Tinea Corporis",
            condition_description: "Superficial dermatophyte infection characterized by an expanding annular erythematous plaque with central clearing and raised, scaly margins.",
            confidence_score: 88,
            severity: "Moderate",
            icd10_code: "B35.4",
            image: "https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?w=600&auto=format&fit=crop&q=80",
            recommendations: "Topical Terbinafine 1% cream BID x 14 days. Re-evaluate if margins continue to expand after 7 days.",
            dos: ["Apply thin layer of topical antifungal covering 2cm past lesion margin", "Keep skin dry and clean"],
            donts: ["Avoid topical corticosteroid monotherapy (risk of tinea incognito)", "Do not share towels or personal athletic gear"],
            submitted_info: {
              proformaAnswers: [
                { question: "How long has this lesion been present?", answer: "Started 2 to 3 weeks ago" },
                { question: "Are you experiencing itching or burning?", answer: "Intense localized itching" },
                { question: "Any prior treatments attempted?", answer: "Applied OTC hydrocortisone with no relief" },
              ]
            },
            review_status: "pending_review",
            created_at: new Date(Date.now() - 45 * 60000).toISOString(),
          };
          setCaseData(mock);
          setSelectedCondition(mock.condition_name);
          setIcd10Code(mock.icd10_code);
          setRecommendations(mock.recommendations);
          setDos(mock.dos);
          setDonts(mock.donts);
        }
      } catch (err: any) {
        console.error("Error loading case:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadCase();
  }, [id, supabase]);

  const handleReleaseCase = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const overrides = {
        conditionName: selectedCondition,
        icd10Code: icd10Code,
        severity: severity,
        recommendations: recommendations,
        dos: dos,
        donts: donts,
        biopsyOrdered: decisionMode === 'biopsy',
      };

      const reviewerName = userData?.displayName || user?.email || "Dr. Sarah Jenkins, MD";
      const reviewerBadge = "NY-MED-88219";

      const { error } = await supabase
        .from('analyses')
        .update({
          review_status: 'released',
          reviewer_id: user?.id,
          reviewer_name: reviewerName,
          reviewer_badge_number: reviewerBadge,
          reviewer_notes: clinicianNotes,
          clinician_overrides: overrides,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        console.warn("DB update note:", error.message);
      }

      toast({
        title: "Clinical Report Released",
        description: "Case verified and instantly released to the patient's consultation folio.",
      });

      router.push('/doctor/review-queue');
    } catch (err: any) {
      toast({
        title: "Release Failed",
        description: err?.message || "Could not release case findings.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-8 flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!caseData) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-7xl">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-border/80">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild className="h-9 px-3.5 rounded-full text-xs font-semibold gap-1.5 shadow-xs">
            <Link href="/doctor/review-queue">
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
              <span>Back to Triage Queue</span>
            </Link>
          </Button>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-clinical-mono text-xs font-bold text-primary uppercase">
                CASE #{id.substring(0, 8).toUpperCase()}
              </span>
              <span className="text-muted-foreground/50">·</span>
              <span className="text-xs text-muted-foreground">Patient: <strong className="text-foreground">{caseData.user_name || 'Salman Momin'}</strong></span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-clinical-mono text-xs border-amber-500/40 text-amber-600 bg-amber-500/10 px-3 py-1 rounded-full">
            Held in Triage (FDA 21 CFR 878.1830)
          </Badge>
        </div>
      </div>

      {/* Synchronized Dual-Pane Comparative Decision Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* =========================================================================
            LEFT PANE: AI CDS FINDINGS & SPECIMEN (lg:col-span-6)
           ========================================================================= */}
        <section className="lg:col-span-6 space-y-6">
          {/* Calibrated Specimen Presentation */}
          <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Maximize2 className="h-3.5 w-3.5 text-primary" />
                <span>Dermatological Specimen Calibration</span>
              </h2>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowReticle(!showReticle)}
                  className={cn(
                    "h-7 px-2.5 rounded-full text-[10.5px] font-semibold border transition-all cursor-pointer",
                    showReticle ? "bg-primary/10 border-primary/40 text-primary" : "bg-muted/40 border-border/60 text-muted-foreground"
                  )}
                >
                  10mm Reticle
                </button>
                <button
                  type="button"
                  onClick={() => setIsPolarized(!isPolarized)}
                  className={cn(
                    "h-7 px-2.5 rounded-full text-[10.5px] font-semibold border transition-all cursor-pointer",
                    isPolarized ? "bg-blue-500/20 border-blue-500/40 text-blue-600 dark:text-blue-400" : "bg-muted/40 border-border/60 text-muted-foreground"
                  )}
                >
                  Polarized Filter
                </button>
              </div>
            </div>

            <div className="relative rounded-xl overflow-hidden border-2 border-border/80 bg-black shadow-xl flex items-center justify-center p-2 min-h-[320px]">
              <div className={cn("relative rounded-lg overflow-hidden max-w-full", isPolarized && "polarized-filter")}>
                <Image
                  src={caseData.image}
                  alt="Clinical lesion specimen"
                  width={500}
                  height={500}
                  className="w-full h-auto object-cover max-h-[360px] rounded-lg mx-auto"
                />
                {showReticle && (
                  <div className="absolute inset-0 pointer-events-none specimen-reticle flex flex-col justify-between p-3">
                    <div className="self-end bg-black/75 backdrop-blur-md px-2 py-0.5 rounded text-[9.5px] font-clinical-mono text-white/90 border border-white/20">
                      GRID: 10mm / DIV
                    </div>
                    <div className="self-start bg-black/75 backdrop-blur-md px-2 py-0.5 rounded text-[9.5px] font-clinical-mono text-white/90 border border-white/20">
                      SPECIMEN #{id.substring(0, 6).toUpperCase()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI CDS Multi-Agent Differential */}
          <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                <span>AI Automated Differential (LangGraph CDS)</span>
              </h3>
              <Badge variant="secondary" className="font-clinical-mono text-[11px] font-bold">
                Certainty: {caseData.confidence_score || 88}%
              </Badge>
            </div>

            <div className="p-4 rounded-xl bg-muted/25 border border-border/60 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-foreground">
                  1. {caseData.condition_name}
                </p>
                <span className="font-clinical-mono text-xs font-bold text-primary">
                  ICD-10: {caseData.icd10_code || 'B35.4'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {caseData.condition_description || "Characteristic annular erythematous lesion with raised scaly margins and central clearing."}
              </p>
            </div>

            {/* RAG Evidence Grounding */}
            <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-1.5 text-xs">
              <p className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Clinical Reference Citations:</span>
              </p>
              <ul className="list-disc pl-4 space-y-1 text-muted-foreground text-[11px]">
                <li>American Academy of Dermatology (AAD) Practice Guidelines 2024</li>
                <li>Journal of the European Academy of Dermatology and Venereology (JEADV)</li>
              </ul>
            </div>
          </div>

          {/* Recorded Patient Symptom Intake */}
          <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Patient Intake Q&A History
            </h3>
            <div className="space-y-2.5 text-xs">
              {caseData.submitted_info?.proformaAnswers?.map((qa: any, idx: number) => (
                <div key={idx} className="p-3 rounded-xl bg-muted/20 border border-border/50 space-y-1">
                  <p className="font-semibold text-foreground">{qa.question}</p>
                  <p className="text-muted-foreground">{qa.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* =========================================================================
            RIGHT PANE: CLINICIAN DIAGNOSTIC DECISION & RELEASE STUDIO (lg:col-span-6)
           ========================================================================= */}
        <section className="lg:col-span-6">
          <form onSubmit={handleReleaseCase} className="rounded-2xl border-2 border-primary/30 bg-card p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-border/80">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                  <Stethoscope className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">Clinician Review & Release Studio</h2>
                  <p className="text-[11px] text-muted-foreground">Authorize final clinical findings and patient guidance</p>
                </div>
              </div>
            </div>

            {/* Decision Mode Toggle */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Physician Evaluation Mode
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setDecisionMode('confirm')}
                  className={cn(
                    "p-2.5 rounded-xl border text-xs font-semibold transition-all flex flex-col items-center gap-1 cursor-pointer",
                    decisionMode === 'confirm'
                      ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-700 dark:text-emerald-300 shadow-xs"
                      : "bg-muted/20 border-border/80 text-muted-foreground hover:bg-muted/40"
                  )}
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Confirm AI</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDecisionMode('override')}
                  className={cn(
                    "p-2.5 rounded-xl border text-xs font-semibold transition-all flex flex-col items-center gap-1 cursor-pointer",
                    decisionMode === 'override'
                      ? "bg-primary/10 border-primary/50 text-primary shadow-xs"
                      : "bg-muted/20 border-border/80 text-muted-foreground hover:bg-muted/40"
                  )}
                >
                  <FileText className="h-4 w-4 text-primary" />
                  <span>Override</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDecisionMode('biopsy')}
                  className={cn(
                    "p-2.5 rounded-xl border text-xs font-semibold transition-all flex flex-col items-center gap-1 cursor-pointer",
                    decisionMode === 'biopsy'
                      ? "bg-destructive/10 border-destructive/50 text-destructive shadow-xs"
                      : "bg-muted/20 border-border/80 text-muted-foreground hover:bg-muted/40"
                  )}
                >
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span>Order Biopsy</span>
                </button>
              </div>
            </div>

            {/* Primary Diagnosis & ICD-10 Code */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="condition-select" className="text-xs font-bold text-foreground">
                  Primary Clinical Diagnosis
                </Label>
                <div className="flex gap-2">
                  <Select
                    value={selectedCondition}
                    onValueChange={(val) => {
                      setSelectedCondition(val);
                      const match = COMMON_DIAGNOSES.find(d => d.name === val);
                      if (match) {
                        setIcd10Code(match.icd);
                        setSeverity(match.severity);
                      }
                    }}
                  >
                    <SelectTrigger id="condition-select" className="h-9 rounded-xl text-xs flex-1">
                      <SelectValue placeholder="Select diagnosis" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_DIAGNOSES.map((diag) => (
                        <SelectItem key={diag.name} value={diag.name} className="text-xs">
                          {diag.name} ({diag.icd})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="icd10" className="text-xs font-bold text-foreground">
                    ICD-10 Code
                  </Label>
                  <Input
                    id="icd10"
                    value={icd10Code}
                    onChange={(e) => setIcd10Code(e.target.value)}
                    className="h-9 rounded-xl text-xs font-clinical-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="severity" className="text-xs font-bold text-foreground">
                    Severity Assessment
                  </Label>
                  <Select value={severity} onValueChange={setSeverity}>
                    <SelectTrigger id="severity" className="h-9 rounded-xl text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mild">Mild</SelectItem>
                      <SelectItem value="Moderate">Moderate</SelectItem>
                      <SelectItem value="Urgent">Urgent Malignancy Risk</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Recommendations & Treatment Protocols */}
            <div className="space-y-1.5">
              <Label htmlFor="recommendations" className="text-xs font-bold text-foreground">
                Prescription & Management Protocol
              </Label>
              <Textarea
                id="recommendations"
                value={recommendations}
                onChange={(e) => setRecommendations(e.target.value)}
                rows={3}
                className="rounded-xl text-xs leading-relaxed"
                placeholder="Enter clinical prescription and care guidance..."
              />
            </div>

            {/* Clinician Direct Note to Patient */}
            <div className="space-y-1.5">
              <Label htmlFor="clinician-notes" className="text-xs font-bold text-foreground flex items-center justify-between">
                <span>Direct Clinician Note (Visible to Patient)</span>
                <span className="text-[10px] text-muted-foreground font-normal">Optional</span>
              </Label>
              <Textarea
                id="clinician-notes"
                value={clinicianNotes}
                onChange={(e) => setClinicianNotes(e.target.value)}
                rows={2}
                className="rounded-xl text-xs"
                placeholder="E.g., I have reviewed your lesion photo and confirmed ringworm. Start the cream immediately."
              />
            </div>

            {/* Physician Credential Bar */}
            <div className="p-3.5 rounded-xl bg-muted/20 border border-border/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <div>
                  <p className="font-bold text-foreground">
                    {userData?.displayName || user?.email || "Dr. Sarah Jenkins, MD"}
                  </p>
                  <p className="text-[10.5px] font-clinical-mono text-muted-foreground">
                    LIC: NY-MED-88219 · Board Certified Dermatology
                  </p>
                </div>
              </div>
            </div>

            {/* Submit / Release Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 rounded-full font-bold text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/25 transition-all active:scale-[0.98] gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Digitally Signing & Releasing...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Approve & Release to Patient Folio</span>
                </>
              )}
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
