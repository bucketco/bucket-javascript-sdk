export const FeedbackForm = () => {
  function handleSubmit(e) {
    e.preventDefault();

    const formData = Object.fromEntries(new FormData(e.target).entries());

    const feedbackPayload = {
      featureId: "EXAMPLE_FEATURE",
      userId: "EXAMPLE_USER",
      companyId: "EXAMPLE_COMPANY",
      score: formData.score ? Number(formData.score) : null,
      comment: formData.comment ? formData.comment : null,
    };

    // Using the Bucket SDK
    bucket.feedback(feedbackPayload);

    /*
    // Using the Bucket API
    fetch("https://tracking.bucket.co/EXAMPLE_TRACKING_KEY/feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(feedbackPayload),
    });
    */
  }

  return (
    <form action="#" onSubmit={handleSubmit}>
      <h2>How satisfied are you with our ExampleFeature?</h2>

      <fieldset>
        <legend>Satisfaction</legend>

        <div>
          <label>
            <input type="radio" name="score" value="1" />
            <span>Very unsatsified</span>
          </label>
        </div>
        <div>
          <label>
            <input type="radio" name="score" value="2" />
            <span>Unsatisfied</span>
          </label>
        </div>
        <div>
          <label>
            <input type="radio" name="score" value="3" />
            <span>Neutral</span>
          </label>
        </div>
        <div>
          <label>
            <input type="radio" name="score" value="4" />
            <span>Satisfied</span>
          </label>
        </div>
        <div>
          <label>
            <input type="radio" name="score" value="5" />
            <span>Very satsified</span>
          </label>
        </div>
      </fieldset>

      <div>
        <label>
          <div>Comment</div>
          <textarea name="comment" placeholder="Write a comment..."></textarea>
        </label>
      </div>

      <button type="submit">Send feedback</button>
    </form>
  );
};
