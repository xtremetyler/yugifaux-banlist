# Banlist Review setup

The public review page is static, while authentication and votes are stored in Supabase.

1. Create a Supabase project.
2. Open **SQL Editor**, paste `supabase/banlist-review.sql`, and run it once.
3. In **Authentication → Providers → Discord**, enable Discord and copy the displayed callback URL.
4. In the Discord Developer Portal, open the YugiFAUX application, add that callback URL under OAuth2 redirects, and copy the Discord client ID and client secret into Supabase. Do not commit the secret anywhere.
5. Add both the live website URL and your local preview URL to Supabase Authentication URL configuration. The live redirect is `https://xtremetyler.github.io/yugifaux-banlist/review.html`.
6. Copy the Supabase **Project URL** and **publishable/anon key** into `review-config.js`. Those two browser values are public by design. Never use the service-role key there.
7. Sign in once through `review.html`. In Supabase Table Editor, open `review_participants`, set your row to `approved = true`, `active = true`, and `is_admin = true`.
8. Other participants sign in once. Approve their rows after confirming their Discord identity. Set `active = false` whenever someone should be unable to nominate or vote.

The administrator controls nomination and ballot windows from the page. Votes never automatically change the public Limeade List.
