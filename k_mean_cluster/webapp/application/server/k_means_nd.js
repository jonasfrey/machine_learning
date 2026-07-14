// Copyright (C) 2026 Jonas Immanuel Frey - Licensed under MIT. See LICENSE file for details

// n-dimensional k-means for shape sets: each shape sample (e.g. 10 2d points) is
// flattened into one vector (20 numbers) and clustered in that high-dim space.
// so the result can be animated by the existing 2d renderer, every sample vector
// and every centroid is projected down to 2d via PCA, then normalized to [0..1].

// ---------------------------------------------------------------- vector k-means

let f_n_dist2 = function (a_n_a, a_n_b) {
  let n_sum = 0;
  for (let n_idx = 0; n_idx < a_n_a.length; n_idx += 1) {
    let n_d = a_n_a[n_idx] - a_n_b[n_idx];
    n_sum += n_d * n_d;
  }
  return n_sum;
};

let f_n_idx__nearest = function (a_n_vec, a_a_n_centroid) {
  let n_idx__best = 0;
  let n_dist2__best = Infinity;
  for (let n_idx = 0; n_idx < a_a_n_centroid.length; n_idx += 1) {
    let n_dist2 = f_n_dist2(a_n_vec, a_a_n_centroid[n_idx]);
    if (n_dist2 < n_dist2__best) {
      n_dist2__best = n_dist2;
      n_idx__best = n_idx;
    }
  }
  return n_idx__best;
};

// mean vector of each cluster's members; an empty cluster keeps its old position.
let f_a_a_n_centroid__mean = function (a_a_n_vec, a_n_assign, a_a_n_centroid, n_dim) {
  return a_a_n_centroid.map((a_n_centroid, n_idx__cluster) => {
    let a_n_sum = new Array(n_dim).fill(0);
    let n_cnt = 0;
    for (let n_idx = 0; n_idx < a_a_n_vec.length; n_idx += 1) {
      if (a_n_assign[n_idx] == n_idx__cluster) {
        let a_n_vec = a_a_n_vec[n_idx];
        for (let n_it = 0; n_it < n_dim; n_it += 1) a_n_sum[n_it] += a_n_vec[n_it];
        n_cnt += 1;
      }
    }
    if (n_cnt == 0) return a_n_centroid.slice();
    return a_n_sum.map((n) => n / n_cnt);
  });
};

let f_o_frame = function (s_phase, s_caption, n_it, a_a_n_centroid, a_n_assign) {
  return {
    s_phase,
    s_caption,
    n_it,
    a_a_n_centroid: a_a_n_centroid.map((a_n) => a_n.slice()),
    a_n_assign: a_n_assign.slice(),
  };
};

// inertia (a.k.a. within-cluster sum of squares): the total squared distance from
// every point to its assigned centroid. this is exactly what k-means minimizes, so
// a lower inertia = a tighter, better fit. it lets us score & compare runs.
let f_n_inertia = function (a_a_n_vec, a_n_assign, a_a_n_centroid) {
  let n_sum = 0;
  for (let n_idx = 0; n_idx < a_a_n_vec.length; n_idx += 1) {
    let n_cluster = a_n_assign[n_idx];
    if (n_cluster >= 0) n_sum += f_n_dist2(a_a_n_vec[n_idx], a_a_n_centroid[n_cluster]);
  }
  return n_sum;
};

// initial centroids: Forgy (k distinct random samples) or, if b_kpp, k-means++
// (first centroid random, then each next chosen with probability proportional to
// its squared distance to the nearest chosen centroid → they spread out).
let f_a_a_n_centroid__init = function (a_a_n_vec, k, b_kpp) {
  let n_m = a_a_n_vec.length;
  if (!b_kpp) {
    let a_a_n_centroid = [];
    let a_n_idx__used = [];
    while (a_a_n_centroid.length < k) {
      let n_idx = Math.floor(Math.random() * n_m);
      if (!a_n_idx__used.includes(n_idx)) {
        a_n_idx__used.push(n_idx);
        a_a_n_centroid.push(a_a_n_vec[n_idx].slice());
      }
    }
    return a_a_n_centroid;
  }
  let a_a_n_centroid = [a_a_n_vec[Math.floor(Math.random() * n_m)].slice()];
  while (a_a_n_centroid.length < k) {
    let a_n_dist2 = a_a_n_vec.map((a_n_vec) => {
      let n_best = Infinity;
      for (let a_n_centroid of a_a_n_centroid) {
        n_best = Math.min(n_best, f_n_dist2(a_n_vec, a_n_centroid));
      }
      return n_best;
    });
    let n_sum = a_n_dist2.reduce((n, v) => n + v, 0);
    let n_r = Math.random() * n_sum;
    let n_idx = 0;
    for (; n_idx < a_n_dist2.length; n_idx += 1) {
      n_r -= a_n_dist2[n_idx];
      if (n_r <= 0) break;
    }
    if (n_idx >= n_m) n_idx = n_m - 1;
    a_a_n_centroid.push(a_a_n_vec[n_idx].slice());
  }
  return a_a_n_centroid;
};

