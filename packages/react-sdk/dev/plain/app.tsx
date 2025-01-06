import React, { createContext, useContext, useState } from "react";

import {
  BucketProvider,
  Features,
  useFeature as bucketUseFeature,
  useRequestFeedback,
  useTrack,
} from "../../src";

// type bleh = {
//   bleh: boolean;
// };

// // Extending the Features interface to define the available features
// declare module "../../src" {
//   interface Features extends bleh {
//     huddle: boolean;
//   }
// }

const publishableKey = import.meta.env.PUBLISHABLE_KEY || "";

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
  const { user, company, otherContext, setContext } =
    useContext(SessionContext);
  const [newCompany, setNewCompany] = useState(JSON.stringify(initialCompany));
  const [newUser, setNewUser] = useState(JSON.stringify(initialUser));
  const [newOtherContext, setNewOtherContext] = useState(
    JSON.stringify(initialOtherContext),
  );

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
                  setContext({
                    user,
                    other: otherContext,
                    company: JSON.parse(newCompany),
                  });
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
                onClick={() =>
                  setContext({
                    user: JSON.parse(newUser),
                    other: otherContext,
                    company,
                  })
                }
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
                onClick={() =>
                  setContext({
                    user,
                    other: JSON.parse(newOtherContext),
                    company,
                  })
                }
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
  return (
    <main>
      <h1>React SDK</h1>

      <HuddleFeature />

      <UpdateContext />
      <Feedback />
      <SendEvent />
    </main>
  );
}

const SessionContext = createContext({
  user: initialUser,
  company: initialCompany,
  otherContext: initialOtherContext,
  setContext: (_: any) => {},
});

export function App() {
  const [context, setContext] = useState({
    user: initialUser,
    company: initialCompany,
    otherContext: initialOtherContext,
  });

  const { user, company, otherContext } = context;

  return (
    <SessionContext.Provider value={{ setContext, ...context }}>
      <BucketProvider
        publishableKey={publishableKey}
        feedback={{
          enableLiveSatisfaction: true,
        }}
        company={company}
        user={user}
        otherContext={otherContext}
        featureOptions={{
          fallbackFeatures: ["huddle"],
        }}
        features={myFeatures}
      >
        <Demos />
        {}
      </BucketProvider>
    </SessionContext.Provider>
  );
}
