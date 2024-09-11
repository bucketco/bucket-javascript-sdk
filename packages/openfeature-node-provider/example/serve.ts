import bucket from "./bucket";
import app from "./app";

// Initialize Bucket SDK before starting the server,
// so that features are available when the server starts.
bucket.initialize().then(() => {
  console.log("Bucket initialized");

  // Start listening for requests only after Bucket is initialized,
  // which guarantees that features are available.
  app.listen(process.env.PORT ?? 3000, () => {
    console.log("Server is running on port 3000");
  });
});
