"use client";

import React from "react";
import { useBooleanFlagValue } from "@openfeature/react-sdk";
import { track } from "@/app/featureManagement";

const featureKey = "huddle";

export const HuddleFeature = () => {
  const isEnabled = useBooleanFlagValue(featureKey, false);
  return (
    <div className="border border-gray-300 p-6 rounded-xl dark:border-neutral-800 dark:bg-zinc-800/30">
      <h3 className="text-xl mb-4">Huddle feature enabled:</h3>
      <pre>
        <code className="font-mono font-bold">{JSON.stringify(isEnabled)}</code>
      </pre>
      <button
        className="border-solid m-auto max-w-60 border-2 border-indigo-600 rounded-lg p-2 mt-4 disabled:opacity-50"
        onClick={() => track(featureKey)}
      >
        Track usage
      </button>
    </div>
  );
};
