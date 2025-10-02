
"use client";

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

// This component listens for custom permission errors and throws them
// so Next.js can display them in the development error overlay.
export function FirebaseErrorListener() {
  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      // Throw the error to let Next.js overlay handle it
      // This provides a much better debugging experience than console.log
      throw error;
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  return null; // This component does not render anything
}
