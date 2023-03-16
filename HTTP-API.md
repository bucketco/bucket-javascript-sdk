# Bucket HTTP Tracking API (early access)

NOTE: this document describes the Bucket Tracking HTTP API available at https://tracking.bucket.co and NOT the SDK API.

Bucket is designed for the B2B use case where a user belongs to a company.

The Bucket Tracking API is a simple JSON HTTP API which can be used both from browsers and from backends. The path is:

`https://tracking.bucket.co/{tracking_key}/{method}`

The API has three methods: `user`, `company` and `events`.

### Content-Type

The API only accepts JSON, so the Content-Type header must be set to `application/json`

### Responses

The API will return `200` status code when calls are successful and `400` if there's any errors, including an invalid request body. The response body  will contain detailed information on the invalid request sent which you can use to debug the request. In case of a 400 response code there's no point in retrying the request.

In rare cases, you may experience a 500 response code. In those cases you can retry the request to ensure that the tracking event was sent. This can technically result in duplicate entries, but is increasingly rare. 

### Tracking Key

The tracking key is unique per Bucket app. Look for the tracking key under "Settings" in Bucket. Include the Tracking key in the URL, like so `https://tracking.bucket.co/{tracking_key}/{method}`

## User

The User method is used to track individual users in your application. This method will create a user, if it doesn't exist already. For existing users, it will update it. Use a unique identifier that won't change for `userId`, e.g. the database ID.

You can pass along attributes which will be set for the given user. Attributes on users are not useful in Bucket yet.

You'll likely call this method when a user signs into your app.

Here's an example:

```
POST https://tracking.bucket.co/trCqx4DGo1lk3Lcct5NHLjWy/user
{
  "userId": 1234567890,
  "attributes": {
    "name": "Rasmus Makwarth",
    "custom_property": true,
    "some_number": 12
  }
}
```

| field      | required |     Type |
| ---------- | :------: | -------: |
| userId     | Required |   String |
| attributes | Optional |   Object |
| timestamp  | Optional | ISO 8601 |

## Company

The Company method is used to track companies (organizations) in your B2B application. Use a unique identifier that won't change for `companyId`, e.g. the database ID.

You can associate a user to a company by providing `userId`. This is important as most features in Bucket will look at company-level data. In other words, if a user isn't associated with a company, the users' events will not be included in most of the results. The "Tracking" tab in the Bucket UI will let you know if you have unassociated events.

Just as with the `user` call, you can send attributes to be associated with that company. In addition to traditional user tracking based on events sent, you can also track feature usage based on attributes with Bucket. For example, if you set `hasSlackEnabled: true` on specific companies, you can create an "attribute based Feature" in the Bucket UI to track which companies have slack enabled.

You're also likely to call this method when a user signs in to ensure that the user is associated with a company.

```
POST https://tracking.bucket.co/trCqx4DGo1lk3Lcct5NHLjWy/company
{
  "companyId": 101112231415,
  "attributes": {
    "name": "Acme Corp",
    "monthly_spend": 99,
    "activated": true
  },
  "userId": 1234567890
}
```

| field      | required |            Type |
| ---------- | :------: | --------------: |
| companyId  | Required |          String |
| attributes | Optional |          Object |
| timestamp  | Optional | ISO 8601 String |
| userId     | Optional |          String |

## Event

Events are used to track user interactions within your application. We recommend tracking a handful of _key features_ and features you're currently working on.

To track an event, call this method when users interact with a feature.

```
POST https://tracking.bucket.co/trCqx4DGo1lk3Lcct5NHLjWy/event
{
  "event": "Sent message",
  "userId": 1234567890,
  "attributes": {
    "position": "popover",
    "version": 3
  },

}
```

| field      | required |     Type |
| ---------- | :------: | -------: |
| event      | Required |   String |
| userId     | Required |   String |
| attributes | Optional |   Object |
| timestamp  | Optional | ISO 8601 |
