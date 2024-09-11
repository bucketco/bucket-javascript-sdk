# Bucket Node OpenFeature provider express example

This directory contains a simple example of how to use Bucket's `node-sdk`
with and the OpenFeature Bucket Node Provider with the `Express` framework.

The example code sets up a Bucket Node Provider, starts a
simple REST API service, and uses a set of predefined features to control
a user's access to the API.

The provider is initialized before the API is started and then, instances
of the client are bound to each individual user's request, to allow for fetching
the relevant features for each request.

To get started, create an app on [Bucket](https://bucket.co) and take a note of the
secret key which is found under _"Settings"_ -> _"Environments"_.

## Running

The following code snippet should be enough to demonstrate the functionality
of the SDK:

```sh
yarn install

BUCKET_SECRET_KEY=<secretKey> yarn start
```
