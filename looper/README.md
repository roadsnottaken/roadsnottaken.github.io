# Looper
Mobile-first multitrack loop / demo recorder (PWA). Static files only, no build step.
Serve locally: `python3 -m http.server 8080 --directory /workspace/looper`
Publish: copy this folder (minus README/.git if you like) into the `looper/` folder of
roadsnottaken/roadsnottaken.github.io (same way as `parks/`), commit to `main`; it serves at
https://roadsnottaken.github.io/looper/. All paths are relative, so any subfolder works.
Bump `CACHE` in sw.js on each release so installed copies pick up the update.
