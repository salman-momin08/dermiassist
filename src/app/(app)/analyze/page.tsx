
"use client";

import { useState } from "react";
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
} from "lucide-react";
import Image from "next/image";
import { skinConditionAnalysis } from "@/ai/flows/skin-condition-analysis";
import { useToast } from "@/hooks/use-toast";
import { useAnalyses } from "@/hooks/use-analyses";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";

export default function AnalyzePage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [preMedication, setPreMedication] = useState("");
  const [diseaseDuration, setDiseaseDuration] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
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

  const handleAnalyze = async () => {
    if (!user || !userData) {
        toast({ title: "Authentication Error", description: "You must be logged in to perform an analysis.", variant: "destructive"});
        return;
    }
    if (!file || !preview) {
      toast({
        title: "No image selected",
        description: "Please upload an image of your skin condition.",
        variant: "destructive",
      });
      return;
    }
    if (!diseaseDuration) {
      toast({
        title: "Missing information",
        description: "Please enter the disease duration.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await skinConditionAnalysis({
        photoDataUri: preview,
        preMedication: preMedication || "None",
        diseaseDuration,
      });

      const newReport = await addAnalysis(user.uid, userData.displayName || "Anonymous", {
        condition: result.condition,
        image: preview,
        recommendations: result.recommendations,
        dos: result.dos,
        donts: result.donts,
        submittedInfo: {
          preMedication: preMedication || "None",
          diseaseDuration,
        },
      });
      
      toast({
        title: "Analysis Complete",
        description: "Your skin analysis report is ready.",
      });

      // Redirect to the new report detail page
      router.push(`/my-analyses/${newReport.id}`);

    } catch (err) {
      console.error("Analysis failed:", err);
      setError("An unexpected error occurred. Please try again.");
      toast({
        title: "Analysis Failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
        setIsAnalyzing(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="mb-6">
          <Button variant="outline" asChild>
              <Link href="/dashboard">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Dashboard
              </Link>
          </Button>
      </div>
      <div className="flex justify-center">
        <Card className="w-full max-w-2xl">
            <CardHeader>
            <CardTitle className="font-headline text-2xl">
                New Skin Analysis
            </CardTitle>
            <CardDescription>
                Upload a photo and answer a few questions to get an AI-powered
                analysis. This analysis will be saved to your account.
            </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="picture">Skin Condition Photo</Label>
                <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                {preview ? (
                    <div className="relative inline-block">
                    <Image
                        src={preview}
                        alt="Preview"
                        width={200}
                        height={200}
                        className="mx-auto rounded-lg"
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-1 right-1 bg-background/50 hover:bg-background/80 rounded-full h-7 w-7"
                        onClick={() => {
                        setFile(null);
                        setPreview(null);
                        }}
                    >
                        <XCircle className="h-5 w-5" />
                    </Button>
                    </div>
                ) : (
                    <label htmlFor="picture" className="cursor-pointer">
                    <div className="space-y-2">
                        <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                        Drag & drop an image here, or click to select one
                        </p>
                        <Input
                        id="picture"
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileChange}
                        disabled={isAnalyzing}
                        />
                        <Button
                        size="sm"
                        onClick={(e) => { e.preventDefault(); document.getElementById("picture")?.click()}}
                        disabled={isAnalyzing}
                        className="mt-2"
                        asChild
                        >
                        <span>Upload Image</span>
                        </Button>
                    </div>
                    </label>
                )}
                </div>
            </div>

            <div className="grid sm:grid-cols-1 gap-4">
                <div className="space-y-2">
                <Label htmlFor="duration">Disease Duration</Label>
                <Input
                    id="duration"
                    placeholder="e.g., 2 weeks, 3 months"
                    value={diseaseDuration}
                    onChange={(e) => setDiseaseDuration(e.target.value)}
                    disabled={isAnalyzing}
                />
                </div>
                <div className="space-y-2">
                <Label htmlFor="medication">Pre-medication (if any)</Label>
                <Textarea
                    id="medication"
                    placeholder="Describe any medications or treatments you've used for this condition."
                    value={preMedication}
                    onChange={(e) => setPreMedication(e.target.value)}
                    disabled={isAnalyzing}
                />
                </div>
            </div>
            </CardContent>
            <CardFooter>
            <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !file}
                className="w-full"
            >
                {isAnalyzing ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                </>
                ) : (
                "Analyze My Skin"
                )}
            </Button>
            </CardFooter>
            {error && (
                <div className="p-4 bg-destructive/10 text-destructive text-sm rounded-md m-6 mt-0 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <p>{error}</p>
                </div>
            )}
        </Card>
      </div>
    </div>
  );
}
