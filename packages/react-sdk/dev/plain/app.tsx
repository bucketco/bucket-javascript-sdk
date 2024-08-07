import React, { useState } from "react";

import {
  BucketProvider,
  useFeature,
  useFeatures,
  useRequestFeedback,
  useTrack,
  useUpdateContext,
} from "../../src";

// Extending the Features interface to define the available features
declare module "../../src" {
  interface Features {
    huddle: boolean;
  }
}

const publishableKey = process.env.PUBLISHABLE_KEY || "";

function HuddleFeature() {
  // Type safe feature
  const feature = useFeature("huddle");
  return (
    <div>
      <h2>Huddle feature</h2>
      <pre>
        <code>{JSON.stringify(feature, null, 2)}</code>
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
  const { features } = useFeatures();

  return (
    <main>
      <h1>React SDK</h1>

      <HuddleFeature />

      <h2>All features</h2>
      <pre>
        <code>{JSON.stringify(features, null, 2)}</code>
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
      publishableKey={publishableKey}
      feedback={{
        enableLiveSatisfaction: true,
      }}
      company={initialCompany}
      user={initialUser}
      otherContext={initialOtherContext}
      featureOptions={{
        fallbackFeatures: ["huddle"],
      }}
    >
      <Demos />
      {}
    </BucketProvider>
  );
}
