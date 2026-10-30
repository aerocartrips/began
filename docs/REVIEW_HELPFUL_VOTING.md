# Review helpful voting

- **Model:** `ReviewVote` unique `{ review, user }`
- **API:** `POST/DELETE /api/v1/reviews/[reviewId]/helpful` (authenticated)
- **UI:** `ReviewHelpfulButton` on approved public `ReviewCard`
- **Rules:** one vote per user, cannot vote on own review, atomic `$inc` on `helpfulCount`