// Lloyd's algorithm in n-d; two frames per iteration (assign then update).
let f_o_result__k_means_nd = function (a_a_n_vec, n_clusters, n_its_max = 60, b_kpp = false) {
  let a_o_frame = [];
  let n_m = a_a_n_vec.length;
  let k = Math.max(1, Math.min(Math.round(n_clusters), n_m));
  if (n_m == 0) return { a_o_frame, n_it: 0, k: 0, n_inertia: 0 };
  let n_dim = a_a_n_vec[0].length;

  let a_a_n_centroid = f_a_a_n_centroid__init(a_a_n_vec, k, b_kpp);

  let a_n_assign = new Array(n_m).fill(-1);
  a_o_frame.push(f_o_frame('init', b_kpp ? 'spread means (k-means++)' : 'random means', 0, a_a_n_centroid, a_n_assign));

  let b_converged = false;
  let n_it = 0;
  while (!b_converged && n_it < n_its_max) {
    a_n_assign = a_a_n_vec.map((a_n_vec) => f_n_idx__nearest(a_n_vec, a_a_n_centroid));
    a_o_frame.push(f_o_frame('assign', 'closest means', n_it, a_a_n_centroid, a_n_assign));

    let a_a_n_centroid__new = f_a_a_n_centroid__mean(a_a_n_vec, a_n_assign, a_a_n_centroid, n_dim);
    b_converged = a_a_n_centroid__new.every((a_n_new, n_idx) => {
      return f_n_dist2(a_n_new, a_a_n_centroid[n_idx]) < 1e-12;
    });
    a_a_n_centroid = a_a_n_centroid__new;
    a_o_frame.push(
      f_o_frame('update', b_converged ? 'converged' : 'recalculate mean', n_it, a_a_n_centroid, a_n_assign)
    );
    n_it += 1;
  }

  return { a_o_frame, n_it, k, n_inertia: f_n_inertia(a_a_n_vec, a_n_assign, a_a_n_centroid) };
};

// ---------------------------------------------------------------- PCA (2 comps)

let f_a_n__mat_vec = function (a_a_n_mat, a_n_vec) {
  return a_a_n_mat.map((a_n_row) => {
    let n_sum = 0;
    for (let n_idx = 0; n_idx < a_n_row.length; n_idx += 1) n_sum += a_n_row[n_idx] * a_n_vec[n_idx];
    return n_sum;
  });
};

let f_a_n__normalize = function (a_n_vec) {
  let n_len = Math.sqrt(a_n_vec.reduce((n, v) => n + v * v, 0)) || 1e-12;
  return a_n_vec.map((v) => v / n_len);
};

// deterministic, non-uniform start vector so power iteration is reproducible
// run-to-run (a random start would let the result flip between +v and -v).
let f_a_n__seed = function (n_dim) {
  let a_n_vec = new Array(n_dim);
  for (let n_it = 0; n_it < n_dim; n_it += 1) a_n_vec[n_it] = Math.sin(n_it + 1);
  return a_n_vec;
};

// an eigenvector is only defined up to sign (+v and -v are both valid), which
// would mirror the whole scatter between runs. pin the sign so the largest-
// magnitude component is always positive → a stable, non-jumping projection.
let f_a_n__sign_fix = function (a_n_vec) {
  let n_idx__max = 0;
  let n_mag__max = -1;
  for (let n_it = 0; n_it < a_n_vec.length; n_it += 1) {
    let n_mag = Math.abs(a_n_vec[n_it]);
    if (n_mag > n_mag__max) {
      n_mag__max = n_mag;
      n_idx__max = n_it;
    }
  }
  return a_n_vec[n_idx__max] < 0 ? a_n_vec.map((n) => -n) : a_n_vec;
};

// dominant eigenvector of a symmetric matrix via power iteration.
let f_a_n__eigenvector = function (a_a_n_mat, n_dim, n_its = 128) {
  let a_n_vec = f_a_n__normalize(f_a_n__seed(n_dim));
  for (let n_it = 0; n_it < n_its; n_it += 1) {
    a_n_vec = f_a_n__normalize(f_a_n__mat_vec(a_a_n_mat, a_n_vec));
  }
  return f_a_n__sign_fix(a_n_vec);
};

