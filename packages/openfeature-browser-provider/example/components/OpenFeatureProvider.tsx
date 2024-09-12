"use client";

import { OpenFeatureProvider as OFProvider } from "@openfeature/react-sdk";

export const OpenFeatureProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return <OFProvider>{children}</OFProvider>;
};
