
"use client"

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

const plans = [
    {
        name: "Free",
        price: "$0",
        priceSuffix: "/month",
        description: "Get started with our basic features, completely free.",
        features: [
            "2 AI Analyses per month",
            "Access to community forum",
            "Standard email support"
        ],
        current: false,
    },
    {
        name: "Monthly",
        price: "$15",
        priceSuffix: "/month",
        description: "Unlock premium features and get more done.",
        features: [
            "10 AI Analyses per month",
            "5 Doctor Consultations",
            "Access to all features",
            "Priority email support"
        ],
        current: true,
    },
    {
        name: "Yearly",
        price: "$150",
        priceSuffix: "/year",
        description: "Save big with our annual plan and get the best value.",
        features: [
            "Unlimited AI Analyses",
            "60 Doctor Consultations",
            "Access to all features",
            "24/7 Priority support"
        ],
        current: false,
    }
]

export default function SubscriptionPage() {
    const { toast } = useToast();
    
    const handlePlanChange = (planName: string) => {
        // In a real app, you would handle the plan change logic here.
        // For now, we'll just show a success toast.
        toast({
            title: "Plan Changed!",
            description: `You have successfully switched to the ${planName} plan.`,
        });
    }
    
    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="flex flex-col items-center justify-center space-y-2 mb-8 text-center">
                <h1 className="text-3xl font-bold tracking-tight font-headline">
                    Subscription Plans
                </h1>
                <p className="text-muted-foreground max-w-2xl">
                    Choose the plan that's right for you and get the most out of SkinWise.
                </p>
            </div>

            <div className="grid gap-8 sm:grid-cols-1 lg:grid-cols-3 max-w-6xl mx-auto">
                {plans.map(plan => (
                    <Card key={plan.name} className={cn("flex flex-col", plan.current && "border-primary")}>
                        <CardHeader>
                            <CardTitle className="text-2xl">{plan.name}</CardTitle>
                             <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-bold">{plan.price}</span>
                                <span className="text-muted-foreground">{plan.priceSuffix}</span>
                             </div>
                            <CardDescription>{plan.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow space-y-4">
                            <ul className="space-y-2">
                                {plan.features.map(feature => (
                                    <li key={feature} className="flex items-center gap-2">
                                        <Check className="h-5 w-5 text-green-500" />
                                        <span className="text-muted-foreground">{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                        <CardFooter>
                            {plan.current ? (
                                 <Button className="w-full" disabled>Current Plan</Button>
                            ) : (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button className="w-full">Choose Plan</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Confirm Plan Change</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Are you sure you want to switch to the {plan.name} plan?
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handlePlanChange(plan.name)}>
                                                Confirm
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </CardFooter>
                    </Card>
                ))}
            </div>
             <div className="text-center mt-8">
                <Button variant="ghost" asChild>
                    <Link href="/profile">Back to Profile</Link>
                </Button>
            </div>
        </div>
    )
}
