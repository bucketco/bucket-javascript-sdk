"use client";

import { initOpenFeature } from "@/app/flagManagement";
import { OpenFeatureProvider as OFProvider } from "@openfeature/react-sdk";
import { useEffect } from "react";

export const OpenFeatureProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  useEffect(() => {
    initOpenFeature();
  }, []);

  return <OFProvider>{children}</OFProvider>;
};