// build the top-2 principal axes (mean-centered) of the sample vectors.
let f_o_pca = function (a_a_n_vec, n_dim) {
  let n_m = a_a_n_vec.length;
  let a_n_mean = new Array(n_dim).fill(0);
  for (let a_n_vec of a_a_n_vec) {
    for (let n_it = 0; n_it < n_dim; n_it += 1) a_n_mean[n_it] += a_n_vec[n_it];
  }
  for (let n_it = 0; n_it < n_dim; n_it += 1) a_n_mean[n_it] /= Math.max(1, n_m);

  // covariance matrix (n_dim x n_dim) of the centered data
  let a_a_n_cov = new Array(n_dim).fill(0).map(() => new Array(n_dim).fill(0));
  for (let a_n_vec of a_a_n_vec) {
    for (let n_i = 0; n_i < n_dim; n_i += 1) {
      let n_di = a_n_vec[n_i] - a_n_mean[n_i];
      for (let n_j = 0; n_j < n_dim; n_j += 1) {
        a_a_n_cov[n_i][n_j] += n_di * (a_n_vec[n_j] - a_n_mean[n_j]);
      }
    }
  }
  let n_inv = 1 / Math.max(1, n_m);
  for (let n_i = 0; n_i < n_dim; n_i += 1) {
    for (let n_j = 0; n_j < n_dim; n_j += 1) a_a_n_cov[n_i][n_j] *= n_inv;
  }

  let a_n_v1 = f_a_n__eigenvector(a_a_n_cov, n_dim);
  // eigenvalue λ1 = v1ᵀ C v1, then deflate to expose the 2nd component
  let a_n_cv1 = f_a_n__mat_vec(a_a_n_cov, a_n_v1);
  let n_lambda1 = a_n_v1.reduce((n, v, n_idx) => n + v * a_n_cv1[n_idx], 0);
  for (let n_i = 0; n_i < n_dim; n_i += 1) {
    for (let n_j = 0; n_j < n_dim; n_j += 1) {
      a_a_n_cov[n_i][n_j] -= n_lambda1 * a_n_v1[n_i] * a_n_v1[n_j];
    }
  }
  let a_n_v2 = f_a_n__eigenvector(a_a_n_cov, n_dim);

  return { a_n_mean, a_n_v1, a_n_v2 };
};

let f_o_p__project = function (a_n_vec, o_pca) {
  let n_x = 0;
  let n_y = 0;
  for (let n_idx = 0; n_idx < a_n_vec.length; n_idx += 1) {
    let n_d = a_n_vec[n_idx] - o_pca.a_n_mean[n_idx];
    n_x += n_d * o_pca.a_n_v1[n_idx];
    n_y += n_d * o_pca.a_n_v2[n_idx];
  }
  return { n_x, n_y };
};

// projected coords are unbounded; map them into [0.05 .. 0.95] for the renderer.
let f_o_norm = function (a_o_p) {
  let o_norm = { n_min_x: Infinity, n_max_x: -Infinity, n_min_y: Infinity, n_max_y: -Infinity };
  for (let o_p of a_o_p) {
    o_norm.n_min_x = Math.min(o_norm.n_min_x, o_p.n_x);
    o_norm.n_max_x = Math.max(o_norm.n_max_x, o_p.n_x);
    o_norm.n_min_y = Math.min(o_norm.n_min_y, o_p.n_y);
    o_norm.n_max_y = Math.max(o_norm.n_max_y, o_p.n_y);
  }
  return o_norm;
};

let f_o_p__map = function (o_p, o_norm) {
  let f_n = function (n, n_min, n_max) {
    let n_d = n_max - n_min;
    return n_d < 1e-9 ? 0.5 : 0.05 + 0.9 * ((n - n_min) / n_d);
  };
  return {
    n_x: f_n(o_p.n_x, o_norm.n_min_x, o_norm.n_max_x),
    n_y: f_n(o_p.n_y, o_norm.n_min_y, o_norm.n_max_y),
  };
};

// ---------------------------------------------------------------- normalization

