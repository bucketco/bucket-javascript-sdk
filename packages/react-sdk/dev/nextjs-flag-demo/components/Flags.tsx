"use client";

import React from "react";
import { useFeatures } from "@bucketco/react-sdk";

export const Features = () => {
  const features = useFeatures();
  return (
    <div className="border border-gray-300 p-6 rounded-xl dark:border-neutral-800 dark:bg-zinc-800/30">
      <h3 className="text-xl mb-4">Enabled features:</h3>
      <pre>
        <code className="font-mono font-bold">
          {JSON.stringify(features, undefined, 2)}
        </code>
      </pre>
    </div>
  );
};
