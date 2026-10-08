# Keep Campus Eats Colors Consistent

## Objective
Keep the website's existing light color palette consistent regardless of deployment environment or the visitor's operating-system color preference.

## Scope
- Update `client/app/globals.css` so `prefers-color-scheme: dark` no longer changes the root background or foreground colors.
- Set the document color scheme to light so browser-native controls remain consistent with the site palette.
- Preserve the current colors and all component-level styling; do not introduce a new theme or redesign.

## Acceptance Criteria
- The root background and foreground remain the same when the browser/OS requests light or dark mode.
- Browser-native controls use the light color scheme.
- Client lint and production build pass, and the public site is checked after the change.
