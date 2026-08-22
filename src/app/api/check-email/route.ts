import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * API Route: Check Email Existence
 * 
 * POST /api/check-email
 * 
 * Checks if an email already exists in the profiles table
 * to prevent duplicate account creation.
 * 
 * Request Body:
 * {
 *   "email": "user@example.com"
 * }
 * 
 * Response:
 * {
 *   "exists": boolean,
 *   "message": string
 * }
 */

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email } = body;

        // Validate email input
        if (!email || typeof email !== 'string') {
            return NextResponse.json(
                {
                    exists: false,
                    message: 'Invalid email provided'
                },
                { status: 400 }
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                {
                    exists: false,
                    message: 'Invalid email format'
                },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        // Check if email exists in profiles table (case-insensitive)
        const { data, error } = await supabase
            .from('profiles')
            .select('email')
            .ilike('email', email)
            .limit(1);

        if (error) {
            console.error('[Check Email] Database error:', error);
            return NextResponse.json(
                {
                    exists: false,
                    message: 'Error checking email availability'
                },
                { status: 500 }
            );
        }

        const exists = data && data.length > 0;

        return NextResponse.json(
            {
                exists,
                message: exists
                    ? 'An account with this email already exists'
                    : 'Email is available'
            },
            { status: 200 }
        );

    } catch (error) {
        console.error('[Check Email] Unexpected error:', error);
        return NextResponse.json(
            {
                exists: false,
                message: 'An unexpected error occurred'
            },
            { status: 500 }
        );
    }
}

// Prevent caching of this endpoint
export const dynamic = 'force-dynamic';
