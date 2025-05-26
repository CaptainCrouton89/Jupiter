# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Development server**: `pnpm dev` (starts Next.js dev server on port 3000)
- **Build**: `pnpm build` (builds for production)
- **Lint**: `pnpm lint` (runs ESLint)
- **Generate database types**: `pnpm run db:pull` (generates `lib/database.types.ts` from Supabase)

## Architecture Overview

Jupiter Mail is an AI-powered email management application built with:

- **Frontend**: Next.js 15 (App Router), React, TypeScript, Shadcn/ui, Tailwind CSS
- **Backend**: Next.js API Routes, Supabase (PostgreSQL), IMAP processing
- **AI**: Anthropic Claude + OpenAI for email categorization and digest generation
- **Authentication**: Supabase Auth with Google OAuth 2.0

### Core Data Flow

1. **Email Sync**: Scheduled cron jobs (`app/api/cron/email-sync/`) fetch emails via IMAP
2. **Categorization**: AI categorizes emails using prompts in `lib/email/categorizer/`
3. **Triage**: User-defined actions (archive, mark read, delete) applied automatically
4. **Digest**: Weekly AI-generated summaries sent via `lib/email/digest/`

### Key Database Tables

- `email_accounts`: User email connections (Google OAuth + manual IMAP/SMTP)
- `emails`: Encrypted email content with AI-assigned categories
- `user_settings`: Category preferences and triage actions
- `sync_logs`: Email sync job tracking

### Security Architecture

- **Encryption**: AES-256-GCM for all sensitive data (credentials, email content)
- **Data Retention**: 14-day automatic purge of processed emails
- **Authentication**: Server-side session verification with encrypted tokens

## Project Structure

- `app/`: Next.js App Router pages and API routes
  - `api/auth/google/`: OAuth flow endpoints
  - `api/cron/`: Scheduled background jobs
  - `api/internal/sync-account/`: Core email processing logic
- `lib/`: Core business logic
  - `auth/`: Authentication, encryption, Google services
  - `email/`: IMAP, parsing, categorization, digest generation
  - `store/`: Redux Toolkit for client state
- `components/`: React components (Shadcn/ui based)
- `types/`: TypeScript type definitions

## Development Guidelines

### Email Processing Flow

1. IMAP connection via `lib/email/imapService.ts`
2. Email parsing with `mailparser` in `lib/email/parseEmail.ts`
3. AI categorization in `lib/email/categorizer/emailCategorizer.ts`
4. Database storage with encryption in `lib/email/storeEmails.ts`

### Authentication Flow

- Google OAuth: `/api/auth/google/initiate` → Google → `/api/auth/google/callback`
- Session management via Supabase cookies in `middleware.ts`
- Server-side verification in `lib/auth/server.ts`

### AI Integration

- Email categorization uses Anthropic Claude models
- Digest generation combines multiple AI providers
- All AI interactions use structured prompts with validation

### UI Components

- Shadcn/ui components with "new-york" style
- Tailwind CSS with CSS variables for theming
- Orange/amber color scheme with responsive design
- Form validation using React Hook Form + Zod

## Common Tasks

### Adding New Email Categories

1. Update category definitions in `lib/email/categorizer/`
2. Add color mapping in `lib/email/categoryColors.ts`
3. Update UI components in `components/settings/categorization/`

### Modifying Sync Logic

Core sync logic is in `app/api/internal/sync-account/[accountId]/route.ts` with modular helpers:
- `imapOps.ts`: IMAP operations
- `emailProcessing.ts`: Email parsing and categorization
- `supabaseOps.ts`: Database operations
- `errorHandler.ts`: Error handling
- `logger.ts`: Logging

### Testing Email Processing

Use the test categorization endpoint: `app/api/email/test-categorization/route.ts`
Triggered from Settings page to test AI categorization on recent emails.