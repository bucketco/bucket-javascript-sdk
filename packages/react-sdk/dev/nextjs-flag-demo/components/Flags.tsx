"use client";

import React from "react";
import { useFlags } from "@bucketco/react-sdk";

export const Flags = () => {
  const flags = useFlags();
  return (
    <div className="border border-gray-300 p-6 rounded-xl dark:border-neutral-800 dark:bg-zinc-800/30">
      <h3 className="text-xl mb-4">Current flags:</h3>
      <pre>
        <code className="font-mono font-bold">
          {JSON.stringify(flags, undefined, 2)}
        </code>
      </pre>
    </div>
  );
};
