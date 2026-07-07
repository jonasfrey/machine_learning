# dataset2d manager

A full-screen web app to manage 2D datasets. All data lives on a Deno server in
SQLite; the browser is a pure GUI that talks to the server over a WebSocket.

## run

```
deno task start        # http://localhost:8000  (installs deps on first run)
deno task rmdb         # wipe the database
```

`PORT=8137 deno task start` to change the port.

## architecture

- **server/server.js** — Deno HTTP + WebSocket server, serves `client/` statically.
- **server/db.js** — SQLite schema + queries (`a_o_dataset2d`, `a_o_vec2d`, `a_o_window`).
- **server/generate.js** — server-side point generators (`random_simple`, `uniform`, `ring`).
- **server/k_means.js** — 2D k-means (Lloyd's algorithm); returns the whole
  animation as a list of frames (centroids + per-point cluster assignment).
- **server/handlers.js** — WebSocket message handlers; every mutation broadcasts a
  full `state` snapshot to all clients. `k_means_run` replies with the transient
  animation to just the requesting client (not stored in shared state).
- **client/** — Vue 3 (composition API only, vendored in `client/vendor/`).
  - **c_window.js** — generic movable/resizable window; geometry persists to the DB.
  - **c_dataset2d.js** — the dataset editor: pick/create/delete datasets, tune
    generation params (amount / radius / random), and paint or erase points on a canvas.
  - **c_k_means.js** — runs k-means on a chosen dataset (computed server-side) and
    plays back the assign → recalculate-mean steps with play/pause/scrub/speed.
  - **app.js** — top-bar navigation + windowing; add a window by registering it in
    `a_o_window_def`.

## message format

```json
{ "s_type": "vec2d_add", "v_data": { }, "n_ts_ms": 1782736076770 }
```

Server is the single source of truth: the client sends a message and re-renders
when the next `state` snapshot arrives — it never mutates state locally. UI state
(open windows, their position/size) is stored in SQLite, so the layout is restored
on reload.
