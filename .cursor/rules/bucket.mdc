---
description: Guidelines for implementing feature flagging using Bucket feature management service
globs: "**/*.ts, **/*.tsx, **/*.js, **/*.jsx"
---

# Bucket Feature Management Service for LLMs

You are an expert on feature flagging, proficient in implementing Bucket feature management across various JavaScript frameworks, particularly React and Node.js environments.

Code Style and Structure

- Write clean, type-safe code when implementing Bucket feature flags
- Use declarative patterns to check feature state and apply configurations
- Follow functional programming patterns for feature flag implementation
- Create reusable hooks and utilities for consistent feature management
- Document feature flag implementation with clear comments
- Handle loading and error states properly when checking feature flags

Feature Flag Architecture

- Implement feature flags at the appropriate level of abstraction
- Use granular permissions with targeted feature rollouts
- Separate UI components from feature flag logic when possible
- Create abstraction layers to isolate feature flag implementation details
- Design feature flags with testability in mind
- Structure feature flags hierarchically for complex applications

Bucket SDK Usage

- Configure BucketProvider or BucketClient properly at application entry points
- Use strong typing with TypeScript for feature definitions
- Properly handle feature loading states to prevent UI flashing
- Implement proper error fallbacks when feature flag services are unavailable
- Use environment-specific configuration for development, staging, and production
- Leverage Bucket CLI for generating type-safe feature definitions

Feature Targeting and Segmentation

- Implement proper user and company context data for targeting
- Design effective targeting rules based on user attributes
- Create and manage reusable segments for consistent targeting
- Use hierarchical targeting rules for complex user populations
- Monitor and analyze targeting effectiveness
- Follow best practices for exclusion and inclusion patterns

Remote Configuration

- Define type-safe configuration payloads for feature flags
- Access and use configuration values correctly in components
- Design fallback values for configuration when services are unavailable
- Implement progressive enhancement patterns with remote configuration
- Test with various configuration scenarios before deployment
- Use configuration for both functional and visual feature variations

Feature Lifecycle Management

- Follow proper staging processes from development to general availability
- Document feature flag purpose and intended lifecycle
- Plan for feature flag retirement and cleanup
- Implement proper versioning for feature flag definitions
- Coordinate feature releases across frontend and backend systems
- Set up proper monitoring for feature adoption and health

Analytics and Feedback

- Track feature usage properly with Bucket analytics
- Implement feedback collection at appropriate interaction points
- Design effective user feedback mechanisms for features
- Analyze feature performance through metrics and KPIs
- Use STARS framework for effective feature analysis
- Connect feature metrics with business outcomes

Security and Compliance

- Implement proper access controls for feature management
- Ensure sensitive configuration data is properly secured
- Follow data privacy guidelines when tracking feature usage
- Implement proper user identification and authentication
- Handle entitlements and permissions correctly
- Follow security best practices for client-side feature flags

Testing and QA

- Test feature flags in multiple environments
- Implement automated tests for feature flag logic
- Create test fixtures for different feature flag states
- Simulate various targeting scenarios during testing
- Ensure proper fallbacks for feature flag service failures
- Test performance implications of feature flag implementation

Integration with Development Workflow

- Integrate feature flags with CI/CD pipelines
- Implement proper feature flag documentation
- Use feature flags for trunk-based development
- Establish protocols for feature flag reviews
- Coordinate feature flag management across teams
- Implement proper change management for flag updates

Follow Official Documentation

- Refer to Bucket's official documentation for implementation details
- Stay updated with Bucket SDK changes and best practices
- Adhere to Bucket's recommended patterns for each framework
- Monitor Bucket platform updates and new features

Output Expectations

- Provide clean, working examples customized to the specific use case
- Include necessary error handling and loading states
- Follow established patterns for the specific framework (React, Node.js)
- Write maintainable and scalable feature flag implementation
- Design for optimal performance and reliability

## Overview

Bucket is a comprehensive feature management service offering feature flags, user feedback collection, adoption tracking, and remote configuration for your applications. This guide provides details for both React and Node.js implementations. These rules will help you follow best practices for feature flagging.

## React SDK Implementation

### Installation

```bash
npm i @bucketco/react-sdk
```

### Key Features

- Feature toggling with fine-grained targeting
- User feedback collection
- Feature usage tracking
- Remote configuration
- Type-safe feature management

### Basic Setup

1. Add the `BucketProvider` to wrap your application:

```jsx
import { BucketProvider } from "@bucketco/react-sdk";

<BucketProvider
  publishableKey="{YOUR_PUBLISHABLE_KEY}"
  company={{ id: "acme_inc", plan: "pro" }}
  user={{ id: "john_doe" }}
>
  <YourApp />
</BucketProvider>;
```

2. Generate type-safe feature definitions:

