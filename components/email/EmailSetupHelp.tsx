"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { HelpCircle } from "lucide-react";
import Link from "next/link";

export function EmailSetupHelp() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <HelpCircle className="mr-2 h-4 w-4" />
          Help with Email Setup
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Email Setup Help</DialogTitle>
          <DialogDescription>
            Find information about setting up your email accounts in Jupiter
            Mail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Gmail Settings</h3>
            <p className="text-sm text-muted-foreground mb-4">
              To connect your Gmail account, we recommend using the "Connect
              with Google" button for the simplest setup. For manual setup, use
              these settings:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-md p-3">
                <h4 className="font-medium mb-2">
                  IMAP Settings (Incoming Mail)
                </h4>
                <ul className="space-y-1 text-sm">
                  <li>
                    <span className="font-medium">Server:</span> imap.gmail.com
                  </li>
                  <li>
                    <span className="font-medium">Port:</span> 993
                  </li>
                  <li>
                    <span className="font-medium">Encryption:</span> SSL/TLS
                  </li>
                  <li>
                    <span className="font-medium">Username:</span> Your full
                    Gmail address
                  </li>
                  <li>
                    <span className="font-medium">Password:</span> Your Gmail
                    password or app password
                  </li>
                </ul>
              </div>

              <div className="border rounded-md p-3">
                <h4 className="font-medium mb-2">
                  SMTP Settings (Outgoing Mail)
                </h4>
                <ul className="space-y-1 text-sm">
                  <li>
                    <span className="font-medium">Server:</span> smtp.gmail.com
                  </li>
                  <li>
                    <span className="font-medium">Port:</span> 465 (SSL) or 587
                    (TLS)
                  </li>
                  <li>
                    <span className="font-medium">Encryption:</span> SSL/TLS
                  </li>
                  <li>
                    <span className="font-medium">Username:</span> Your full
                    Gmail address
                  </li>
                  <li>
                    <span className="font-medium">Password:</span> Your Gmail
                    password or app password
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-4 text-sm text-muted-foreground">
              <p className="font-medium">Important Notes for Gmail:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>
                  You may need to{" "}
                  <Link
                    href="https://myaccount.google.com/lesssecureapps"
                    className="text-primary underline"
                    target="_blank"
                  >
                    enable less secure apps
                  </Link>{" "}
                  or use an{" "}
                  <Link
                    href="https://myaccount.google.com/apppasswords"
                    className="text-primary underline"
                    target="_blank"
                  >
                    app password
                  </Link>{" "}
                  if you have 2-factor authentication enabled.
                </li>
                <li>
                  Make sure IMAP is enabled in your Gmail settings (Settings
                  &gt; See all settings &gt; Forwarding and POP/IMAP).
                </li>
              </ul>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Outlook Settings</h3>
            <p className="text-sm text-muted-foreground mb-4">
              To connect your Outlook.com, Hotmail, or Live account, we
              recommend using the "Connect with Microsoft" button. For manual
              setup, use these settings:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-md p-3">
                <h4 className="font-medium mb-2">
                  IMAP Settings (Incoming Mail)
                </h4>
                <ul className="space-y-1 text-sm">
                  <li>
                    <span className="font-medium">Server:</span>{" "}
                    outlook.office365.com
                  </li>
                  <li>
                    <span className="font-medium">Port:</span> 993
                  </li>
                  <li>
                    <span className="font-medium">Encryption:</span> SSL/TLS
                  </li>
                  <li>
                    <span className="font-medium">Username:</span> Your full
                    email address
                  </li>
                  <li>
                    <span className="font-medium">Password:</span> Your account
                    password
                  </li>
                </ul>
              </div>

              <div className="border rounded-md p-3">
                <h4 className="font-medium mb-2">
                  SMTP Settings (Outgoing Mail)
                </h4>
                <ul className="space-y-1 text-sm">
                  <li>
                    <span className="font-medium">Server:</span>{" "}
                    smtp-mail.outlook.com
                  </li>
                  <li>
                    <span className="font-medium">Port:</span> 587
                  </li>
                  <li>
                    <span className="font-medium">Encryption:</span> STARTTLS
                  </li>
                  <li>
                    <span className="font-medium">Username:</span> Your full
                    email address
                  </li>
                  <li>
                    <span className="font-medium">Password:</span> Your account
                    password
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Other Email Providers</h3>
            <p className="text-sm">
              For other email providers (Yahoo, AOL, iCloud, etc.), please check
              your provider's documentation for the correct IMAP and SMTP
              settings. Most providers have a help page with these details.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Troubleshooting</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>
                If you receive authentication errors, double-check your username
                and password.
              </li>
              <li>
                For Gmail accounts, you might need to create an app password if
                you use 2-factor authentication.
              </li>
              <li>
                Some providers require you to explicitly enable IMAP access in
                your account settings.
              </li>
              <li>
                Corporate email accounts may have additional security
                restrictions. Contact your IT administrator for assistance.
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Official Documentation</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>
                <Link
                  href="https://support.google.com/mail/answer/7126229"
                  className="text-primary underline"
                  target="_blank"
                >
                  Gmail IMAP/SMTP Settings
                </Link>
              </li>
              <li>
                <Link
                  href="https://support.microsoft.com/en-us/office/pop-imap-and-smtp-settings-for-outlook-com-d088b986-291d-42b8-9564-9c414e2aa040"
                  className="text-primary underline"
                  target="_blank"
                >
                  Outlook.com IMAP/SMTP Settings
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
