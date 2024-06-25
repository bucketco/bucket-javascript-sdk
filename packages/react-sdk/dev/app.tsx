import React, { useState } from "react";

import { BucketProvider, useFlag, useFlags, useRequestFeedback } from "../src";

interface flags {
  HUDDLE: "huddle";
}

function Demos() {
  const [flagName, setFlagName] = useState("");
  const requestFeedback = useRequestFeedback();
  const flags = useFlags();
  const flag = useFlag(flagName);

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
          requestFeedback({
            featureId: "fe123",
          });
        }}
      >
        Request feedback
      </button>
    </main>
  );
}

type MyBucketProvider = BucketProvider(flags);

export function App() {
  return (
    <MyBucketProvider
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
    </MyBucketProvider>
  );
}
