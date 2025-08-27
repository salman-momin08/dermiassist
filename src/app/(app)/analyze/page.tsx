
"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Upload,
  Loader2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  WandSparkles,
} from "lucide-react";
import Image from "next/image";
import { skinConditionAnalysis } from "@/ai/flows/skin-condition-analysis";
import { detectDiseaseName } from "@/ai/flows/detect-disease-name";
import { useToast } from "@/hooks/use-toast";
import { useAnalyses } from "@/hooks/use-analyses";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";

type Step = 'upload' | 'proforma' | 'analyzing' | 'error';

export default function AnalyzePage() {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [preMedication, setPreMedication] = useState("");
  const [diseaseDuration, setDiseaseDuration] = useState("");
  const [detectedCondition, setDetectedCondition] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { toast } = useToast();
  const { addAnalysis } = useAnalyses();
  const { user, userData } = useAuth();
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleImageSubmit = async () => {
    if (!file || !preview) {
      toast({ title: "No image selected", description: "Please upload an image.", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      const { conditionName } = await detectDiseaseName({ photoDataUri: preview });
      setDetectedCondition(conditionName);
      setStep('proforma');
    } catch (err) {
      console.error("Disease detection failed:", err);
      setError("Failed to detect disease from the image. Please try another one.");
      setStep('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProformaSubmit = async () => {
    if (!user || !userData) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    if (!preview || !detectedCondition || !diseaseDuration) {
      toast({ title: "Missing Information", description: "Please fill out all fields.", variant: "destructive" });
      return;
    }

    setStep('analyzing');
    setIsLoading(true);
    setError(null);

    try {
      const result = await skinConditionAnalysis({
        photoDataUri: preview,
        preMedication: preMedication || "None",
        diseaseDuration,
      });

      const newReport = await addAnalysis(user.uid, userData.displayName || "Anonymous", {
        condition: result.condition,
        conditionName: result.conditionName, // Use the name from the full analysis
        image: preview,
        recommendations: result.recommendations,
        dos: result.dos,
        donts: result.donts,
        submittedInfo: {
          preMedication: preMedication || "None",
          diseaseDuration,
        },
      });
      
      toast({ title: "Analysis Complete", description: "Your detailed report is ready." });
      router.push(`/my-analyses/${newReport.id}`);

    } catch (err) {
      console.error("Full analysis failed:", err);
      setError("An unexpected error occurred during the detailed analysis. Please try again.");
      setStep('error');
    } finally {
      setIsLoading(false);
    }
  };

  const resetState = () => {
    setStep('upload');
    setFile(null);
    setPreview(null);
    setDetectedCondition(null);
    setPreMedication("");
    setDiseaseDuration("");
    setError(null);
  };
  
  const renderBackButton = () => (
     <div className="mb-6">
        <Button variant="outline" onClick={resetState}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Start Over
        </Button>
    </div>
  );

  return (
    <div className="container mx-auto p-4 md:p-8">
      {step !== 'upload' && renderBackButton()}
      <div className="flex justify-center">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="font-headline text-2xl">New Skin Analysis</CardTitle>
            <CardDescription>
              {step === 'upload' && "Upload a photo to get started. Our AI will identify the likely condition."}
              {step === 'proforma' && "Please provide some additional details for a more accurate report."}
              {step === 'analyzing' && "Hang tight! Our AI is preparing your detailed analysis."}
              {step === 'error' && "An error occurred. Please try again."}
            </CardDescription>
          </CardHeader>
          
          {step === 'upload' && (
            <>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="picture">Skin Condition Photo</Label>
                  <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                    {preview ? (
                      <div className="relative inline-block">
                        <Image src={preview} alt="Preview" width={200} height={200} className="mx-auto rounded-lg" />
                        <Button variant="ghost" size="icon" className="absolute top-1 right-1 bg-background/50 hover:bg-background/80 rounded-full h-7 w-7" onClick={() => { setFile(null); setPreview(null); }}>
                          <XCircle className="h-5 w-5" />
                        </Button>
                      </div>
                    ) : (
                      <label htmlFor="picture" className="cursor-pointer">
                        <div className="space-y-2">
                          <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Drag & drop an image here, or click to select one</p>
                          <Input id="picture" type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={isLoading} />
                          <Button size="sm" asChild className="mt-2"><span>Upload Image</span></Button>
                        </div>
                      </label>
                    )}
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleImageSubmit} disabled={isLoading || !file} className="w-full">
                  {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Detecting...</> : "Detect Condition"}
                </Button>
              </CardFooter>
            </>
          )}

          {step === 'proforma' && (
            <>
              <CardContent className="space-y-6">
                {detectedCondition && (
                  <div className="p-4 bg-primary/10 rounded-lg text-center">
                     <p className="text-sm text-muted-foreground">Likely Condition Detected:</p>
                     <p className="text-lg font-bold text-primary">{detectedCondition}</p>
                  </div>
                )}
                 <div className="space-y-2">
                  <Label htmlFor="duration">Disease Duration</Label>
                  <Input id="duration" placeholder="e.g., 2 weeks, 3 months" value={diseaseDuration} onChange={(e) => setDiseaseDuration(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="medication">Pre-medication (if any)</Label>
                  <Textarea id="medication" placeholder="Describe any medications or treatments you've used." value={preMedication} onChange={(e) => setPreMedication(e.target.value)} />
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleProformaSubmit} className="w-full">
                  <WandSparkles className="mr-2 h-4 w-4" /> Get Detailed Report
                </Button>
              </CardFooter>
            </>
          )}
          
          {(step === 'analyzing' || step === 'error') && (
            <CardContent className="flex flex-col items-center justify-center h-48 gap-4">
              {step === 'analyzing' && (
                <>
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-muted-foreground">Evaluating your case... Please wait.</p>
                </>
              )}
              {step === 'error' && error && (
                 <div className="text-center text-destructive space-y-4">
                    <AlertTriangle className="h-12 w-12 mx-auto" />
                    <p>{error}</p>
                    <Button onClick={resetState}>Try Again</Button>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
