# Project Guidance

## Product and stack
- Build a responsive Korean travel destination and accommodation reservation site with semantic HTML, CSS, and plain browser JavaScript. Do not add a frontend framework or build step unless the owner changes this requirement.
- Run the development web server with Python. For the current static HTML/CSS/JS MVP, start it from the project root with `python -m http.server 8000`; open `http://localhost:8000`. Do not substitute a Node-based development server. If server-side endpoints are added later, implement and run that server in Python.
- Keep the public entry at root `index.html`; put all other HTML views in `html/`, stylesheets in `css/`, and browser scripts in `js/`.
- Use Firebase Authentication for member identity and Firebase Realtime Database (RTDB) for application data. RTDB is a schemaless JSON tree; use the logical paths defined in `PRD.md`.
- Keep Firebase client settings in `js/firebase-config.js`. The web config is public; never put Admin SDK service-account keys, private keys, or privileged secrets in browser files or Git.

## Data and access rules
- Keep the four logical entities named `destinations`, `stays`, `members`, and `reservations`. Key member records by Firebase Auth `uid`.
- Validate inputs in the UI and enforce authorization and data validation again in RTDB Security Rules. Hidden buttons and client checks are not security controls.
- Public visitors may read published destinations and stays only. Signed-in members may access their own profile and reservations. Admin permissions must use a trusted Firebase Auth custom claim such as `admin: true`.
- Never let a browser client grant itself admin rights or write a privileged role field. Set custom claims only through a trusted Admin SDK process or protected Cloud Function.
- Derive reservation member UID from the authenticated session, validate dates and guest counts, and calculate price from current stay data. Do not trust browser-supplied totals. MVP reservations begin as `pending`; admins confirm after checking availability. Do not imply live inventory guarantees without conflict-safe inventory logic.
- Collect only data needed for accounts and reservations. Do not store passwords in RTDB; Firebase Authentication owns credentials.

## UI and code conventions
- Keep navigation, labels, validation messages, and documentation in Korean. Use responsive layouts and visible keyboard focus.
- Use shared CSS and small plain-JavaScript modules/helpers. Use `textContent` for user-provided strings; do not interpolate untrusted data into `innerHTML`.
- Show loading, empty, success, and error states for Firebase operations. Handle rejected promises and explain network/authorization failures without exposing tokens or internal config.
- Use semantic headings, accessible labels, buttons for actions, and links for navigation. Preserve mobile usability.
- Do not claim Firebase, GitHub, or Vercel is connected or deployed until settings are provided and the integration is verified.

## Delivery sequence
- Work in this order: implement and review static HTML/CSS/JS screens; configure Firebase Authentication and RTDB; add and verify RTDB rules; test member/admin and reservation flows; connect GitHub; configure Vercel; verify production deployment.
- Use Firebase Emulator Suite or a separate development project before production data.
- Read `PRD.md` before implementing features. If implementation changes its screen inventory or data contracts, update the PRD in the same change.
