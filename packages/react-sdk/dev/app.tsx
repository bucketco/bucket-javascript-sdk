import React, { useState } from "react";
import {
  useFlag,
  useFlags,
  useRequestFeedback,
  useTrack,
  BucketProvider,
  useUpdateContext,
} from "../src";

// Extending the Bucket.Flags interface to define the available flags
declare global {
  namespace Bucket {
    interface Flags {
      huddle: boolean;
    }
  }
}

function HuddleFlag() {
  // Type safe flag
  const flag = useFlag("huddle");
  return (
    <div>
      <h2>Huddle flag</h2>
      <pre>
        <code>{JSON.stringify(flag, null, 2)}</code>
      </pre>
    </div>
  );
}

// Initial context
const initialUser = {
  id: "demo-user",
  email: "demo-user@example.com",
};
const initialCompany = {
  id: "demo-company",
  name: "Demo Company",
};
const initialOtherContext = {
  test: "test",
};

function UpdateContext() {
  const [newCompany, setNewCompany] = useState(JSON.stringify(initialCompany));
  const [newUser, setNewUser] = useState(JSON.stringify(initialUser));
  const [newOtherContext, setNewOtherContext] = useState(
    JSON.stringify(initialOtherContext),
  );

  const { updateUser, updateCompany, updateOtherContext } = useUpdateContext();

  return (
    <div>
      <h2>Update context</h2>

      <table>
        <tbody>
          <tr>
            <td>
              <textarea
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
              ></textarea>
            </td>
            <td>
              <button
                onClick={() => {
                  updateCompany(JSON.parse(newCompany));
                }}
              >
                Update company
              </button>
            </td>
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
                  updateUser(JSON.parse(newUser));
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
                  updateOtherContext(JSON.parse(newOtherContext));
                }}
              >
                Update other context
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function SendEvent() {
  // Send track event
  const [eventName, setEventName] = useState("event1");
  const track = useTrack();
  return (
    <div>
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
    </div>
  );
}

function Feedback() {
  const requestFeedback = useRequestFeedback();

  return (
    <div>
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
    </div>
  );
}

// App.tsx
function Demos() {
  const { flags } = useFlags();

  return (
    <main>
      <h1>React SDK</h1>

      <HuddleFlag />

      <h2>All flags</h2>
      <pre>
        <code>{JSON.stringify(flags, null, 2)}</code>
      </pre>

      <UpdateContext />
      <Feedback />
      <SendEvent />
    </main>
  );
}

export function App() {
  return (
    <BucketProvider
      publishableKey="trdwA10Aoant6IaK3Qt45NMI"
      feedback={{
        enableLiveSatisfaction: false,
      }}
      company={initialCompany}
      user={initialUser}
      otherContext={initialOtherContext}
      flagOptions={{
        fallbackFlags: ["huddle"],
      }}
    >
      <Demos />
      {}
    </BucketProvider>
  );
}
