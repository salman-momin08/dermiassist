
import { Suspense } from 'react';
import AnalyzeClient from './AnalyzeClient';

// By exporting this constant, we ensure that this route is always server-rendered.
// This is necessary because the page uses search parameters.
export const dynamic = 'force-dynamic';

function AnalyzePageLoading() {
  return <div className="flex h-screen w-full items-center justify-center">Loading...</div>;
}

export default function AnalyzePage() {
  return (
    <Suspense fallback={<AnalyzePageLoading />}>
      <AnalyzeClient />
    </Suspense>
  );
}
