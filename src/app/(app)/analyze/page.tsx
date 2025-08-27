
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
  MessageSquareQuestion,
} from "lucide-react";
import Image from "next/image";
import { finalEvaluation } from "@/ai/flows/final-evaluation";
import { detectDiseaseName } from "@/ai/flows/detect-disease-name";
import { generateProforma } from "@/ai/flows/generate-proforma";
import { useToast } from "@/hooks/use-toast";
import { useAnalyses } from "@/hooks/use-analyses";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

type Step = 'upload' | 'proforma' | 'analyzing' | 'error';
type Answer = { question: string; answer: string };

export default function AnalyzePage() {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [detectedCondition, setDetectedCondition] = useState<string | null>(null);
  const [proformaQuestions, setProformaQuestions] = useState<string[]>([]);
  const [proformaAnswers, setProformaAnswers] = useState<Answer[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
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
      setLoadingMessage("Detecting condition...");
      const { conditionName } = await detectDiseaseName({ photoDataUri: preview });
      setDetectedCondition(conditionName);

      setLoadingMessage("Generating relevant questions...");
      const { questions } = await generateProforma({ conditionName });
      setProformaQuestions(questions);
      setProformaAnswers(questions.map(q => ({ question: q, answer: '' })));
      
      setStep('proforma');

    } catch (err) {
      console.error("Initial analysis failed:", err);
      setError("Failed to analyze the image. The AI may be unable to identify a condition. Please try another photo.");
      setStep('error');
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  const handleAnswerChange = (index: number, answer: string) => {
    setProformaAnswers(prev => {
        const newAnswers = [...prev];
        newAnswers[index].answer = answer;
        return newAnswers;
    });
  };

  const handleProformaSubmit = async () => {
    if (!user || !userData) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    if (!preview || !detectedCondition) {
      toast({ title: "Missing Information", description: "Critical analysis data is missing.", variant: "destructive" });
      return;
    }
    if (proformaAnswers.some(a => !a.answer.trim())) {
      toast({ title: "Please answer all questions", description: "Your answers are crucial for an accurate report.", variant: "destructive" });
      return;
    }

    setStep('analyzing');
    setIsLoading(true);
    setLoadingMessage("Performing final evaluation...");
    setError(null);

    try {
      const answersString = proformaAnswers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n');
      
      const result = await finalEvaluation({
        photoDataUri: preview,
        initialCondition: detectedCondition,
        userAnswers: answersString,
      });

      const newReport = await addAnalysis(user.uid, userData.displayName || "Anonymous", {
        condition: result.condition,
        conditionName: result.conditionName,
        image: preview,
        recommendations: result.recommendations,
        dos: result.dos,
        donts: result.donts,
        // Storing the new detailed fields for future use if needed
        submittedInfo: {
          initialCondition: detectedCondition,
          otherConsiderations: result.otherConsiderations,
          proformaAnswers: proformaAnswers,
        },
      });
      
      toast({ title: "Analysis Complete", description: "Your detailed report is ready." });
      router.push(`/my-analyses/${newReport.id}`);

    } catch (err) {
      console.error("Final evaluation failed:", err);
      setError("An unexpected error occurred during the final analysis. Please try again.");
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
    setProformaQuestions([]);
    setProformaAnswers([]);
    setError(null);
    setLoadingMessage("");
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
              {step === 'upload' && "Upload a photo to get started. Our AI will identify the condition and ask relevant questions."}
              {step === 'proforma' && "Please answer these questions for a more accurate report."}
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
                  {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{loadingMessage}</> : "Start Analysis"}
                </Button>
              </CardFooter>
            </>
          )}

          {step === 'proforma' && (
            <>
              <CardContent className="space-y-6">
                {detectedCondition && (
                  <div className="p-4 bg-primary/10 rounded-lg">
                     <p className="text-sm text-muted-foreground">Initial finding:</p>
                     <p className="text-lg font-bold text-primary">{detectedCondition}</p>
                     <p className="text-sm text-muted-foreground mt-2">To provide a more accurate evaluation, please answer the questions below.</p>
                  </div>
                )}
                 {proformaQuestions.map((question, index) => (
                    <div key={index} className="space-y-2">
                        <Label htmlFor={`question-${index}`} className="flex items-start gap-2">
                          <MessageSquareQuestion className="h-4 w-4 mt-1 flex-shrink-0" />
                          <span>{question}</span>
                        </Label>
                        <Textarea 
                            id={`question-${index}`} 
                            placeholder="Your answer..."
                            value={proformaAnswers[index].answer}
                            onChange={(e) => handleAnswerChange(index, e.target.value)}
                        />
                    </div>
                ))}
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
                  <p className="text-muted-foreground">{loadingMessage}</p>
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
