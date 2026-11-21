# Hauller Driver
Native Expo application for Hauller drivers, using the existing shared Supabase backend.

## Brand
The app uses the approved Hauller wordmark, Manrope typography and the black/white/cobalt identity. Local logo and font assets are bundled for offline use; the font licence is in `assets/fonts/OFL.txt`. The visible app name and icon are Hauller, while the Expo project ID, owner, slug, URL scheme, package identifiers, storage keys and `docklane_` RPC contracts retain their existing identity. A new native build is needed to install the updated display name and app icon.

## Development
Use Node 22.13 or later. Run `npm install`, then `npm start` and open the project in a matching Expo Go or development build. The app uses Expo SDK 58.

The committed configuration contains only the shared development project's public URL and publishable key. Override them with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never add a service-role key.

## Driver workflow
Sign in with an existing driver account. The Jobs tab lists assigned marketplace and private-operator work. Pending marketplace awards display a server-owned deadline and MM:SS timer. Accepting calls the existing `docklane_acknowledge(p_assignment)` RPC; a driver cannot extend the deadline. Haulier acceptance on behalf is shown explicitly.

Private-operator jobs retain their existing acknowledgement flow. Acknowledgement is not a signed carriage contract or permission to dispatch. Directions use the device's maps application and only addresses returned by the authorised driver projection.

## Validation
`npm test` validates deadline and storage behaviour. `npm run typecheck` checks TypeScript. CI also exports iOS and Android bundles. Device installation and EAS distribution require the Expo account's normal build workflow.

Backend changes are managed in `jeremydramos-wq/docklane-dispatch-dev`; see its release migrations and v2 driver API contracts.
