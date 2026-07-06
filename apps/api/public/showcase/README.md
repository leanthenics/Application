# Showcase content (landing page before/after cards)

This folder holds the **static** before/after images shown on the app's Home (landing)
screen, plus the `showcase.json` manifest that describes them. It's served by the API:

- Images are served statically at `GET /showcase/assets/<filename>`.
- The manifest is served (with affiliate links built in) at `GET /showcase`.

## How to change the showcase (no code change)

1. Drop your before/after image files into this folder (JPG or PNG). Recommended:
   ~768px wide, and **before/after should share the same aspect ratio** so the
   drag-to-compare slider overlays cleanly.
2. Edit `showcase.json`. Each entry:

   ```jsonc
   {
     "id": "living-room",              // unique, stable id
     "title": "Warm living room",      // optional label shown above the card
     "before": "living-before.png",    // filename in THIS folder
     "after": "living-after.png",      // filename in THIS folder
     "keyterms": [                     // products shown when the card is opened;
       "rattan lounge chair",          // each becomes an Amazon affiliate search
       "arc floor lamp"                // link automatically (AMAZON_TLD + tag)
     ]
   }
   ```

3. Restart the API (the manifest is read on each request, but a restart is the
   safe way to be sure). No mobile rebuild is needed — the app fetches `/showcase`
   on launch.

The current files (`*-before.png` / `*-after.png`) are **placeholder solid-color
images** — replace them with real before/after renders.
