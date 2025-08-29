import React, { useState } from "react";

import {
  ReflagProvider,
  useRequestFeedback,
  useTrack,
  useUpdateCompany,
  useUpdateOtherContext,
  useUpdateUser,
  useClient,
  useFlag,
  FlagKey,
} from "../../src";

// Extending the Flags interface to define the available flags
declare module "../../src" {
  interface Flags {
    huddles: {
      config: {
        payload: {
          maxParticipants: number;
        };
      };
    };
    showHeader: true;
  }
}

const publishableKey = import.meta.env.VITE_PUBLISHABLE_KEY || "";
const apiBaseUrl = import.meta.env.VITE_REFLAG_API_BASE_URL;

function HuddleFeature() {
  // Type safe feature
  const flag = useFlag("huddles");

  return (
    <div>
      <h2>Huddle feature</h2>
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
            flagKey: "huddles",
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
        Create a <code>huddle</code> flag and set a rule:{" "}
        <code>optin-huddles IS TRUE</code>. Hit the checkbox below to opt-in/out
        of the flag.
      </div>
      <FeatureOptIn flagKey={"huddles"} featureName={"Huddles"} />

      <UpdateContext />
      <Feedback />
      <SendEvent />
      <CustomToolbar />
    </main>
  );
}

function FeatureOptIn({
  flagKey,
  featureName,
}: {
  flagKey: FlagKey;
  featureName: string;
}) {
  const updateUser = useUpdateUser();
  const [sendingUpdate, setSendingUpdate] = useState(false);
  const value = useFlag(flagKey);

  return (
    <div>
      <label htmlFor="huddlesOptIn">Opt-in to {featureName} feature</label>
      <input
        disabled={sendingUpdate}
        id="huddlesOptIn"
        type="checkbox"
        checked={!!value}
        onChange={() => {
          setSendingUpdate(true);
          updateUser({
            [`optin-${flagKey}`]: value ? "false" : "true",
          })?.then(() => {
            setSendingUpdate(false);
          });
        }}
      />
    </div>
  );
}

function CustomToolbar() {
  const client = useClient();

  if (!client) {
    return null;
  }

  return (
    <div>
      <h2>Custom toolbar</h2>
      <ul>
        {Object.entries(client.getFlags()).map(([flagKey, flag]) => (
          <li key={flagKey}>
            {flagKey} -
            {(flag.valueOverride ?? flag.isEnabled) ? "Enabled" : "Disabled"}{" "}
            {flag.valueOverride !== null && (
              <button
                onClick={() => {
                  client.setFlagOverride(flagKey, null);
                }}
              >
                Reset
              </button>
            )}
            <input
              checked={!!flag.valueOverride ?? flag.isEnabled}
              type="checkbox"
              onChange={(e) => {
                // this uses slightly simplified logic compared to the Reflag Toolbar
                client.setFlagOverride(flagKey, e.target.checked ?? false);
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function App() {
  return (
    <ReflagProvider
      publishableKey={publishableKey}
      company={initialCompany}
      user={initialUser}
      otherContext={initialOtherContext}
      apiBaseUrl={apiBaseUrl}
    >
      {!publishableKey && (
        <div>
          No publishable key set. Please set the VITE_PUBLISHABLE_KEY
          environment variable.
        </div>
      )}
      <Demos />
    </ReflagProvider>
  );
}
