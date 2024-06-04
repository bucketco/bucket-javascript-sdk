import React, { useState } from "react";

import Bucket, { useBucket, useFeatureFlag, useFeatureFlags } from "../src";

function Demos() {
  const [flagName, setFlagName] = useState("");
  const bucket = useBucket();
  const flags = useFeatureFlags();
  const flag = useFeatureFlag(flagName);

  return (
    <main>
      <h1>React SDK</h1>

      <h2>Flags</h2>
      <pre>
        <code>{JSON.stringify(flags, null, 2)}</code>
      </pre>

      <h2>Specific flag</h2>
      <select
        value={flagName}
        onChange={(e) => {
          setFlagName(e.currentTarget.value);
        }}
      >
        <option value="">Select a flag</option>
        {Object.keys(flags).map((key) => {
          return (
            <option key={key} value={key}>
              {key}
            </option>
          );
        })}
      </select>
      <pre>
        <code>{JSON.stringify(flag, null, 2)}</code>
      </pre>

      <h2>Feedback</h2>
      <button
        onClick={() => {
          bucket.requestFeedback({
            featureId: "fe123",
            userId: "user123",
          });
        }}
      >
        Request feedback
      </button>
    </main>
  );
}

export function App() {
  return (
    <Bucket
      publishableKey="trdwA10Aoant6IaK3Qt45NMI"
      persistUser={false}
      feedback={{
        enableLiveSatisfaction: false,
      }}
      flags={{
        context: {
          user: {
            id: "demo-user",
            email: "demo-user@example.com",
          },
          company: {
            id: "demo-company",
          },
        },
      }}
    >
      <Demos />
    </Bucket>
  );
}
