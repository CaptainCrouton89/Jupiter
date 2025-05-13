"use client";

import { ArrowRight } from "lucide-react";
import React from "react";

// This interface is also defined in app/landing/page.tsx
// Ideally, it should be in a shared types file if used in multiple places outside these two.
export interface CardStates {
  triage: boolean;
  briefings: boolean;
  security: boolean;
}

export interface FeatureCardProps {
  cardKey: keyof CardStates;
  icon: React.ReactNode;
  title: string;
  descriptionFront: string;
  descriptionBack: string;
  initialHeight: string;
  expandedHeight: string;
  isFlipped: boolean;
  onFlip: (cardKey: keyof CardStates) => void;
}

// Style Constants
const cardFaceBaseClasses =
  "w-full h-full bg-white/80 backdrop-blur-sm p-8 rounded-2xl border border-orange-100 [backface-visibility:hidden] flex flex-col justify-between";
const iconContainerClasses =
  "bg-orange-100 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-6";
const titleTextClasses = "text-xl font-semibold mb-3";
const descriptionTextClasses = "text-slate-600 text-[0.92rem] leading-relaxed";
const actionTextBaseClasses =
  "text-sm text-orange-500 group-hover:text-orange-700 font-medium transition-colors duration-300 flex items-center self-start";

export const FeatureCard: React.FC<FeatureCardProps> = ({
  cardKey,
  icon,
  title,
  descriptionFront,
  descriptionBack,
  initialHeight,
  expandedHeight,
  isFlipped,
  onFlip,
}) => {
  return (
    <div
      className={`group [perspective:1000px] transition-all duration-500 ease-in-out rounded-2xl ${
        isFlipped ? expandedHeight : initialHeight
      } group-hover:shadow-xl cursor-pointer`}
    >
      <div
        className={`relative w-full h-full transition-transform duration-700 ease-in-out [transform-style:preserve-3d] ${
          isFlipped ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        {/* Card Front */}
        <div
          className={`${cardFaceBaseClasses} absolute inset-0 shadow-sm`}
          onClick={(e) => {
            if (!isFlipped) {
              e.stopPropagation();
              onFlip(cardKey);
            }
          }}
        >
          <div>
            <div className={iconContainerClasses}>{icon}</div>
            <h3 className={titleTextClasses}>{title}</h3>
            <p className={descriptionTextClasses}>{descriptionFront}</p>
          </div>
          <div
            className={`${actionTextBaseClasses} mt-4 ${
              isFlipped ? "invisible" : ""
            }`}
          >
            Learn More <ArrowRight className="ml-1 w-4 h-4" />
          </div>
        </div>

        {/* Card Back */}
        <div
          className={`${cardFaceBaseClasses} absolute inset-0 shadow-lg [transform:rotateY(180deg)] overflow-y-auto cursor-pointer`}
          onClick={(e) => {
            if (isFlipped) {
              e.stopPropagation();
              onFlip(cardKey);
            }
          }}
        >
          <div>
            <h3 className={`${titleTextClasses} text-orange-700 mb-4`}>
              {title}
            </h3>
            <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">
              {descriptionBack}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
