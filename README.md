# Copy It

Landing site for Copy It, Brandon’s weekly newsletter of overseas business ideas for South Africa. One job: collect email sign-ups.

The pages are static HTML styled with Tailwind CSS, compiled and purged at build time. Sign-ups go to one Vercel function, `api/subscribe`, which calls the Beehiiv API. The Beehiiv API key never reaches the browser.

## Local development

```bash
npm install
npm test
npm run og
npm run build
npm run dev
```

`npm run dev` serves the built site at [http://127.0.0.1:4173](http://127.0.0.1:4173) and the subscribe function on `/api/subscribe`.

Without Beehiiv keys, a real submit returns “Signup is temporarily unavailable.” To preview the success message locally without creating a subscriber:

```bash
BEEHIIV_MOCK=true npm run dev
```

That mock exists only in the local dev server. The deployed function ignores it and will not invent a success.

## Environment variables

Copy `.env.example` to `.env`. On Vercel, set the same names in the project settings.

| Name | When it is read | Purpose |
| --- | --- | --- |
| `SITE_URL` | Build | Canonical and Open Graph origin, with no path and no trailing slash. Optional on Vercel: the build uses `https://$VERCEL_PROJECT_PRODUCTION_URL`, then `https://$VERCEL_URL`, then `http://localhost:4173`. Set this when you want a specific `*.vercel.app` hostname, or later when you add a custom domain. |
| `GA4_MEASUREMENT_ID` | Build | Optional override for the Google tag. The committed default is `G-WP1K1WK42Y`. A valid `G-` ID replaces it. `off` (or any other non-ID value) loads no tag. |
| `BEEHIIV_API_KEY` | Request | Beehiiv API key. Server only. Required. Never commit it. |
| `BEEHIIV_PUBLICATION_ID` | Request | Optional. Defaults to the Fitsorted publication `pub_cec2d599-5490-49b5-bb78-7cd7a9831890`. |
| `REDIRECT_TO_THANK_YOU` | Request | `true` sends a successful signup to `/thank-you`. The default is an inline success message on the page. |

`SITE_URL` and `GA4_MEASUREMENT_ID` are baked into the HTML, so changing them needs a new build. The Beehiiv keys and the thank-you redirect are read when someone subscribes.

Changing `SITE_URL` or the measurement ID means redeploying. The redirect toggle does not.

## Edit the copy

Page text lives in `src/pages/`. The header and footer live in `src/partials/`. Social URLs, the contact address, the default GA4 id, and the thank-you default live in `site.config.js`. Run `npm run build` after editing. Do not edit `dist/`.

Tokens such as `{{TIKTOK_URL}}` are filled in at build time.

## Swap the sample ideas

There are no real past issues yet. The three cards are samples in `data/ideas.json` (USA, UK, and Japan). They are generic concepts: no named companies, and no revenue figures.

Replace the three objects when real issues exist. Set `"sample": false` on each one and the “these are samples” line disappears. Keep `country`, `title`, and `summary`. Then rebuild.

## Google Analytics

The site installs the Google tag directly with `gtag.js`:

```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-WP1K1WK42Y"></script>
```

That URL is Google’s host for `gtag.js`. The site does not load Google Tag Manager (`gtm.js`, a `GTM-` container, or the Tag Manager iframe).

The small `gtag-config` file next to it is the usual `gtag('js')` and `gtag('config')` setup, kept in its own file so the page does not need an inline script. Events fire only after a successful signup or a social click:

- `form_submit_hero`
- `form_submit_footer`
- `social_click` with `platform` and `location`

If the tag is off, those calls do nothing.

## Regenerate the OG image and favicon

```bash
npm run og
```

This rewrites `public/og.png` (1200×630, white background, accent bar, “Copy It”, and the H1), plus `public/favicon.svg`, the PNG icons, and `favicon.ico`. The script uses the Space Grotesk files in `assets/fonts` (SIL Open Font License, see `assets/fonts/OFL.txt`). The live pages load Space Grotesk and Inter from Google Fonts instead. Run it again after changing the H1 in `site.config.js`, then rebuild.

## Beehiiv

`api/subscribe` calls the Fitsorted publication (this list is shared with another brand):

`POST https://api.beehiiv.com/v2/publications/pub_cec2d599-5490-49b5-bb78-7cd7a9831890/subscriptions`

Set `BEEHIIV_PUBLICATION_ID` only if that id should change. The API key stays in `BEEHIIV_API_KEY` and is never written into the site.

The body matches the current [create subscription](https://developers.beehiiv.com/api-reference/subscriptions/create) docs:

- `email`
- `send_welcome_email: true` (so the welcome email can carry the 10-idea list; the API default is false)
- `reactivate_existing: false` (the API default; a form submit does not opt someone back in after they unsubscribed)
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` as top-level fields when the visitor arrived with them
- `referring_site` set to the Copy It page URL (origin and path, without the query string), so these signups can be segmented from the other brand
- `custom_fields`: an array of `{ "name", "value" }` that always includes `brand` = `copy-it` and `source` (`hero` or `footer`), plus the same UTM values when they exist

The page keeps UTM parameters in `sessionStorage` so they survive a click to another page on the site, then sends them with the form.

Create these custom fields on the Fitsorted publication before launch, or Beehiiv will ignore them: `brand`, `source`, `utm_term`, and `utm_content`. The function also sends `utm_source`, `utm_medium`, and `utm_campaign` as custom fields when those parameters are present, so create those too if you want them stored. A missing field does not stop the subscription; Beehiiv drops that value and can return a warning. The function does not show Beehiiv’s error text to the visitor.

Put the 10 free ideas in the Beehiiv welcome email. This site does not send mail itself. Double opt-in stays on the publication’s own setting.

Do not put `BEEHIIV_API_KEY` in client code, HTML, or the repo.

## Deploy on Vercel

This repo is not deployed from here. To deploy it yourself:

1. Import the Git repository as a Vercel project. Framework preset can stay empty. `vercel.json` sets the build command (`npm run build`) and the output directory (`dist`).
2. Add `BEEHIIV_API_KEY`. Add `BEEHIIV_PUBLICATION_ID` only if it should not be the Fitsorted publication. Add `SITE_URL` if you do not want the production hostname inferred. Add `GA4_MEASUREMENT_ID` only if it should differ from `G-WP1K1WK42Y`.
3. Deploy. The free `*.vercel.app` address is enough. No custom domain is required.
4. Open the production URL once and confirm the canonical and `og:image` URLs use that hostname. If they do not, set `SITE_URL` to `https://your-project.vercel.app` and redeploy.

`/`, `/thank-you`, and `/privacy` are clean URLs. Preview deployments are marked `noindex`.

## Open items

- Replace `hello@copyit.example` in `site.config.js`. The privacy page marks that address as a TODO.
- Replace the three sample ideas in `data/ideas.json` before calling them past issues.
- Confirm the Beehiiv welcome email actually contains the 10-idea list.
