# Bucket Feedback UI

The Bucket SDK includes a UI you can use to collect feedback from user about particular features.

![image](https://github.com/bucketco/bucket-tracking-sdk/assets/331790/0a8814ff-a803-4734-9e86-3eb19e96d050)

## Global feedback configuration

The Bucket SDK feedback UI is configured with reasonable defaults, positioning itself as a [dialog](#dialog) in the lower right-hand corner of the viewport, displayed in english, and with a [light-mode theme](#custom-styling).

These settings can be overwritten when initializing the Bucket SDK:

```javascript
bucket.init("bucket-tracking-key", {
  feedback: {
    ui: {
      position: POSITION_CONFIG, // See positioning section
      translations: TRANSLATION_KEYS, // See internationalization section

      // Enable Live Satisfaction. Default: `true`
      enableLiveSatisfaction: boolean,

      /**
       * Do your own feedback prompt handling or override
       * default settings at runtime.
       */
      liveSatisfactionHandler: (promptMessage, handlers) => {
        // See Live Satisfaction section
      },
    },
  },
});
```

See also:

- [Positioning and behavior](#positioning-and-behavior) for the position option.
- [Static language configuration](#static-language-configuration) if you want to translate the feedback UI.
- [Live Satisfaction](#live-feedback) to override default configuration.

## Live Satisfaction

Live Satisfaction is enabled by default.

When Live Satisfaction is enabled, the Bucket SDK will open and maintain a connection to the Bucket service. When a user triggers an event tracked by a feature and is eligible to be prompted for feedback, the Bucket service will send a request to the SDK instance. By default, this request will open up the Bucket feedback UI in the user's browser, but you can intercept the request and override this behaviour.

The live connection for automated feedback is established once you have identified a user with `bucket.user()`.

### Disabling Live Satisfaction

You can disable automated collection in the `bucket.init()`-call:

```javascript
bucket.init("bucket-tracking-key", {
  feedback: {
    enableLiveSatisfaction: false,
  },
});
```

### Overriding prompt event defaults

If you are not satisfied with the default UI behavior when an automated prompt event arrives, you can can [override the global defaults](#global-feedback-configuration) or intercept and override settings at runtime like this:

```javascript
bucket.init("bucket-tracking-key", {
  feedback: {
    liveSatisfactionHandler: (promptMessage, handlers) => {
      // Pass your overrides here. Everything is optional
      handlers.openFeedbackForm({
        title: promptMessage.question,

        position: POSITION_CONFIG, // See positioning section
        translations: TRANSLATION_KEYS, // See internationalization section

        // Trigger side effects with the collected data,
        // for example posting it back into your own CRM
        onAfterSubmit: (feedback) => {
          storeFeedbackInCRM({
            score: feedback.score,
            comment: feedback.comment,
          });
        },
      });
    },
  },
});
```

See also:

- [Positioning and behavior](#positioning-and-behavior) for the position option.
- [Runtime language configuration](#runtime-language-configuration) if you want to translate the feedback UI.
- [Use your own UI to collect feedback](#using-your-own-ui-to-collect-feedback) if the feedback UI doesn't match your design.

## Manual feedback collection

To open up the feedback collection UI, call `bucket.requestFeedback(options)` with the appropriate options. This approach is particularly beneficial if you wish to retain manual control over feedback collection from your users while leveraging the convenience of the Bucket feedback UI to reduce the amount of code you need to maintain.

Examples of this could be if you want the click of a `give us feedback`-button or the end of a specific user flow, to trigger a pop-up displaying the feedback user interface.

### bucket.requestFeeback() options

Minimal usage with defaults:

```javascript
bucket.requestFeedback({
  featureId: "bucket-feature-id",
  title: "How satisfied are you with file uploads?",
});
```

All options:

```javascript
bucket.requestFeedback({
  featureId: "bucket-feature-id", // [Required]
  userId: "your-user-id",  // [Optional] if user persistence is enabled (default in browsers),
  companyId: "users-company-or-account-id", // [Optional]
  title: "How satisfied are you with file uploads?" // [Optional]

  position: POSITION_CONFIG, // [Optional] see the positioning section
  translations: TRANSLATION_KEYS // [Optional] see the internationalization section

  // [Optional] trigger side effects with the collected data,
  // for example sending the feedback to your own CRM
  onAfterSubmit: (feedback) => {
    storeFeedbackInCRM({
      score: feedback.score,
      comment: feedback.comment
    })
  }
})
```

See also:

- [Positioning and behavior](#positioning-and-behavior) for the position option.
- [Runtime language configuration](#runtime-language-configuration) if you want to translate the feedback UI.

## Positioning and behavior

The feedback UI can be configured to be placed and behave in 3 different ways:

### Positioning configuration

#### Modal

A modal overlay with a backdrop that blocks interaction with the underlying page. It can be dismissed with the keyboard shortcut `<ESC>` or the dedicated close button in the top right corner. It is always centered on the page, capturing focus, and making it the primary interface the user needs to interact with.

![image](https://github.com/bucketco/bucket-tracking-sdk/assets/331790/6c6efbd3-cf7d-4d5b-b126-7ac978b2e512)

Using a modal is the strongest possible push for feedback. You are interrupting the user's normal flow, which can cause annoyance. A good use-case for the modal is when the user finishes a linear flow that they don't perform often, for example setting up a new account.

```javascript
position: {
  type: "MODAL";
}
```

#### Dialog

A dialog that appears in a specified corner of the viewport, without limiting the user's interaction with the rest of the page. It can be dismissed with the dedicated close button, but will automatically disappear after a short time period if the user does not interact with it.

![image](https://github.com/bucketco/bucket-tracking-sdk/assets/331790/30413513-fd5f-4a2c-852a-9b074fa4666c)

Using a dialog is a soft push for feedback. It lets the user continue their work with a minimal amount of intrusion. The user can opt-in to respond but is not required to. A good use case for this behaviour is when a user uses a feature where the expected outcome is predictable, possibly because they have used it multiple times before. For example: Uploading a file, switching to a different view of a visualisation, visiting a specific page, or manipulating some data.

The default feedback UI behaviour is a dialog placed in the bottom right corner of the viewport.

```javascript
position: {
  type: "DIALOG",
  placement: "top-left" | "top-right" | "bottom-left" | "bottom-right"
}
```

#### Popover

A popover that is anchored relative to a DOM-element (typically a button). It can be dismissed by clicking outside the popover or by pressing the dedicated close button.

![image](https://github.com/bucketco/bucket-tracking-sdk/assets/331790/4c5c5597-9ed3-4d4d-90c0-950926d0d967)

You can use the popover mode to implement your own button to collect feedback manually.

```javascript
position: {
  type: "POPOVER",
  anchor: DOMElement
}
```

Popover feedback button example:

```html
<button id="feedbackButton">Tell us what you think</button>
<script>
  const button = document.getElementById("feedbackButton");
  button.addEventListener("click", (e) => {
    bucket.requestFeedback({
      featureId: "bucket-feature-id",
      userId: "your-user-id",
      title: "How do you like the popover?",
      position: {
        type: "POPOVER",
        anchor: e.currentTarget,
      },
    });
  });
</script>
```

## Internationalization (i18n)

By default, the feedback UI is written in English. However, you can supply your own translations by passing an object to the options to either or both of the `bucket.init(options)` or `bucket.requestFeedback(options)` calls. These translations will replace the English ones used by the feedback interface. See examples below.

![image](https://github.com/bucketco/bucket-tracking-sdk/assets/331790/68805b38-e9f6-4de5-9f55-188216983e3c)

See [default english localization keys](./src/feedback/config/defaultTranslations.tsx) for a reference of what translation keys can be supplied.

### Static language configuration

If you know the language at page load, you can configure your translation keys while initializing the Bucket SDK:

```javascript
bucket.init("my-tracking-key", {
  feedback: {
    ui: {
      translations: {
        DefaultQuestionLabel:
          "Dans quelle mesure êtes-vous satisfait de cette fonctionnalité ?",
        QuestionPlaceholder:
          "Comment pouvons-nous améliorer cette fonctionnalité ?",
        ScoreStatusDescription: "Choisissez une note et laissez un commentaire",
        ScoreStatusLoading: "Chargement...",
        ScoreStatusReceived: "La note a été reçue !",
        ScoreVeryDissatisfiedLabel: "Très insatisfait",
        ScoreDissatisfiedLabel: "Insatisfait",
        ScoreNeutralLabel: "Neutre",
        ScoreSatisfiedLabel: "Satisfait",
        ScoreVerySatisfiedLabel: "Très satisfait",
        SuccessMessage: "Merci d'avoir envoyé vos commentaires!",
        SendButton: "Envoyer",
      },
    },
  },
});
```

### Runtime language configuration

If you only know the user's language after the page has loaded, you can provide translations to either the `bucket.requestFeedback(options)` call or the `liveSatisfactionHandler` option before the feedback interface opens. See examples below.

### Manual feedback collection

```javascript
bucket.requestFeedback({
  ... // Other options
  translations: {
    // your translation keys
  }
})
```

### Live Satisfaction

When you are collecting feedback through the Bucket automation, you can intercept the default prompt handling and override the defaults.

If you set the prompt question in the Bucket app to be one of your own translation keys, you can even get a translated version of the question you want to ask your customer in the feedback UI.

```javascript
bucket.init("bucket-tracking-key", {
  feedback: {
    liveSatisfactionHandler: (message, handlers) => {
      const translatedQuestion =
        i18nLookup[message.question] ?? message.question;
      handlers.openFeedbackForm({
        title: translatedQuestion,
        translations: {
          // your static translation keys
        },
      });
    },
  },
});
```

## Custom styling

You can adapt parts of the look of the Bucket feedback UI by applying CSS custom properties to your page in your CSS `:root`-scope.

![image](https://github.com/bucketco/bucket-tracking-sdk/assets/331790/ff7ed885-8308-4c9b-98c6-5623f1026b69)

Examples of custom styling can be found in our [development example stylesheet](./dev/index.css).

## Using your own UI to collect feedback

You may have very strict design guidelines for your app and maybe the Bucket feedback UI doesn't quite work for you.

In this case, you can implement your own feedback collection mechanism, which follows your own design guidelines.

This is the data type you need to collect:

```typescript
{
  /** Customer satisfaction score */
  score?: 1 | 2 | 3 | 4 | 5,
  comment?: string
}
```

Either `score` or `comment` must be defined in order to pass validation in the Bucket tracking API.

### Manual feedback collection

Examples of a HTML-form that collects the relevant data can be found in [feedback.html](./example/feedback/feedback.html) and [feedback.jsx](./example/feedback/feedback.jsx).

Once you have collected the feedback data, pass it along to `bucket.feedback()`:

```javascript
bucket.feedback({
  featureId: "bucket-feature-id",
  userId: "your-user-id",
  score: 5,
  comment: "Best thing I"ve ever tried!",
});
```

### Intercepting Live Satisfaction events

When using Live Satisfaction, the Bucket service will, when specified, send a feedback prompt message to your user's instance of the Bucket SDK. This will result in the feedback UI being opened.

You can intercept this behavior and open your own custom feedback collection form:

```javascript
bucket.init("bucket-tracking-key", {
  feedback: {
    liveSatisfactionHandler: async (promptMessage, handlers) => {
      // This opens your custom UI
      customFeedbackCollection({
        // The question configured in the Bucket UI for the feature
        question: promptMessage.question,
        // When the user successfully submits feedback data.
        // Use this instead of `bucket.feedback()`, otherwise
        // the feedback prompt handler will keep being called
        // with the same prompt message
        onFeedbackSubmitted: (feedback) => {
          handlers.reply(feedback);
        },
        // When the user closes the custom feedback form
        // without leaving any response.
        // It is important to feed this back, otherwise
        // the feedback prompt handler will keep being called
        // with the same prompt message
        onFeedbackDismissed: () => {
          handlers.reply(null);
        },
      });
    },
  },
});
```
