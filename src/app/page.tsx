
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Bot, Stethoscope, FileText, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { AppHeader } from '@/components/layout/header';
import { AppFooter } from '@/components/layout/footer';
import { Logo } from '@/components/logo';
import { motion } from 'framer-motion';

function LandingPageContent() {
  const featureVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.1 } },
  };

  const featureItemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="w-full py-8 sm:py-10 md:py-12 lg:py-14 bg-background">
          <div className="container px-4 sm:px-6 md:px-8">
            <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
              <motion.div
                className="flex flex-col justify-center space-y-4 sm:space-y-6"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="space-y-3 sm:space-y-4">
                  <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl xl:text-6xl/none font-headline">
                    Intelligent Skin Care, Right at Your Fingertips
                  </h1>
                  <p className="max-w-[600px] text-sm sm:text-base text-muted-foreground md:text-lg lg:text-xl">
                    DermiAssist-AI provides instant AI-powered skin analysis and
                    connects you with certified dermatologists. Take control of
                    your skin health today.
                  </p>
                </div>
                <div className="flex flex-col gap-3 min-[400px]:flex-row">
                  <Button asChild size="lg" className="w-full min-[400px]:w-auto text-sm sm:text-base">
                    <Link href="/signup">Get Started</Link>
                  </Button>
                  <Button asChild variant="secondary" size="lg" className="w-full min-[400px]:w-auto text-sm sm:text-base">
                    <Link href="/login">Sign In</Link>
                  </Button>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <Image
                  src="/landing.png"
                  width="600"
                  height="600"
                  alt="Hero"
                  data-ai-hint="dermatology technology"
                  className="mx-auto aspect-square overflow-hidden rounded-xl object-cover shadow-2xl"
                />
              </motion.div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="w-full py-8 md:py-12 lg:py-14 bg-background">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-secondary px-3 py-1 text-sm font-semibold">
                  Key Features
                </div>
                <h2 className="text-2xl font-bold tracking-tighter sm:text-3xl md:text-4xl lg:text-5xl font-headline">
                  A Smarter Way to Healthy Skin
                </h2>
                <p className="max-w-[900px] text-sm sm:text-base text-muted-foreground md:text-lg lg:text-xl/relaxed">
                  Our platform is packed with features designed to provide you
                  with comprehensive dermatological care, from analysis to
                  treatment.
                </p>
              </div>
            </div>
            <motion.div
              className="mx-auto grid max-w-5xl items-start gap-8 sm:grid-cols-2 md:gap-12 lg:grid-cols-3 lg:max-w-none mt-12"
              variants={featureVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
            >
              <motion.div className="grid gap-2 text-center p-4 rounded-lg hover:bg-card transition-colors duration-300" variants={featureItemVariants}>
                <Bot className="h-10 w-10 mx-auto text-primary" />
                <h3 className="text-lg font-bold">AI Analysis</h3>
                <p className="text-sm text-muted-foreground">
                  Get an instant, detailed analysis of your skin condition by
                  uploading a photo.
                </p>
              </motion.div>
              <motion.div className="grid gap-2 text-center p-4 rounded-lg hover:bg-card transition-colors duration-300" variants={featureItemVariants}>
                <FileText className="h-10 w-10 mx-auto text-primary" />
                <h3 className="text-lg font-bold">Personalized Reports</h3>
                <p className="text-sm text-muted-foreground">
                  Receive comprehensive reports with do's, don'ts, and
                  recommendations for your skin.
                </p>
              </motion.div>
              <motion.div className="grid gap-2 text-center p-4 rounded-lg hover:bg-card transition-colors duration-300" variants={featureItemVariants}>
                <Stethoscope className="h-10 w-10 mx-auto text-primary" />
                <h3 className="text-lg font-bold">Find a Doctor</h3>
                <p className="text-sm text-muted-foreground">
                  Connect with certified dermatologists for online or offline
                  consultations.
                </p>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="w-full py-8 md:py-12 lg:py-14 bg-background">
          <div className="container grid items-center justify-center gap-4 px-4 text-center md:px-6">
            <div className="space-y-3">
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl/tight font-headline">
                Ready to Transform Your Skin Health?
              </h2>
              <p className="mx-auto max-w-[600px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Create an account to begin your journey towards clearer,
                healthier skin. It's fast, easy, and secure.
              </p>
            </div>
            <div className="mx-auto w-full max-w-sm space-x-2">
              <Button asChild size="lg">
                <Link href="/signup">Sign Up Now</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <AppFooter />
    </div>
  );
}

export default function LandingPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        let destination = '/dashboard'; // Default for patient
        if (role === 'doctor') {
          destination = '/doctor/dashboard';
        } else if (role === 'admin') {
          destination = '/admin/dashboard';
        }
        router.replace(destination);
      }
    }
  }, [user, role, loading, router]);

  // If loading or we have a user (meaning we are about to redirect), 
  // we do not want to render the landing page to avoid a flash of content.
  // The Next.js loading.tsx boundary will handle the UI state.
  if (loading || user) {
    return null;
  }

  return <LandingPageContent />;
}
