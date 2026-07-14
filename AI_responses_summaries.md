2026-06-29 12:17:00 - refactored unsupervised_learning/create_testdata.py to coding guidelines (naming conventions + full CLI script architecture)
2026-06-29 12:24:00 - added f_write_image helper (dependency-free PNG line-plot encoder) in unsupervised_learning/helper.js
2026-06-29 12:26:00 - ported helper.js f_write_image to Deno (ESM, Uint8Array/DataView, Deno.writeFileSync, built-in sync zlib/PNG encoder, no Node)
2026-06-29 12:36:00 - helper.js: plot each dataset on its own horizontal x-axis (1d scatter, no y) per coordinate-system cell
2026-06-30 11:13:43 - added f_write_image_plot_dataset_with_clusters to plot 1d datapoints with colored initial cluster markers
2026-06-30 11:21:25 - colored cluster-member datapoints with their cluster hue in f_write_image_plot_dataset_with_clusters
2026-06-30 11:41:25 - added f_a_n_rgb__hsl and picked cluster hues by index/count normalization on the hue wheel
2026-06-30 11:55:00 - added f_n_wrap helper for looping a number inside [n_min,n_max) and fixed the broken wrap in f_a_n_rand_clustered
2026-06-30 12:10:00 - added video helpers to helper.js: f_o_frame_recorder (sequential frame paths) and f_p_video__frames (ffmpeg stitch via Deno.Command)
2026-07-07 14:47:53 - upgraded kmeans to N-dimensional points (a_n->a_v, vector euclidean dist/mean, 1d+2d scatter plot)
2026-07-07 15:14:52 - implemented k_mean_cluster/webapp dataset2d manager (deno+ws+sqlite server, vue composition-api windowing client with canvas point editor)
2026-07-07 16:35:05 - added k_means webapp window: server-side 2D k-means (server/k_means.js) streams animation frames over websocket, client c_k_means.js plays assign/recalculate steps with play/pause/scrub/speed
2026-07-14 15:34:14 - added dataset_shapes webapp window (c_dataset_shapes.js): define star/rect/triangle/custom shapes, sample n points along outline with SVG preview, generate augmented labeled dataset (rotation/scale/translation + noise min-max) and download as json
2026-07-14 15:42:57 - dataset_shapes: shapes are now user-drawn custom polygons - per-shape editor (click to add vertex, drag to move, clear points, custom name), vertices connected into sampled outline
2026-07-14 15:53:13 - dataset_shapes: generate now stores set on server (a_o_shape_set/a_o_shape_sample tables), visualize all shapes in a set; k_means window: shape sets selectable, samples flattened to Nd vectors, clustered + PCA-projected to 2d (server/k_means_nd.js)
2026-07-14 16:01:41 - k_means: loop checkbox now off by default; after converging on a high-dim (>3) shape set, render the original shapes recolored by their found k-means cluster (server reply now includes raw a_o_sample)
2026-07-14 16:11:26 - shape-set k_means: normalize each 20d vector to canonical pose (center + rotation-align by 1st point + unit scale) before clustering & PCA, so random rotation/scale/translation augmentation still clusters by shape (verified ~100% purity)
2026-07-14 17:05:57 - shape sets now store their generation recipe (base shape vertices + params); stored sets have a 'load' button to edit shapes again, then 'regenerate' updates the set in place (shape_set_update); added db recipe columns + migration
2026-07-14 17:11:48 - dataset_shapes: shapes now have a FIXED point count (= 'number of points'); editor caps placement at that many, placed points ARE the data (no outline resampling at generate), changing the count re-points all shapes, incomplete shapes are skipped
2026-07-14 17:27:50 - documented the shape-clustering experiment in README.md (points→N-d vectors, normalization is essential, PCA for viz only) with the 4 k_means_shapes screenshots
2026-07-14 17:28:57 - README: reworded normalization lesson to 'crucial to normalize the data', added To-do (implement PCA + normalization from scratch myself)
2026-07-14 17:34:45 - k_means_nd PCA: deterministic power-iteration seed + eigenvector sign fix (largest-magnitude component positive) so the PCA scatter no longer flips/mirrors between runs (verified identical)
2026-07-14 17:49:02 - k_means: added 'keep lowest inertia' (best-of-N retries, default 10) + 'spread initial centroids (k-means++)' options; default stays a single plain run; inertia computed + shown; applies to both 2d and shape-set k-means
2026-07-14 17:57:29 - k_means: retries now return ALL runs (each with its own frames+inertia); UI lists every run's inertia as a clickable link (★ marks best), clicking loads that run's animation; shared PCA scatter across runs
2026-07-14 18:07:07 - README: added lessons + to-do for inertia (score/keep-lowest, elbow caveat) and k-means++ seeding
