---
'@holocron.so/vite': patch
---

Remove the DialKit config customization panel (the live docs.json tweak pane shown on dev and preview subdomains) and drop the `dialkit` dependency from the client bundle.

The config-override system stays: the dashboard live preview still works via the `?configOverride=` query param and the `config-override` postMessage listener, which merge an override onto the deployed `docs.json` and refresh in place.
