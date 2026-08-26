import type { Metadata, Viewport } from 'next';
import { Inter, Source_Code_Pro } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { Chatbot } from '@/components/chatbot/chatbot';
import { AuthProvider } from '@/hooks/use-auth';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});

const sourceCodePro = Source_Code_Pro({
  subsets: ['latin'],
  variable: '--font-code',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'DermiAssist-AI - Your Personal Dermatology Assistant',
  description:
    'AI-powered skin analysis, doctor consultations, and personalized skincare recommendations.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${sourceCodePro.variable}`}>
      <body className="font-body antialiased min-h-screen w-full overflow-x-clip">
        <AuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Chatbot />
            <Toaster />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
