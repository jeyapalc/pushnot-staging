# PUSHNOT — How Push Notifications Work (3D speaker aid)

A static Three.js stage for presenting the push-notification chain live. The presenter moves data
across the chain with the scrubber, or lets it play.

## Cast (3D)
| Object | Meaning |
|---|---|
| Server rack (`data_center_rack.glb`) + floating table | App backend and its `installations` registrations |
| Smartphone (`generic_smartphone_game-ready.glb`) + token card | App installation on John's iPhone |
| Cyan icosahedron | APNs (the route for `apns:` tokens) |
| Purple icosahedron | FCM (the route for Android installs, shown idle) |
| 🔑 Amber octahedron | **Device token**: the address (WHERE) |
| ✉ Green slab | **Payload**: the message (WHAT), labelled with the token it is addressed to |
| ● Small sphere | Provider response (`200 ACCEPTED` / `410 UNREGISTERED`) |

## Stages
1. **Mint token**: APNs issues an opaque token to the app. The backend has no row yet.
2. **Register**: the app syncs the token to its backend, which upserts one ACTIVE row.
3. **Event & lookup**: an order ships, the backend finds John's active installation(s), and builds the payload.
4. **Send to APNs**: the authenticated request goes to APNs, which replies `200`. That means accepted, not delivered.
5. **Deliver & display**: APNs delivers the message, the OS permission gate runs, and the banner shows (or is suppressed).
6. **Reinstall & rotate**: the old token dies and a new token is minted and registered. A stale send then gets `410` and the old row is retired while the new one stays ACTIVE.

Toggles: **fan-out** to John's iPad, **alerts allowed/denied**, **second app token** on the same phone.

Hotkeys: `←/→` stage, `Space` play/pause, `,`/`.` nudge, `1–6` jump, `F` full send (stages 3→5).

## Deploy
Static site. `netlify.toml` publishes `public/`, and there is no build step.
