import { createApp } from "vue";
import App from "./App.vue";
import { BucketPlugin } from "@bucketco/vue-sdk";

const app = createApp(App);

app.use(BucketPlugin, { publishableKey: "pk_test_123" });

app.mount("#app");
