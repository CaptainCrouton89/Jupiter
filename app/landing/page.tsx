"use client"; // Or remove if it becomes a server component with static content

import { Button } from "@/components/ui/button";
import {
  FeatureCard,
  CardStates as FeatureCardStates,
} from "@/components/ui/FeatureCard"; // Import the new component and its state type
import {
  ArrowRight,
  Brain,
  Coffee,
  Lock,
  Mail,
  RefreshCw,
  SlidersHorizontal,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

// Renamed to avoid conflict if CardStates is imported from FeatureCard.tsx
// Or, if CardStates is only used here now, its definition in FeatureCard.tsx could be removed.
interface LandingPageCardStates extends FeatureCardStates {}

export default function LandingPage() {
  const [flippedCards, setFlippedCards] = useState<LandingPageCardStates>({
    triage: false,
    briefings: false,
    security: false,
  });

  const handleFlip = (clickedCardKey: keyof LandingPageCardStates) => {
    setFlippedCards((prevFlippedStates) => {
      const nextFlippedStateForClickedCard = !prevFlippedStates[clickedCardKey];

      if (nextFlippedStateForClickedCard) {
        const newState: LandingPageCardStates = {
          triage: false,
          briefings: false,
          security: false,
        };
        newState[clickedCardKey] = true;
        return newState;
      } else {
        return {
          ...prevFlippedStates,
          [clickedCardKey]: false,
        };
      }
    });
  };

  const featureCardsData = [
    {
      key: "triage" as keyof LandingPageCardStates,
      icon: <Zap className="text-orange-600" />,
      title: "Automated Inbox Triage",
      descriptionFront:
        "Never manually sort email again. Jupiter AI intelligently archives, trashes, or marks as read, instantly.",
      descriptionBack:
        "Jupiter Mail employs advanced AI to analyze and categorize every incoming email—from newsletters to personal notes—by understanding its sender, subject, content, and even subtle email cues. Then, according to *your* personalized preferences set for each category (like 'archive all marketing,' 'mark newsletters as read'), Jupiter automatically sorts your mail. This means a cleaner inbox, managed for you, before you even open it.",
      initialHeight: "min-h-[340px]",
      expandedHeight: "min-h-[340px]",
    },
    {
      key: "briefings" as keyof LandingPageCardStates,
      icon: <RefreshCw className="text-orange-600" />,
      title: "Curated Weekly Briefings",
      descriptionFront:
        "Stay informed, not overwhelmed. Get concise digests of important emails, tailored to your chosen categories.",
      descriptionBack:
        "Choose the email categories you can't miss—like project updates, financial alerts, or specific newsletters. Our AI then intelligently summarizes each email within those chosen categories, extracting the core information into brief, easy-to-digest highlights. You receive a single, weekly email compiling these smart summaries, allowing you to absorb vital updates in minutes, not hours.",
      initialHeight: "min-h-[340px]",
      expandedHeight: "min-h-[340px]",
    },
    {
      key: "security" as keyof LandingPageCardStates,
      icon: <Lock className="text-orange-600" />,
      title: "Ironclad Security & Privacy",
      descriptionFront:
        "Your data is sacred. Emails are encrypted and auto-purged after two weeks. Period.",
      descriptionBack:
        "We prioritize your privacy. Any email data processed and temporarily stored by Jupiter Mail is encrypted on our secure servers. More importantly, we enforce a strict 14-day data retention policy: all processed email content is automatically and permanently purged from our systems after two weeks. This data minimization is fundamental to our design, ensuring your information isn't held longer than absolutely necessary.",
      initialHeight: "min-h-[340px]",
      expandedHeight: "min-h-[340px]",
    },
  ];

  const howItWorksSteps = [
    {
      icon: <Mail className="w-10 h-10 text-orange-600" />,
      title: "1. Connect Your Email",
      description:
        "Securely link your Google account in seconds. We use industry-standard encryption to protect your credentials.",
    },
    {
      icon: <SlidersHorizontal className="w-10 h-10 text-orange-600" />,
      title: "2. Customize Your Rules",
      description:
        "Tell Jupiter Mail how to handle different email categories (like newsletters or notifications) and which ones to include in your weekly digest.",
    },
    {
      icon: <Brain className="w-10 h-10 text-orange-600" />,
      title: "3. AI Takes Over",
      description:
        "Our intelligent system automatically triages your inbox based on your rules and compiles concise weekly briefings, saving you hours.",
    },
    {
      icon: <Coffee className="w-10 h-10 text-orange-600" />,
      title: "4. Enjoy Your Focus",
      description:
        "Experience a calmer, more organized inbox. Spend less time managing email and more time on what matters.",
    },
  ];

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

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {featureCardsData.map((card) => (
              <FeatureCard
                key={card.key}
                cardKey={card.key}
                icon={card.icon}
                title={card.title}
                descriptionFront={card.descriptionFront}
                descriptionBack={card.descriptionBack}
                initialHeight={card.initialHeight}
                expandedHeight={card.expandedHeight}
                isFlipped={flippedCards[card.key]}
                onFlip={handleFlip}
              />
            ))}
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-16 md:py-24">
          <h2 className="text-3xl font-bold text-center mb-16 text-slate-800">
            Getting Started is Simple
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
            {howItWorksSteps.map((step, index) => (
              <div
                key={index}
                className="flex flex-col items-center text-center"
              >
                <div className="bg-white/70 backdrop-blur-sm p-5 rounded-full inline-block mb-6 shadow-md border border-orange-100">
                  {step.icon}
                </div>
                <h3 className="text-xl font-semibold mb-3 text-slate-700">
                  {step.title}
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
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
          <p className="mb-4 text-sm">
            We are committed to your privacy and data security. Learn more:
          </p>
          <div className="flex justify-center gap-6">
            <Link
              href="/privacy"
              className="hover:text-orange-600 transition-colors underline"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
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
