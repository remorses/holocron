---
'@holocron.so/vite': minor
---

Add `imageboard` tab type — render a folder of images and videos as a masonry moodboard page.

```json
{
  "navigation": {
    "tabs": [
      {
        "tab": "Moodboard",
        "icon": "images",
        "imageboard": "./public/moodboard",
        "columns": 3
      }
    ]
  }
}
```

Point the tab at a folder (relative to the project root) and Holocron walks it recursively and renders every image and video in a responsive CSS-columns masonry grid, sorted newest first.

- **Sorting** uses git commit history (last commit that touched each file), so the order is stable across clones and CI deployments. Uncommitted files fall back to filesystem mtime.
- **Images** go through the existing build-time pipeline: sharp dimensions, pixelated placeholders, native `loading="lazy"`, and click-to-zoom — with zero layout shift.
- **Videos** (`.mp4`, `.webm`, `.mov`, `.mkv`) get dimensions probed from container headers (pure TS, no ffmpeg) and render with `preload="metadata"`.
- Folders outside `public/` work too: images are copied into `/_holocron/images/`, videos into `/_holocron/media/`.
- The page renders in `custom` mode (no sidebars) and the folder is watched in dev — adding or editing media hot-reloads the grid.

`columns` sets the maximum column count (default 3); fewer columns are used automatically on narrow viewports.
