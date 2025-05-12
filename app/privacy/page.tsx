"use client"; // Can be a server component if no client-side interactions are needed

import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto py-12 px-4 md:px-6 max-w-3xl">
      <header className="mb-12 pb-6 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3 text-gray-900 dark:text-gray-100">
          Privacy Policy for Jupiter Mail
        </h1>
        <p className="text-sm text-muted-foreground">
          Last Updated:{" "}
          {new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </header>

      <article className="prose prose-slate dark:prose-invert max-w-none lg:prose-lg leading-relaxed space-y-6">
        <p>
          Welcome to Jupiter Mail (&quot;we&quot;, &quot;us&quot;, or
          &quot;our&quot;). This Privacy Policy explains how we handle your
          email data when you use our application. We are committed to
          protecting your privacy and ensuring you understand how your
          information is used to provide our services.
        </p>

        <h2 id="how-it-works">How Jupiter Mail Handles Your Emails</h2>
        <p>
          Jupiter Mail is designed to help you manage your email inbox more
          effectively. Our core functionalities related to email handling
          include:
        </p>
        <ul>
          <li>
            <strong>Automated Email Actions:</strong> Based on settings you
            configure for different email categories, Jupiter Mail can perform
            actions on your emails. This includes:
            <ul>
              <li>
                <strong>Marking Emails as Read:</strong> If you choose this
                option for a category, incoming emails classified under that
                category can be automatically marked as read in your email
                account.
              </li>
              <li>
                <strong>Marking Emails for Spam:</strong> If you choose this
                option for a category, emails classified under that category can
                be marked as spam. This action typically moves the email to your
                spam folder, depending on your email provider's behavior.
              </li>
            </ul>
            These actions are performed based on your explicit consent and
            configuration within the application settings.
          </li>
          <li>
            <strong>Weekly Digest Emails:</strong> For email categories you
            select, Jupiter Mail can compile and send you a weekly digest. This
            digest summarizes the emails that were classified into those chosen
            categories during the week, providing you with an overview without
            needing to go through each email individually.
          </li>
        </ul>
        <p>
          To provide these services, Jupiter Mail requires access to your email
          account(s) that you connect. We access email content (headers, body)
          to categorize them and to generate summaries for digest emails.
          Actions like marking as read or spam are performed via standard email
          protocols (e.g., IMAP) as directed by your settings.
        </p>

        <h2
          id="information-we-access"
          className="mt-10 mb-4 text-2xl font-semibold tracking-tight text-gray-800 dark:text-gray-200"
        >
          Information We Access
        </h2>
        <p>
          To perform the functionalities described above, we need to access:
        </p>
        <ul>
          <li>Email headers (sender, recipient, subject, date)</li>
          <li>Email body content (text and HTML)</li>
          <li>
            List of your email folders and email UIDs/IDs for synchronization
          </li>
        </ul>
        <p>
          We use this information solely for the purpose of providing the email
          management features of Jupiter Mail, such as categorization,
          performing actions you've configured, and generating digests. We do
          not sell your personal data or email content.
        </p>

        <h2
          id="data-storage-and-security"
          className="mt-10 mb-4 text-2xl font-semibold tracking-tight text-gray-800 dark:text-gray-200"
        >
          Data Storage and Security
        </h2>
        <p>
          Your email account credentials (like passwords or OAuth tokens) are
          stored securely, encrypted at rest. Email content that is processed
          for categorization or digests may be temporarily cached but is not
          stored long-term beyond what is necessary for the functioning of the
          service and providing your email digests. You retain ownership of your
          email data at all times.
        </p>
        <p>
          We implement industry-standard security measures to protect your
          information. However, no system is completely secure, and we cannot
          guarantee the absolute security of your data.
        </p>

        <h2
          id="your-choices"
          className="mt-10 mb-4 text-2xl font-semibold tracking-tight text-gray-800 dark:text-gray-200"
        >
          Your Choices
        </h2>
        <p>You have control over how Jupiter Mail handles your emails:</p>
        <ul>
          <li>
            You can configure settings for each email category, including
            whether to mark emails as read, spam, or receive weekly digests.
          </li>
          <li>
            You can connect or disconnect email accounts from Jupiter Mail at
            any time. Disconnecting an account will stop further processing of
            emails from that account.
          </li>
        </ul>

        <h2
          id="changes-to-this-policy"
          className="mt-10 mb-4 text-2xl font-semibold tracking-tight text-gray-800 dark:text-gray-200"
        >
          Changes to This Privacy Policy
        </h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify
          you of any significant changes by posting the new Privacy Policy on
          this page and updating the &quot;Last Updated&quot; date.
        </p>

        <h2
          id="contact-us"
          className="mt-10 mb-4 text-2xl font-semibold tracking-tight text-gray-800 dark:text-gray-200"
        >
          Contact Us
        </h2>
        <p>
          If you have any questions about this Privacy Policy, please contact us
          at [Your Contact Email or Method].
        </p>
      </article>

      <div className="mt-16 text-center">
        <Link href="/landing">
          <Button variant="outline" size="lg">
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
