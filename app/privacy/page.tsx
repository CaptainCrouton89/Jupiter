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
          information when you use our application. We are committed to
          protecting your privacy and ensuring you understand how your
          information is collected, used, and safeguarded to provide our
          services.
        </p>

        <h2 id="how-it-works">1. How Jupiter Mail Works</h2>
        <p>
          Jupiter Mail is designed to help you manage your email inbox more
          effectively. Our core functionalities related to email handling
          include:
        </p>
        <ul>
          <li>
            <strong>Automated Email Actions:</strong> Based on settings you
            configure for different email categories (e.g., newsletters,
            marketing, notifications), Jupiter Mail can perform actions on your
            emails. This includes:
            <ul>
              <li>
                Marking Emails as Read, Archiving, Trashing, or Marking as Spam:
                These actions are performed based on your explicit consent and
                configuration within the application settings.
              </li>
            </ul>
          </li>
          <li>
            <strong>Weekly Digest Emails:</strong> For email categories you
            select, Jupiter Mail can compile and send you a weekly digest. This
            digest summarizes the emails that were classified into those chosen
            categories during the week.
          </li>
        </ul>
        <p>
          To provide these services, Jupiter Mail requires access to your email
          account(s) that you connect.
        </p>

        <h2 id="information-we-collect">2. Information We Collect and Use</h2>
        <p>
          To provide and improve Jupiter Mail, we access and use the following
          types of information:
        </p>
        <ul>
          <li>
            <strong>Email Content:</strong>
            <ul>
              <li>
                Email headers (sender, recipient, subject, date) to categorize
                and process emails.
              </li>
              <li>
                Email body content (text and HTML) for categorization,
                performing actions you've configured (like identifying content
                for rules), and generating summaries for digests.
              </li>
              <li>
                List of your email folders and email UIDs/IDs for
                synchronization and performing actions.
              </li>
            </ul>
          </li>
          <li>
            <strong>Authentication Tokens:</strong> When you connect your email
            account (e.g., via Google OAuth), we securely store the
            authentication tokens required to access your emails on your behalf.
            We do not store your actual email account password.
          </li>
          <li>
            <strong>User Settings and Preferences:</strong> We store your
            configured settings, such as rules for email categories, digest
            preferences, and other customizations, to personalize your
            experience.
          </li>
        </ul>
        <p>
          We use this information solely for the purpose of providing the email
          management features of Jupiter Mail.
        </p>

        <h2 id="data-storage-security-retention">
          3. Data Storage, Security, and Retention
        </h2>
        <h3 className="text-xl font-semibold !mt-6 !mb-3">Security Measures</h3>
        <p>
          We implement industry-standard security measures to protect your
          information. Your email account authentication tokens and user
          settings are stored securely and encrypted at rest. Our database and
          authentication services are provided by Supabase, which employs robust
          security practices.
        </p>
        <p>
          However, no system is completely secure, and we cannot guarantee the
          absolute security of your data. You are responsible for maintaining
          the security of your own accounts and devices.
        </p>

        <h3 className="text-xl font-semibold !mt-6 !mb-3">
          Email Content Processing
        </h3>
        <p>
          Email content processed for categorization or digest generation is
          handled by third-party AI models (such as those provided by OpenAI).
          This processing is done to deliver the core features of our service.
        </p>

        <h3 className="text-xl font-semibold !mt-6 !mb-3">Data Retention</h3>
        <ul>
          <li>
            <strong>Processed Email Content:</strong> To protect your privacy
            and minimize data storage, any email body content that Jupiter Mail
            processes for features like categorization or digest summaries is
            automatically and permanently purged from our systems within 14 days
            of processing. We only retain the metadata and summaries necessary
            for your digests as configured.
          </li>
          <li>
            <strong>Account Information and Settings:</strong> Your account
            information (like your user ID and connected email addresses, but
            not email content) and your configured settings are retained as long
            as your Jupiter Mail account is active. If you delete your account
            or disconnect an email service, we will delete this information in
            accordance with our policies, typically within a reasonable
            timeframe unless retention is required for legal or operational
            reasons (e.g., resolving disputes).
          </li>
          <li>
            <strong>Authentication Tokens:</strong> These are retained as long
            as your email account is actively connected to Jupiter Mail and are
            deleted when you disconnect the account.
          </li>
        </ul>
        <p>You retain ownership of your email data at all times.</p>

        <h2 id="third-party-services">4. Third-Party Services</h2>
        <p>
          We utilize third-party services to provide Jupiter Mail. These
          services have their own privacy policies, and we encourage you to
          review them:
        </p>
        <ul>
          <li>
            <strong>Supabase:</strong> Used for database hosting, user
            authentication, and backend infrastructure. Their privacy policy can
            be found at{" "}
            <a
              href="https://supabase.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              supabase.com/privacy
            </a>
            .
          </li>
          <li>
            <strong>OpenAI (or similar AI providers):</strong> Used for
            AI-powered email categorization and summarization. OpenAI&apos;s
            privacy policy can be found at{" "}
            <a
              href="https://openai.com/policies/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
            >
              openai.com/policies/privacy-policy
            </a>
            . We aim to use providers that align with strong data privacy and
            security principles.
          </li>
        </ul>

        <h2 id="your-rights-choices">5. Your Rights and Choices</h2>
        <p>You have control over your information and how it&apos;s used:</p>
        <ul>
          <li>
            <strong>Access, Correction, and Deletion:</strong> You may have the
            right to access, correct, or request deletion of your personal
            information held by Jupiter Mail. Please contact us to make such
            requests.
          </li>
          <li>
            <strong>Manage Preferences:</strong> You can configure settings for
            each email category, including actions and digest preferences,
            directly within the application.
          </li>
          <li>
            <strong>Disconnect Accounts:</strong> You can connect or disconnect
            email accounts from Jupiter Mail at any time through the settings.
            Disconnecting an account will stop further processing of emails from
            that account by Jupiter Mail. Associated authentication tokens will
            be deleted.
          </li>
          <li>
            <strong>Withdraw Consent:</strong> Where we rely on your consent to
            process information (e.g., for accessing your email account), you
            can withdraw that consent at any time by disconnecting your account
            or adjusting your settings.
          </li>
          <li>
            <strong>Object to Processing:</strong> You may have the right to
            object to certain types of processing.
          </li>
        </ul>
        <p>
          Please note that some choices may affect our ability to provide
          certain features of the service.
        </p>

        <h2 id="childrens-privacy">6. Children&apos;s Privacy</h2>
        <p>
          Jupiter Mail is not directed to individuals under the age of 13 (or a
          higher age if stipulated by applicable law). We do not knowingly
          collect personal information from children. If we become aware that a
          child has provided us with personal information, we will take steps to
          delete such information.
        </p>

        <h2 id="changes-to-this-policy">7. Changes to This Privacy Policy</h2>
        <p>
          We may update this Privacy Policy from time to time to reflect changes
          in our practices or for other operational, legal, or regulatory
          reasons. We will notify you of any significant changes by posting the
          new Privacy Policy on this page and updating the &quot;Last
          Updated&quot; date. We encourage you to review this Privacy Policy
          periodically.
        </p>

        <h2
          id="contact-us"
          className="mt-10 mb-4 text-2xl font-semibold tracking-tight text-gray-800 dark:text-gray-200"
        >
          Contact Us
        </h2>
        <p>
          If you have any questions about this Privacy Policy, please contact us
          at silas@rhyneerconsulting.com.
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
