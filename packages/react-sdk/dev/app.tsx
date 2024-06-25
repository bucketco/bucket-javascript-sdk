import React, { useState } from "react";

import { TypedBucket } from "../src";

const flags = {
  huddle: false,
};

const MyBucket = TypedBucket(flags);
export const { useFlag, useFlags, useRequestFeedback } = MyBucket;

function Demos() {
  const [flagName, setFlagName] = useState("");
  const requestFeedback = useRequestFeedback();
  const flags = useFlags();
  const flag = useFlag("huddle");

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

export function App() {
  return (
    <MyBucket.Provider
      publishableKey="trdwA10Aoant6IaK3Qt45NMI"
      persistUser={false}
      feedback={{
        enableLiveSatisfaction: false,
      }}
      user={{
        id: "demo-user",
        email: "demo-user@example.com",
      }}
      company={{
        id: "demo-company",
      }}
    >
      <Demos />
      {}
    </MyBucket.Provider>
  );
}
