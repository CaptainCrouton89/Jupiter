"use client"; // Or remove if it becomes a server component with static content

import { Button } from "@/components/ui/button";
import { ArrowRight, Lock, RefreshCw, Zap } from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-100 via-amber-50 to-orange-50 text-slate-800">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Navigation */}
        <nav className="flex justify-between items-center py-6">
          <h2 className="font-bold text-2xl bg-gradient-to-r from-orange-500 to-amber-600 bg-clip-text text-transparent">
            Jupiter Mail
          </h2>
          <Link href="/login" passHref>
            <Button
              variant="outline"
              className="text-slate-700 bg-white/70 backdrop-blur-sm"
            >
              Login
            </Button>
          </Link>
        </nav>

        {/* Hero Section */}
        <header className="flex flex-col items-center justify-center py-16 md:py-24 text-center">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight bg-gradient-to-r from-orange-600 via-amber-500 to-orange-500 bg-clip-text text-transparent leading-tight md:leading-tight py-1">
              Finally. Inbox Zero, Effortlessly.
            </h1>
            <p className="text-lg md:text-xl mb-8 text-slate-600 max-w-2xl mx-auto">
              Jupiter Mail tames your chaotic inbox with AI-powered automation.
              Reclaim your focus.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/api/auth/google/initiate?next=/settings" passHref>
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 border-0"
                >
                  Experience Inbox Peace
                  <ArrowRight className="ml-1" />
                </Button>
              </Link>
              <Link href="/login" passHref>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-orange-200 bg-white/70 hover:bg-orange-100 text-slate-700"
                >
                  Access Your Account
                </Button>
              </Link>
            </div>
          </div>
        </header>

        {/* Features Section */}
        <section className="py-16 md:py-24">
          <h2 className="text-3xl font-bold text-center mb-12 text-slate-800">
            Stop Drowning in Email. Start Thriving.
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-sm border border-orange-100 hover:shadow-md transition-shadow">
              <div className="bg-orange-100 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-6">
                <Zap className="text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">
                Automated Inbox Triage
              </h3>
              <p className="text-slate-600">
                Never manually sort email again. Jupiter AI intelligently
                archives, trashes, or marks as read, instantly.
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-sm border border-orange-100 hover:shadow-md transition-shadow">
              <div className="bg-orange-100 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-6">
                <RefreshCw className="text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">
                Curated Weekly Briefings
              </h3>
              <p className="text-slate-600">
                Stay informed, not overwhelmed. Get concise digests of important
                emails, tailored to your chosen categories.
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-sm border border-orange-100 hover:shadow-md transition-shadow">
              <div className="bg-orange-100 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-6">
                <Lock className="text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">
                Ironclad Security & Privacy
              </h3>
              <p className="text-slate-600">
                Your data is sacred. Emails are encrypted and auto-purged after
                two weeks. Period.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 md:py-20 mb-12">
          <div className="bg-gradient-to-r from-orange-500 to-amber-600 rounded-3xl p-10 md:p-16 text-white text-center shadow-xl">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Conquer Your Inbox?
            </h2>
            <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
              Sign up in seconds. Experience the future of email management
              today.
            </p>
            <Link href="/api/auth/google/initiate?next=/settings" passHref>
              <Button
                size="lg"
                variant="secondary"
                className="bg-white text-orange-600 hover:bg-orange-50"
              >
                Get Jupiter Mail Now
              </Button>
            </Link>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-orange-100/50 py-10 text-center text-slate-500">
        <div className="container mx-auto px-4">
          <p className="mb-4">
            &copy; {new Date().getFullYear()} Jupiter Mail. All rights reserved.
          </p>
          <div className="flex justify-center gap-6">
            <Link
              href="/privacy"
              className="hover:text-orange-600 transition-colors underline"
            >
              Privacy Policy
            </Link>
            <Link
              href="#"
              className="hover:text-orange-600 transition-colors underline"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
