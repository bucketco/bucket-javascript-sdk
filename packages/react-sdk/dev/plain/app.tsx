import React, { useState } from "react";

import {
  FeatureKey,
  BucketProvider,
  useFeature,
  useRequestFeedback,
  useTrack,
  useUpdateCompany,
  useUpdateOtherContext,
  useUpdateUser,
} from "../../src";

// Extending the Features interface to define the available features
declare module "../../src" {
  interface Features {
    huddles: boolean;
  }
}

const publishableKey = import.meta.env.VITE_PUBLISHABLE_KEY || "";
const host = import.meta.env.VITE_BUCKET_HOST;

function HuddleFeature() {
  // Type safe feature
  const feature = useFeature("huddles");
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
  const updateUser = useUpdateUser();
  const updateCompany = useUpdateCompany();
  const updateOtherContext = useUpdateOtherContext();

  const [newUser, setNewUser] = useState(JSON.stringify(initialUser));
  const [newCompany, setNewCompany] = useState(JSON.stringify(initialCompany));
  const [newOtherContext, setNewOtherContext] = useState(
    JSON.stringify(initialOtherContext),
  );

  return (
    <div>
      <h2>Update context</h2>
      <div>
        Update the context by editing the textarea. User/company IDs cannot be
        changed here.
      </div>
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
              <button onClick={() => updateCompany(JSON.parse(newCompany))}>
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
              <button onClick={() => updateUser(JSON.parse(newUser))}>
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
                onClick={() => updateOtherContext(JSON.parse(newOtherContext))}
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
        onClick={(e) =>
          requestFeedback({
            title: "How do you like Huddles?",
            featureKey: "huddle",
            position: {
              type: "POPOVER",
              anchor: e.currentTarget as HTMLElement,
            },
          })
        }
      >
        Request feedback
      </button>
    </div>
  );
}

// App.tsx
function Demos() {
  return (
    <main>
      <h1>React SDK</h1>

      <HuddleFeature />

      <h2>Feature opt-in</h2>
      <div>
        Create a <code>huddle</code> feature and set a rule:{" "}
        <code>optin-huddles IS TRUE</code>. Hit the checkbox below to opt-in/out
        of the feature.
      </div>
      <FeatureOptIn featureKey={"huddles"} featureName={"Huddles"} />

      <UpdateContext />
      <Feedback />
      <SendEvent />
    </main>
  );
}

function FeatureOptIn({
  featureKey,
  featureName,
}: {
  featureKey: FeatureKey;
  featureName: string;
}) {
  const updateUser = useUpdateUser();
  const [sendingUpdate, setSendingUpdate] = useState(false);
  const { isEnabled } = useFeature(featureKey);

  return (
    <div>
      <label htmlFor="huddlesOptIn">Opt-in to {featureName} feature</label>
      <input
        disabled={sendingUpdate}
        id="huddlesOptIn"
        type="checkbox"
        checked={isEnabled}
        onChange={() => {
          setSendingUpdate(true);
          updateUser({
            [`optin-${featureKey}`]: isEnabled ? "false" : "true",
          })?.then(() => {
            setSendingUpdate(false);
          });
        }}
      />
    </div>
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
      host={host}
    >
      <Demos />
      {}
    </BucketProvider>
  );
}
