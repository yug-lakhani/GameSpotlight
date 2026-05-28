# GameSpotlight Style Guide — Darker/Cool Theme

This style guide documents the theme tokens introduced for the darker, cooler visual refresh.

## Color Tokens
- `--color-ink`: #030615 — Page background / darkest ink
- `--bg-base`: #020412 — Base background color
- `--color-panel`: #061028 — Panels / cards background
- `--color-panel-soft`: #0a1a33 — Softer panel background / subtle panels
- `--color-accent`: #26b7a8 — Primary accent (teal)
- `--color-accent-2`: #4f6ef5 — Secondary accent (cool blue)
- `--color-warm`: #e08a2f — Accent for warnings / warm highlights (reduced)

## Usage examples
- Use the CSS variables directly in components or create utility classes.

Example CSS:

```css
.header {
  background: linear-gradient(90deg, var(--color-panel), var(--color-panel-soft));
}
.button-primary {
  background: linear-gradient(90deg, var(--color-accent), var(--color-accent-2));
  color: #021018; /* dark text on bright accent */
}
.card {
  background: var(--color-panel);
  border: 1px solid rgba(79,110,245,0.08);
}
```

## Component tokens
- Primary button: `--color-accent` → `--color-accent-2` gradient
- Secondary button border highlight: `rgba(79,110,245,0.18)`
- Card border: `rgba(79,110,245,0.08)`

## How I tested
- Rebuilt the client with `npm run build` and ran a development smoke-check at `http://localhost:5173/` to confirm the server responds.

## Tailwind mapping
We updated `tailwind.config.cjs` colors to reflect these tokens so you can continue to use Tailwind classes like `bg-ink`, `bg-panel`, `from-accent`, and `to-accent2`.

## Preview
To preview changes locally:

```bash
cd client
npm ci
npm run dev
# open http://localhost:5173
```

If you'd like, I can extend the style guide with accessible contrast ratios, typography scale, and component token mapping (buttons, badges, cards). Which additions do you want next?