// normalize a flattened shape vector [x0,y0,x1,y1,...] to a canonical pose so
// k-means compares SHAPE, not pose:
//   1. translate so the point centroid is the origin  (position-invariant)
//   2. rotate so the first point lands on the +x axis  (rotation-invariant; the
//      first point is a consistent outline landmark across a shape's samples)
//   3. scale so the vector has unit norm               (size-invariant)
// samples that differ only by position / rotation / size collapse onto (nearly)
// the same vector, leaving genuine shape differences (and noise) to cluster on.
let f_a_n__normalize_shape = function (a_n_vec) {
  let n_pt = a_n_vec.length / 2;
  if (n_pt < 1) return a_n_vec.slice();

  let n_cx = 0;
  let n_cy = 0;
  for (let n_it = 0; n_it < n_pt; n_it += 1) {
    n_cx += a_n_vec[n_it * 2];
    n_cy += a_n_vec[n_it * 2 + 1];
  }
  n_cx /= n_pt;
  n_cy /= n_pt;

  let a_n_x = new Array(n_pt);
  let a_n_y = new Array(n_pt);
  for (let n_it = 0; n_it < n_pt; n_it += 1) {
    a_n_x[n_it] = a_n_vec[n_it * 2] - n_cx;
    a_n_y[n_it] = a_n_vec[n_it * 2 + 1] - n_cy;
  }

  // rotate by -angle(first point) — skip if the first point sits on the centroid
  let n_len0 = Math.hypot(a_n_x[0], a_n_y[0]);
  let n_ang = n_len0 > 1e-9 ? Math.atan2(a_n_y[0], a_n_x[0]) : 0;
  let n_cos = Math.cos(-n_ang);
  let n_sin = Math.sin(-n_ang);

  let a_n_out = new Array(n_pt * 2);
  let n_sq = 0;
  for (let n_it = 0; n_it < n_pt; n_it += 1) {
    let n_rx = a_n_x[n_it] * n_cos - a_n_y[n_it] * n_sin;
    let n_ry = a_n_x[n_it] * n_sin + a_n_y[n_it] * n_cos;
    a_n_out[n_it * 2] = n_rx;
    a_n_out[n_it * 2 + 1] = n_ry;
    n_sq += n_rx * n_rx + n_ry * n_ry;
  }
  let n_scl = Math.sqrt(n_sq) || 1e-9;
  for (let n_it = 0; n_it < n_pt * 2; n_it += 1) a_n_out[n_it] /= n_scl;
  return a_n_out;
};

// ---------------------------------------------------------------- entry point

// cluster the shape samples in flattened n-d space and return a result in the
// exact shape the 2d k-means renderer expects (points + centroids already PCA-
// projected + normalized to [0..1]).
let f_o_result__k_means_shapes = function (a_o_sample, n_clusters, n_retries = 1, b_kpp = false, n_its_max = 60) {
  if (a_o_sample.length == 0) return { a_o_p: [], a_o_frame: [], n_it: 0, k: 0 };

  // flatten each shape to a raw vector, then normalize it to a canonical pose so
  // the random rotation / scale / translation from augmentation is removed before
  // clustering. both k-means AND the PCA view operate on these normalized vectors.
  let a_a_n_vec = a_o_sample.map((o_sample) => {
    let a_n_vec = [];
    for (let o_p of o_sample.a_o_p) a_n_vec.push(o_p.n_x, o_p.n_y);
    return f_a_n__normalize_shape(a_n_vec);
  });
  let n_dim = a_a_n_vec[0].length;

  // PCA is computed once from the (normalized) data — it's shared by every run,
  // so the scatter positions are identical; only the cluster coloring differs.
  let o_pca = f_o_pca(a_a_n_vec, n_dim);
  let a_o_p__proj = a_a_n_vec.map((a_n_vec) => f_o_p__project(a_n_vec, o_pca));
  let o_norm = f_o_norm(a_o_p__proj);
  let a_o_p = a_o_p__proj.map((o_p) => f_o_p__map(o_p, o_norm));

  // run k-means n_retries times; keep every run's frames + inertia so the client
  // can list them and load any one. project each run's centroids into the shared
  // PCA space for display.
  let n_tries = Math.max(1, Math.round(n_retries || 1));
  let a_o_run = [];
  let n_idx__best = 0;
  for (let n_it__run = 0; n_it__run < n_tries; n_it__run += 1) {
    let o_km = f_o_result__k_means_nd(a_a_n_vec, n_clusters, n_its_max, b_kpp);
    let a_o_frame = o_km.a_o_frame.map((o_frame) => {
      return {
        s_phase: o_frame.s_phase,
        s_caption: o_frame.s_caption,
        n_it: o_frame.n_it,
        a_n_assign: o_frame.a_n_assign,
        a_o_centroid: o_frame.a_a_n_centroid.map((a_n_c) => f_o_p__map(f_o_p__project(a_n_c, o_pca), o_norm)),
      };
    });
    a_o_run.push({ n_inertia: o_km.n_inertia, a_o_frame, n_it: o_km.n_it, k: o_km.k });
    if (o_km.n_inertia < a_o_run[n_idx__best].n_inertia) n_idx__best = n_it__run;
  }

  return { a_o_p, a_o_run, n_idx__best, n_dim, k: a_o_run[0].k };
};

export { f_o_result__k_means_shapes };
