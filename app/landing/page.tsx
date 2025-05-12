"use client"; // Or remove if it becomes a server component with static content

import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <header className="container mx-auto text-center py-16">
        <h1 className="text-5xl font-bold mb-6">Welcome to Jupiter Mail</h1>
        <p className="text-xl mb-8 text-slate-300">
          The AI-empowered mail client that helps you manage your inbox smarter.
        </p>
        <div className="space-x-4">
          <Link href="/login" passHref>
            <Button size="lg" variant="secondary">
              Login
            </Button>
          </Link>
          <Link href="/api/auth/google/initiate?next=/settings" passHref>
            {" "}
            {/* Assuming sign up might often be via Google */}
            <Button size="lg">Sign Up with Google</Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto text-center px-6 py-12">
        <section className="mb-12">
          <h2 className="text-3xl font-semibold mb-4">Key Features</h2>
          <div className="grid md:grid-cols-3 gap-8 text-left">
            <div className="bg-slate-800 p-6 rounded-lg shadow-lg">
              <h3 className="text-xl font-semibold mb-2">
                Intelligent Categorization
              </h3>
              <p className="text-slate-400">
                Automatically categorize your emails to keep your inbox
                organized.
              </p>
            </div>
            <div className="bg-slate-800 p-6 rounded-lg shadow-lg">
              <h3 className="text-xl font-semibold mb-2">Smart Actions</h3>
              <p className="text-slate-400">
                Set rules to mark emails as read or spam based on their
                category.
              </p>
            </div>
            <div className="bg-slate-800 p-6 rounded-lg shadow-lg">
              <h3 className="text-xl font-semibold mb-2">Weekly Digests</h3>
              <p className="text-slate-400">
                Receive summary emails for categories you care about, keeping
                you informed without the clutter.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="w-full py-8 text-center text-slate-400">
        <p>
          &copy; {new Date().getFullYear()} Jupiter Mail. All rights reserved.
        </p>
        <Link href="/privacy" className="hover:text-slate-200 underline">
          Privacy Policy
        </Link>
      </footer>
    </div>
  );
}
