# Design notes

Principles taken from current marketing sites, and where they show up on Copy It. Motion is CSS plus a short IntersectionObserver in `src/site.js`. Nothing is hidden unless JavaScript has added `html.motion`, and that class is skipped when `prefers-reduced-motion` is set. Hero entrance is a CSS animation that only runs when motion is allowed, so the page is still readable with JavaScript off.

## Type scale and rhythm

**Linear.** One headline is much larger than the label above it and the sentence below it. The hero uses that stack: small accent pill, Space Grotesk H1 at the tightest leading, then an Inter subhead at `text-lg`. Inner pages use the same H1 step (`text-4xl` / `sm:text-5xl`) so About, Privacy, and Thank-you feel like one site.

## Whitespace

**Vercel.** Sections get tall vertical padding and the text stays in a narrow measure. Homepage bands use `py-20` / `sm:py-32`. The subhead stays `max-w-2xl`. About, Privacy, and Thank-you stay inside `max-w-3xl`.

## Hierarchy in the hero

**Stripe.** The page has one job, so the email form is the next thing after the promise, with the reassurance line directly under the button. The form, the microcopy, and the status line are grouped. The headline does not compete with a second banner.

## Social proof placement

**Morning Brew and The Hustle.** Proof sits under the form, not in a separate strip and not above the headline. The existing line “10,000 on TikTok · 1,800 on Instagram” stays there, under a hairline, with the same words. An extra proof slot exists as `EXTRA_SOCIAL_PROOF` in `site.config.js`. It renders nothing until real entries are added. No quote or subscriber count was invented.

## Card design

**Exploding Topics and Starter Story.** A card names the place, then the company, then one figure, then one sentence, then a source link. That order was already the content. The cards are flat, white, and hairline-bordered. Hover lifts them by 3px and turns the border accent. Press returns them. The facts and the source URLs are unchanged.

## Section pacing

**Lenny's Newsletter and Every.** Alternate a quiet mist band with a white band so the three beats (what an issue covers, the ideas, the close) do not blur. About and Privacy stay a single calm column. Thank-you is one column with the same padding, then two follow buttons.

## Micro-interactions

**Framer templates, used lightly.** Header social links shift to accent on hover. Buttons use `press`: 1px up on hover, 1px down on press, and the existing darker accent on hover. The email field uses a 2px accent focus ring. A successful submit fades the status line in. All of these sit inside `prefers-reduced-motion: no-preference`. The reduced-motion block also zeroes animation and transition duration.

## Scroll-reveal motion

**Framer templates, and the restraint of Linear.** Below-the-fold sections use class `reveal`. JavaScript adds `html.motion` only when the visitor has not asked for reduced motion, marks anything already on screen as visible in the same turn, and reveals the rest with IntersectionObserver. Opacity and transform do not change layout, so the motion does not add layout shift. With JavaScript off, `html.motion` is absent and every section stays visible.

## Button and focus states

**Vercel and Stripe.** Primary buttons are #15803D with white text, at least 48px tall. Hover darkens to #0F3D2E so the white label stays AA. #16A34A is only a hover border on cards, never a fill behind white text. Focus uses a 2px #0F3D2E outline on light surfaces and an off-white outline on the deep-green footer. Invalid email uses the same deep green border.

## Money palette

The blue palette is replaced. Page background is warm off-white #F7F5EE. Alternate bands are white. Body text is near-black #0B0F0C. Muted text is #304136, which stays above 4.5:1 on both off-white and white. Deep green #0F3D2E is the footer, the small card labels, and the focus ring. The hero pill and the mark behind “Before they hit South Africa.” are gold #E8B931 with near-black text. Gold is not used as text on a light background.

## Word reveal, count-up, and halftone

The headline is still the same sentence. Each word is a span so CSS can bring it in. The gold mark is a solid fill that sweeps under the last phrase. With reduced motion, or before that animation runs, the mark is already fully drawn, and the words are in the HTML.

The three sourced figures count from zero to the published number once the card is in view, in 1.1 seconds. The element’s width is locked to the final digits first, and the text is set back to the original sentence at the end. Reduced motion leaves the sentence alone.

The headshot effect is a vanilla canvas version of [React Bits Halftone Reveal](https://reactbits.dev/c/animations/halftone-reveal) (MIT License with the Commons Clause). Green dots sit on off-white and swell into the photograph under a fine pointer. On touch, the same reveal follows how much of the portrait is in view. The photograph is a normal `img` in the HTML. The canvas is added only by the script. That script is linked only when `AUTHOR.photo` points at a real file under `public/` and a credential line is set. Until then the About page keeps the TODO block and the hero byline is omitted. No placeholder face is used.
