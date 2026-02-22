"use client";

import { useState, useEffect } from "react";
import { X, Monitor } from "lucide-react";
import { Button } from "./ui/button";
import { motion, AnimatePresence } from "framer-motion";

export function MobileWarning() {
    const [show, setShow] = useState(false);

    useEffect(() => {
        // Check if on mobile (screen width < 1024px)
        const checkMobile = () => {
            const isMobile = window.innerWidth < 1024;
            const dismissed = localStorage.getItem("mobile-warning-dismissed");

            if (isMobile && !dismissed) {
                setShow(true);
            } else {
                setShow(false);
            }
        };

        // Initial check
        checkMobile();

        // Listen for resize
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    const handleDismiss = () => {
        setShow(false);
        localStorage.setItem("mobile-warning-dismissed", "true");
    };

    return (
        <AnimatePresence>
            {show && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm lg:hidden">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative w-full max-w-sm overflow-hidden bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800"
                    >
                        {/* Close Button */}
                        <button
                            onClick={handleDismiss}
                            className="absolute top-4 right-4 p-1 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <div className="p-8 text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-2xl bg-primary/10 text-primary">
                                <Monitor size={32} />
                            </div>

                            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                                Desktop Site Recommended
                            </h3>

                            <p className="text-zinc-600 dark:text-zinc-400 mb-8 px-4 leading-relaxed">
                                For the best experience with our AI analysis tools and medical dashboards,
                                we recommend enabling **Desktop Site** or using a larger screen.
                            </p>

                            <Button
                                onClick={handleDismiss}
                                className="w-full h-12 rounded-xl text-md font-semibold"
                            >
                                Got it, thanks!
                            </Button>
                        </div>

                        {/* Bottom Accent */}
                        <div className="h-1.5 w-full bg-gradient-to-r from-primary/20 via-primary to-primary/20" />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
