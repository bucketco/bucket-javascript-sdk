import React, { useState } from "react";

import {
  useCompany,
  useFlag,
  useFlags,
  useOtherContext,
  useRequestFeedback,
  useTrack,
  useUser,
} from "./bucket";

// App.tsx
function Demos() {
  const [flagName, setFlagName] = useState("");
  const requestFeedback = useRequestFeedback();
  const flags = useFlags();
  const flag = useFlag("huddle");

  // Update context
  const [company, setCompany] = useCompany();
  const [user, setUser] = useUser();
  const [otherContext, setOtherContext] = useOtherContext();

  const [newCompany, setNewCompany] = useState(JSON.stringify(company));
  const [newUser, setNewUser] = useState(JSON.stringify(user));
  const [newOtherContext, setNewOtherContext] = useState(
    JSON.stringify(otherContext),
  );

  // Send track event
  const [eventName, setEventName] = useState("event1");
  const track = useTrack();

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
        {Object.keys(flags.flags).map((key) => {
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

      <h2>Update context</h2>

      <table>
        <tr>
          <td>
            <textarea
              value={newCompany}
              onChange={(e) => setNewCompany(e.target.value)}
            ></textarea>
          </td>
          <button
            onClick={() => {
              setCompany(JSON.parse(newCompany));
            }}
          >
            Update company
          </button>
        </tr>
        <tr>
          <td>
            <textarea
              value={newUser}
              onChange={(e) => setNewUser(e.target.value)}
            ></textarea>
          </td>
          <td>
            <button
              onClick={() => {
                setUser(JSON.parse(newUser));
              }}
            >
              Update user
            </button>
          </td>
        </tr>
        <tr>
          <td>
            <textarea
              value={newOtherContext}
              onChange={(e) => setNewOtherContext(e.target.value)}
            ></textarea>
          </td>
          <td>
            <button
              onClick={() => {
                setOtherContext(JSON.parse(newOtherContext));
              }}
            >
              Update other context
            </button>
          </td>
        </tr>
      </table>

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

      <h2>Send event</h2>
      <input
        onChange={(e) => setEventName(e.target.value)}
        type="text"
        placeholder="Event name"
        value={eventName}
      />
      <button
        onClick={() => {
          track(eventName);
        }}
      >
        Send event
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
