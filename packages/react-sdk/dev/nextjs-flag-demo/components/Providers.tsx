"use client";

import React, { ReactNode } from "react";
import { BucketProvider } from "@reflag/react-sdk";

type Props = {
  publishableKey: string;
  children: ReactNode;
};

export const Providers = ({ publishableKey, children }: Props) => {
  return (
    <BucketProvider
      publishableKey={publishableKey}
      company={{ id: "acme_inc" }}
      user={{ id: "john doe" }}
      fallbackFlags={["fallback-feature"]}
    >
      {children}
    </BucketProvider>
  );
};
