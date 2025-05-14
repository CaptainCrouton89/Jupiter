# Jupiter Mail: Inbox Zero, Effortlessly

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Jupiter Mail tames your chaotic inbox with AI-powered automation, helping you reclaim your focus and achieve inbox zero with ease. Stop drowning in email; start thriving!

## Table of Contents

- [Introduction](#introduction)
- [Key Features](#key-features)
- [How It Works](#how-it-works)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Database Setup](#database-setup)
- [Running the Development Server](#running-the-development-server)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

## Introduction

Jupiter Mail is an intelligent email management application designed for individuals who receive a high volume of emails and are looking to optimize their workflow. By leveraging AI, Jupiter Mail automates inbox organization through smart triage and provides curated weekly briefings of your important communications, all while ensuring your data remains secure.

## Key Features

- **Automated Inbox Triage:**
  - Intelligently categorizes incoming emails (newsletters, marketing, financial alerts, personal, etc.).
  - Allows users to define actions per category (Keep as Unread, Mark as Read, Archive, Trash, Mark as Spam).
  - AI analyzes sender, subject, content, and email cues for accurate categorization.
- **Curated Weekly Briefings:**
  - Users select important email categories for their weekly digest.
  - AI intelligently summarizes emails within these categories, extracting core information.
  - A single, weekly email compiles these smart summaries, sent to the user's primary email.
- **Secure Email Account Connection:**
  - Supports Google email accounts via OAuth 2.0.
  - Supports other email accounts via IMAP/SMTP credentials.
  - Industry-standard encryption for all credentials and tokens.
- **Ironclad Security & Privacy:**
  - Email data processed and temporarily stored is encrypted on secure servers.
  - Strict 14-day data retention policy: all processed email content is automatically and permanently purged.

## How It Works

1.  **Connect Your Email:** Securely link your Google account or other IMAP-enabled email accounts.
2.  **Customize Your Rules:** Define how Jupiter Mail should handle different email categories and which ones to include in your weekly digest.
3.  **AI Takes Over:** The intelligent system automatically triages your inbox based on your rules and compiles concise weekly briefings.
4.  **Enjoy Your Focus:** Experience a calmer, more organized inbox and spend less time managing email.

## Tech Stack

Jupiter Mail is built with a modern, robust tech stack:

- **Frontend:** Next.js (App Router, RSC), React, TypeScript, Shadcn/ui, Tailwind CSS, Redux Toolkit (RTK Query), React Hook Form.
- **Backend:** Next.js API Routes, TypeScript, Supabase (PostgreSQL), `imapflow` (IMAP), Nodemailer.
- **AI Integration:** Anthropic Claude models, OpenAI-compatible APIs, Vercel AI SDK.
- **Authentication:** Supabase Auth (Google OAuth 2.0).
- **Database:** Supabase (PostgreSQL).
- **Development & Tooling:** pnpm, ESLint, Dotenv.

For more details, see the [Tech Stack Document](mdc:.cursor/rules/tech-stack.mdc).

## Getting Started

Follow these instructions to set up and run the Jupiter Mail project locally.

### Prerequisites

- Node.js (LTS version recommended)
- pnpm (Package manager)
- A Supabase project for database and authentication.
- Google Cloud Platform project with OAuth 2.0 credentials enabled for Google Sign-In.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd jupiter-mail
    ```
2.  **Install dependencies using pnpm:**
    ```bash
    pnpm install
    ```

### Environment Variables

Create a `.env` file in the root of the project by copying the `.env.example` file (if one exists) or by creating a new one. Populate it with the following necessary environment variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key # For admin operations

# Encryption
ENCRYPTION_KEY=a_secure_64_character_hex_string # Used for encrypting sensitive data

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/google/callback # Adjust if your local setup differs

# Application & Cron
NEXT_PUBLIC_APP_URL=http://localhost:3000 # Base URL of your application
CRON_SECRET=a_secure_secret_for_cron_job_authentication
INTERNAL_API_SECRET=a_secure_secret_for_internal_api_authentication # Can be the same as CRON_SECRET

# Nodemailer (for sending digests - example SMTP, adjust as needed)
SMTP_HOST=your_smtp_host
SMTP_PORT=your_smtp_port
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
SMTP_FROM_EMAIL=digest@yourdomain.com # Email address to send digests from
```

**Note:** Generate a strong, random 64-character hex string for `ENCRYPTION_KEY`.

### Database Setup

This project uses Supabase for its database.

1.  Set up your Supabase project.
2.  The database schema is defined and can be inferred from `lib/database.types.ts`. If migrations are provided, run them. Otherwise, ensure your Supabase tables match the structure outlined in the [Backend Structure Document](mdc:.cursor/rules/backend-structure.mdc).

## Running the Development Server

Once the installation and environment setup are complete, you can start the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Available Scripts

Standard Next.js scripts are available:

- `pnpm dev`: Starts the development server.
- `pnpm build`: Builds the application for production.
- `pnpm start`: Starts a production server.
- `pnpm lint`: Runs ESLint to check for code quality and style issues.

## Project Structure

A brief overview of the key directories:

- `app/`: Contains all routes, pages, and API handlers (using Next.js App Router).
  - `app/api/`: Backend API routes.
  - `app/(pages)/`: Frontend page components.
- `components/`: Shared UI components, including Shadcn/ui components.
- `lib/`: Core logic, utilities, authentication, database interactions, email services.
- `public/`: Static assets.
- `.cursor/rules/`: Contains detailed documentation about application flow, backend structure, frontend guidelines, etc. (For AI assistant context).

For a more detailed understanding, refer to the documentation within the `.cursor/rules/` directory.

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue for bugs, features, or improvements.
(Further details on a contribution guide can be added here).

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details (assuming an MIT license).
