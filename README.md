# Jupiter Mail: Inbox Zero, Effortlessly

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Jupiter Mail tames your chaotic inbox with AI-powered automation, helping you reclaim your focus and achieve inbox zero with ease. Stop drowning in email; start thriving!

## Table of Contents

- [Jupiter Mail: Inbox Zero, Effortlessly](#jupiter-mail-inbox-zero-effortlessly)
  - [Table of Contents](#table-of-contents)
  - [Introduction](#introduction)
  - [Key Features](#key-features)
  - [How It Works](#how-it-works)
  - [Tech Stack](#tech-stack)
  - [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
    - [Database Setup](#database-setup)
  - [Running the Development Server](#running-the-development-server)
  - [Available Scripts](#available-scripts)
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
-

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue for bugs, features, or improvements.
(Further details on a contribution guide can be added here).

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details (assuming an MIT license).