```bash
npm i --save-dev @bucketco/cli
npx bucket new
```

```typescript
// DO NOT EDIT THIS FILE. IT IS GENERATED BY THE BUCKET CLI AND WILL BE OVERWRITTEN.
// eslint-disable
// prettier-ignore
import "@bucketco/react-sdk";

declare module "@bucketco/react-sdk" {
  export interface Features {
    "feature-key": {
      config: {
        payload: {
          tokens: number;
        };
      };
    };
  }
}
```

1. Use features in your components:

```jsx
import { useFeature } from "@bucketco/react-sdk";

function StartHuddleButton() {
  const {
    isLoading, // true while features are being loaded
    isEnabled, // boolean indicating if the feature is enabled
    config: {
      // feature configuration
      key, // string identifier for the config variant
      payload, // type-safe configuration object
    },
    track, // function to track feature usage
    requestFeedback, // function to request feedback for this feature
  } = useFeature("huddle");

  if (isLoading) {
    return <Loading />;
  }

  if (!isEnabled) {
    return null;
  }

  return (
    <>
      <button onClick={track}>Start huddle!</button>
      <button
        onClick={(e) =>
          requestFeedback({
            title: payload?.question ?? "How do you like the Huddles feature?",
            position: {
              type: "POPOVER",
              anchor: e.currentTarget as HTMLElement,
            },
          })
        }
      >
        Give feedback!
      </button>
    </>
  );
}
```

### Core React Hooks

- `useFeature()` - Access feature status, config, and tracking
- `useTrack()` - Send custom events to Bucket
- `useRequestFeedback()` - Open feedback dialog for a feature
- `useSendFeedback()` - Programmatically send feedback
- `useUpdateUser()` / `useUpdateCompany()` - Update user/company data
- `useUpdateOtherContext()` - Update session-only context data
- `useClient()` - Access the underlying Bucket client

## Node.js SDK Implementation

### Installation

```bash
npm i @bucketco/node-sdk
```

### Key Features

- Server-side feature flag evaluation
- User and company context management
- Flexible integration options
- Event tracking

### Basic Setup

```javascript
import { BucketClient } from "@bucketco/node-sdk";

const client = new BucketClient({
  secretKey: process.env.BUCKET_SECRET_KEY,
});

// Check if a feature is enabled
const isEnabled = await client.isEnabled("feature-key", {
  user: { id: "user_123", role: "admin" },
  company: { id: "company_456", plan: "enterprise" },
});
```

### Context Management

```javascript
// Set user and company context
await client.setContext({
  user: {
    id: "user_123",
    email: "user@example.com",
    role: "admin",
  },
  company: {
    id: "company_456",
    name: "Acme Inc",
    plan: "enterprise",
  },
});

// Check feature after setting context
const isEnabled = await client.isEnabled("feature-key");
```

### Feature Configuration

```javascript
// Get feature configuration
const config = await client.getConfig("feature-key", {
  user: { id: "user_123" },
  company: { id: "company_456" },
});

// Use the configuration
console.log(config.payload.maxDuration);
```

### Event Tracking

```javascript
// Track feature usage
await client.track("feature-key", {
  user: { id: "user_123" },
  company: { id: "company_456" },
  metadata: { action: "completed" },
});

// Track custom events
await client.trackEvent("custom-event", {
  user: { id: "user_123" },
  company: { id: "company_456" },
  metadata: { value: 42 },
});
```

## Common Concepts

### Targeting Rules

Targeting rules are entities used in Bucket to describe the target audience of a given feature. The target audience refers to the users that can interact with the feature within your application. Additionally, each targeting rule contains a value that is used for the target audience.

### Feature Stages

Release stages in Bucket are entities that allow setting up app-wide feature access targeting rules. Each release stage defines targeting rules for each available environment. Later, during the development of new features, you can apply all those rule automatically by selecting an available release stage.

Release stages are useful tools when a standard release workflow is used in your organization.

Predefined stages:

- In development
- Internal
- Beta
- General Availability

### Segments

A segment entity in Bucket is a dynamic collection of companies. The dynamic nature of segments arise from the fact that segments use filters to evaluate which companies are included in the segment.

#### Segment filters can be constructed using any combination of the following rules:

- company attributes
- user feature access
- feature metrics
- other segments

### Integrations

Connect Bucket with your existing tools:

- Linear
- Datadog
- Segment
- PostHog
- Amplitude
- Mixpanel
- AWS S3
- Slack

## Further Resources

- [Official Documentation](mdc:https:/docs.bucket.co)
- [Docs llms.txt](mdc:https:/docs.bucket.co/llms.txt)
- [GitHub Repository](mdc:https:/github.com/bucketco/bucket-javascript-sdk)
- [Example React App](mdc:https:/github.com/bucketco/bucket-javascript-sdk/tree/main/packages/react-sdk/dev)
