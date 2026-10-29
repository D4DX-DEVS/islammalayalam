# Insights from Instagram

With `INSTAGRAM_ACCESS_TOKEN` set, the homepage Insights slider and the `/insights/` archive show the
newest **picture** posts of the site's Instagram account (single images and the first image of a
carousel; videos and Reels are skipped). New posts appear within about 15 minutes. Without the
token, or while Instagram cannot be reached, the Insights added in Admin → Insights are shown.

Instagram only allows this through its official API, for a **Professional** account.

## One-time setup

1. **Make the account Professional** (free): Instagram app → Settings → _Account type and tools_ →
   _Switch to professional account_ → _Creator_ or _Business_. Posts and followers are unchanged.
2. **Create a Meta app**: <https://developers.facebook.com/apps> → _Create app_ → use case
   _Manage messaging & content on Instagram_ (the "Instagram API with Instagram Login" product).
3. In the app: _Instagram_ → _API setup with Instagram login_ → _Generate access tokens_ →
   _Add account_ and sign in as the site's account. Allow `instagram_business_basic`.
4. Copy the generated token (a long-lived token, valid 60 days).
5. Add it as `INSTAGRAM_ACCESS_TOKEN` in DigitalOcean → App → Settings → Environment variables
   (encrypted), then redeploy. For local development put it in `.env`.

The site renews the token once a week and keeps the renewed one in the database, so it does not
expire as long as the site is running. If Insights fall back to the admin ones for a long time
(e.g. the site was down for two months, or the password was changed), generate a new token
(step 3) and replace the variable.
