# DermiAssist-AI: Intelligent Dermatology Platform

DermiAssist-AI is a comprehensive, AI-powered web application built with Next.js, Genkit, and Firebase. It provides users with instant skin analysis, connects them with certified dermatologists, and offers a suite of tools for managing their skin health journey. The platform features distinct portals for patients, doctors, and administrators, each with a tailored user experience.

## ✨ Key Features

- **Multi-Role System**: Secure authentication and role-based access for Patients, Doctors, and Administrators.
- **AI-Powered Skin Analysis**: Patients can upload an image of a skin condition to receive an instant, detailed analysis and a personalized report using Gemini and Genkit.
- **Conversational AI Proforma**: An interactive, chat-based questionnaire to gather more information from the patient for a more accurate final report.
- **Multilingual Report Explanation**: AI-generated explanations of analysis reports in multiple languages, complete with text-to-speech audio.
- **Visual Progress Tracking**: Compare a new skin photo against the original analysis to track healing progress.
- **Generative Healing Video**: A premium feature using Google's Veo model to create a video visualizing the skin's healing transition.
- **Doctor Discovery & Appointments**: Patients can find verified doctors, view their profiles, and book appointments.
- **Secure Real-time Chat & Video Calls**: Integrated real-time chat (via Stream) and video consultations (via Agora) between patients and doctors.
- **Doctor & Admin Dashboards**:
    - **Doctors**: Manage appointments, review patient case files, and write private consultation notes.
    - **Admins**: Oversee all users, manage doctor verification requests, and view platform analytics.
- **Dynamic PDF Report Generation**: Users can download their detailed AI analysis reports as professional-grade PDFs.

## 🚀 Tech Stack

- **Framework**: Next.js (App Router), React
- **Artificial Intelligence**: Google AI Studio (Gemini 1.5 Flash), Genkit
- **UI**: ShadCN UI, Tailwind CSS, Framer Motion
- **Database**: Firestore
- **Authentication**: Firebase Authentication
- **File Storage**: Cloudinary (for images, audio, and documents)
- **Real-time Chat**: Stream
- **Video Calls**: Agora
- **Deployment**: Firebase App Hosting

## ⚙️ Environment Setup

To run this project locally, you need to set up your environment variables. Create a file named `.env` in the root of the project and add the following keys with your own credentials:

```bash
# Firebase Configuration (find these in your Firebase project settings)
NEXT_PUBLIC_FIREBASE_API_KEY="your_firebase_api_key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your_firebase_auth_domain"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your_firebase_project_id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your_firebase_storage_bucket"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your_firebase_messaging_sender_id"
NEXT_PUBLIC_FIREBASE_APP_ID="your_firebase_app_id"

# Google AI (Gemini) API Key
GEMINI_API_KEY="your_gemini_api_key"

# Cloudinary Credentials (for file uploads)
CLOUDINARY_CLOUD_NAME="your_cloudinary_cloud_name"
CLOUDINARY_API_KEY="your_cloudinary_api_key"
CLOUDINARY_API_SECRET="your_cloudinary_api_secret"

# Stream Credentials (for real-time chat)
NEXT_PUBLIC_STREAM_API_KEY="your_stream_api_key"
STREAM_API_SECRET="your_stream_api_secret"

# Agora Credentials (for video calls)
NEXT_PUBLIC_AGORA_APP_ID="your_agora_app_id"
AGORA_APP_CERTIFICATE="your_agora_app_certificate"
```

## 🚀 Getting Started

Follow these steps to get your local development environment running.

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Firebase

Ensure you have a Firebase project created and that you have enabled **Firestore** and **Firebase Authentication** (with the Email/Password provider).

You will also need to apply the security rules found in `firestore.rules` to your Firestore database to ensure the application functions correctly.

### 3. Run the Development Server

The application consists of two main parts: the Next.js frontend and the Genkit AI backend. You need to run both concurrently in separate terminal windows.

**Terminal 1: Run the Next.js App**
```bash
npm run dev
```
This will start the main application, typically on `http://localhost:9002`.

**Terminal 2: Run the Genkit AI Flows**
```bash
npm run genkit:dev
```
This starts the Genkit development UI, which allows you to inspect and test your AI flows. This process also makes the flows available to your Next.js application.

Once both servers are running, you can access the web application in your browser.
