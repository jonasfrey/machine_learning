2026-06-29 12:17:00 - refactored unsupervised_learning/create_testdata.py to coding guidelines (naming conventions + full CLI script architecture)
2026-06-29 12:24:00 - added f_write_image helper (dependency-free PNG line-plot encoder) in unsupervised_learning/helper.js
2026-06-29 12:26:00 - ported helper.js f_write_image to Deno (ESM, Uint8Array/DataView, Deno.writeFileSync, built-in sync zlib/PNG encoder, no Node)
2026-06-29 12:36:00 - helper.js: plot each dataset on its own horizontal x-axis (1d scatter, no y) per coordinate-system cell
2026-06-30 11:13:43 - added f_write_image_plot_dataset_with_clusters to plot 1d datapoints with colored initial cluster markers
2026-06-30 11:21:25 - colored cluster-member datapoints with their cluster hue in f_write_image_plot_dataset_with_clusters
2026-06-30 11:41:25 - added f_a_n_rgb__hsl and picked cluster hues by index/count normalization on the hue wheel
2026-06-30 11:55:00 - added f_n_wrap helper for looping a number inside [n_min,n_max) and fixed the broken wrap in f_a_n_rand_clustered
2026-06-30 12:10:00 - added video helpers to helper.js: f_o_frame_recorder (sequential frame paths) and f_p_video__frames (ffmpeg stitch via Deno.Command)
