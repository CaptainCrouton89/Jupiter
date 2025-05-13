"use client"; // Or remove if it becomes a server component with static content

import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Lock, RefreshCw, Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

// Define an interface for the card states
interface CardStates {
  triage: boolean;
  briefings: boolean;
  security: boolean;
}

export default function LandingPage() {
  const [flippedCards, setFlippedCards] = useState<CardStates>({
    triage: false,
    briefings: false,
    security: false,
  });

  const handleFlip = (clickedCardKey: keyof CardStates) => {
    setFlippedCards((prevFlippedStates) => {
      const nextFlippedStateForClickedCard = !prevFlippedStates[clickedCardKey];

      // If the card is being flipped to its back (opened)
      if (nextFlippedStateForClickedCard) {
        const newState: CardStates = {
          triage: false,
          briefings: false,
          security: false,
        };
        newState[clickedCardKey] = true; // Open the clicked card
        return newState;
      } else {
        // If the card is being flipped to its front (closed)
        // Only close the clicked card, others remain as they were (which should be closed due to the logic above)
        return {
          ...prevFlippedStates,
          [clickedCardKey]: false,
        };
      }
    });
  };

  const featureCardsData = [
    {
      key: "triage" as keyof CardStates,
      icon: <Zap className="text-orange-600" />,
      title: "Automated Inbox Triage",
      descriptionFront:
        "Never manually sort email again. Jupiter AI intelligently archives, trashes, or marks as read, instantly.",
      descriptionBack:
        "Jupiter Mail's AI doesn't just categorize; it acts. Set rules to auto-archive, instantly trash spam, or mark routine emails as read. Configure custom actions for senders or keywords. Imagine an inbox that practically manages itself, freeing up hours of your week. This is smart automation that adapts to your workflow.",
      initialHeight: "sm:min-h-[300px] min-h-[360px]", // Adjusted for more front content
      expandedHeight: "max-h-[700px]", // Adjusted for potentially more back content
    },
    {
      key: "briefings" as keyof CardStates,
      icon: <RefreshCw className="text-orange-600" />,
      title: "Curated Weekly Briefings",
      descriptionFront:
        "Stay informed, not overwhelmed. Get concise digests of important emails, tailored to your chosen categories.",
      descriptionBack:
        "Cut through the noise. Our Weekly Briefings are more than summaries; they're personalized intelligence reports for your inbox. Choose which categories matter most—project updates, newsletters, financial alerts—and receive a focused digest. Customize the level of detail and delivery time. Stay on top of what's crucial, effortlessly.",
      initialHeight: "sm:min-h-[300px] min-h-[360px]",
      expandedHeight: "max-h-[700px]",
    },
    {
      key: "security" as keyof CardStates,
      icon: <Lock className="text-orange-600" />,
      title: "Ironclad Security & Privacy",
      descriptionFront:
        "Your data is sacred. Emails are encrypted and auto-purged after two weeks. Period.",
      descriptionBack:
        "We believe your communication is yours alone. Jupiter Mail employs robust end-to-end encryption for all emails stored on our servers. Our auto-purge protocol permanently deletes emails after two weeks—no exceptions. This means minimal data footprint and maximum peace of mind. Your privacy isn't a feature; it's a foundation.",
      initialHeight: "sm:min-h-[300px] min-h-[360px]",
      expandedHeight: "max-h-[700px]",
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

          <div className="grid md:grid-cols-3 gap-8">
            {featureCardsData.map((card) => (
              <div
                key={card.key}
                className={`relative group [perspective:1000px] transition-all duration-500 ease-in-out rounded-2xl ${
                  flippedCards[card.key]
                    ? card.expandedHeight
                    : card.initialHeight
                } group-hover:scale-[1.02] group-hover:shadow-xl cursor-pointer`}
              >
                <div
                  className={`relative w-full h-full transition-transform duration-700 ease-in-out [transform-style:preserve-3d] ${
                    flippedCards[card.key] ? "[transform:rotateY(180deg)]" : ""
                  }`}
                >
                  {/* Card Front */}
                  <div
                    className="absolute w-full h-full bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-sm border border-orange-100 [backface-visibility:hidden] flex flex-col justify-between"
                    onClick={(e) => {
                      if (!flippedCards[card.key]) {
                        e.stopPropagation();
                        handleFlip(card.key);
                      }
                    }}
                  >
                    <div>
                      <div className="bg-orange-100 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-6">
                        {card.icon}
                      </div>
                      <h3 className="text-xl font-semibold mb-3">
                        {card.title}
                      </h3>
                      <p className="text-slate-600 text-[0.92rem] leading-relaxed">
                        {card.descriptionFront}
                      </p>
                    </div>
                    <div
                      className={`mt-4 text-sm text-orange-500 group-hover:text-orange-700 font-medium transition-colors duration-300 flex items-center self-start ${
                        flippedCards[card.key] ? "invisible" : ""
                      }`}
                    >
                      Learn More <ArrowRight className="ml-1 w-4 h-4" />
                    </div>
                  </div>

                  {/* Card Back */}
                  <div
                    className="absolute w-full h-full bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg border border-orange-100 [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col justify-between overflow-y-auto cursor-pointer"
                    onClick={(e) => {
                      if (flippedCards[card.key]) {
                        e.stopPropagation();
                        handleFlip(card.key);
                      }
                    }}
                  >
                    <div>
                      <h3 className="text-xl font-semibold mb-4 text-orange-700">
                        {card.title}
                      </h3>
                      <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">
                        {card.descriptionBack}
                      </p>
                    </div>
                    {/* "Back" visual indicator - not a button itself anymore */}
                    <div className="mt-auto pt-4 text-sm text-orange-500 group-hover:text-orange-700 font-medium transition-colors duration-300 self-start flex items-center">
                      <ArrowLeft className="mr-1 w-4 h-4" /> Back
                    </div>
                  </div>
                </div>
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
