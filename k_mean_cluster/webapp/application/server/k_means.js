// Copyright (C) 2026 Jonas Immanuel Frey - Licensed under MIT. See LICENSE file for details

// 2D k-means (Lloyd's algorithm), adapted from ../../k_means_clustering.js.
// instead of rendering gif frames on disk, it returns a list of lightweight
// 'frames' the client can animate: each frame is a snapshot of the centroids
// plus, for every datapoint, the index of the cluster it currently belongs to.

let f_n_idx__rand = function (n_len) {
  return Math.floor(Math.random() * n_len);
};

let f_o_centroid = function (n_x, n_y) {
  return { n_x, n_y };
};

// squared euclidean distance is enough for nearest-centroid comparison
let f_n_dist2 = function (o_a, o_b) {
  let n_dx = o_a.n_x - o_b.n_x;
  let n_dy = o_a.n_y - o_b.n_y;
  return n_dx * n_dx + n_dy * n_dy;
};

let f_n_idx__nearest = function (o_p, a_o_centroid) {
  let n_idx__best = 0;
  let n_dist2__best = Infinity;
  for (let n_idx = 0; n_idx < a_o_centroid.length; n_idx += 1) {
    let n_dist2 = f_n_dist2(o_p, a_o_centroid[n_idx]);
    if (n_dist2 < n_dist2__best) {
      n_dist2__best = n_dist2;
      n_idx__best = n_idx;
    }
  }
  return n_idx__best;
};

// step 3+4: assign each point to its nearest centroid (returns a cluster index
// per point, parallel to a_o_p).
let f_a_n_assign = function (a_o_p, a_o_centroid) {
  return a_o_p.map((o_p) => f_n_idx__nearest(o_p, a_o_centroid));
};

// step 5: move each centroid to the mean of its members; an empty cluster keeps
// its previous position.
let f_a_o_centroid__mean = function (a_o_p, a_n_assign, a_o_centroid) {
  return a_o_centroid.map((o_centroid, n_idx__cluster) => {
    let n_sum_x = 0;
    let n_sum_y = 0;
    let n_cnt = 0;
    for (let n_idx = 0; n_idx < a_o_p.length; n_idx += 1) {
      if (a_n_assign[n_idx] == n_idx__cluster) {
        n_sum_x += a_o_p[n_idx].n_x;
        n_sum_y += a_o_p[n_idx].n_y;
        n_cnt += 1;
      }
    }
    if (n_cnt == 0) return f_o_centroid(o_centroid.n_x, o_centroid.n_y);
    return f_o_centroid(n_sum_x / n_cnt, n_sum_y / n_cnt);
  });
};

let f_o_frame = function (s_phase, s_caption, n_it, a_o_centroid, a_n_assign) {
  return {
    s_phase,
    s_caption,
    n_it,
    a_o_centroid: a_o_centroid.map((o) => f_o_centroid(o.n_x, o.n_y)),
    a_n_assign: a_n_assign.slice(),
  };
};

// inertia (within-cluster sum of squares): total squared distance from each point
// to its assigned centroid — the quantity k-means minimizes. lower = tighter fit.
let f_n_inertia = function (a_o_p, a_n_assign, a_o_centroid) {
  let n_sum = 0;
  for (let n_idx = 0; n_idx < a_o_p.length; n_idx += 1) {
    let n_cluster = a_n_assign[n_idx];
    if (n_cluster >= 0) n_sum += f_n_dist2(a_o_p[n_idx], a_o_centroid[n_cluster]);
  }
  return n_sum;
};

// initial centroids: Forgy (k distinct random points) or k-means++ (spread out —
// each next centroid picked with probability proportional to its squared distance
// to the nearest chosen centroid).
let f_a_o_centroid__init = function (a_o_p, k, b_kpp) {
  let n_m = a_o_p.length;
  if (!b_kpp) {
    let a_o_centroid = [];
    let a_n_idx__used = [];
    while (a_o_centroid.length < k) {
      let n_idx = f_n_idx__rand(n_m);
      if (!a_n_idx__used.includes(n_idx)) {
        a_n_idx__used.push(n_idx);
        a_o_centroid.push(f_o_centroid(a_o_p[n_idx].n_x, a_o_p[n_idx].n_y));
      }
    }
    return a_o_centroid;
  }
  let n_idx__first = f_n_idx__rand(n_m);
  let a_o_centroid = [f_o_centroid(a_o_p[n_idx__first].n_x, a_o_p[n_idx__first].n_y)];
  while (a_o_centroid.length < k) {
    let a_n_dist2 = a_o_p.map((o_p) => {
      let n_best = Infinity;
      for (let o_centroid of a_o_centroid) n_best = Math.min(n_best, f_n_dist2(o_p, o_centroid));
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
    a_o_centroid.push(f_o_centroid(a_o_p[n_idx].n_x, a_o_p[n_idx].n_y));
  }
  return a_o_centroid;
};

// runs k-means to convergence and returns every intermediate frame. two frames
// are emitted per iteration ('assign' then 'update') so the animation shows the
// points recoloring and then the centroids sliding to their new mean.
let f_o_result__k_means = function (a_o_p, n_clusters, n_its_max = 60, b_kpp = false) {
  let a_o_frame = [];
  let k = Math.max(1, Math.min(Math.round(n_clusters), a_o_p.length));
  if (a_o_p.length == 0) return { a_o_frame, a_o_centroid: [], n_it: 0, k: 0, n_inertia: 0 };

  // step 2: pick the initial centroids (Forgy by default, k-means++ if requested)
  let a_o_centroid = f_a_o_centroid__init(a_o_p, k, b_kpp);

  // init frame: grey points (-1 = unassigned) with the initial centroids showing
  let a_n_assign = new Array(a_o_p.length).fill(-1);
  a_o_frame.push(f_o_frame('init', b_kpp ? 'spread means (k-means++)' : 'random means', 0, a_o_centroid, a_n_assign));

  let b_converged = false;
  let n_it = 0;
  while (!b_converged && n_it < n_its_max) {
    a_n_assign = f_a_n_assign(a_o_p, a_o_centroid);
    a_o_frame.push(f_o_frame('assign', 'closest means', n_it, a_o_centroid, a_n_assign));

    let a_o_centroid__new = f_a_o_centroid__mean(a_o_p, a_n_assign, a_o_centroid);
    // converged when no centroid moved between iterations
    b_converged = a_o_centroid__new.every((o_new, n_idx) => {
      return f_n_dist2(o_new, a_o_centroid[n_idx]) < 1e-12;
    });
    a_o_centroid = a_o_centroid__new;
    a_o_frame.push(
      f_o_frame('update', b_converged ? 'converged' : 'recalculate mean', n_it, a_o_centroid, a_n_assign)
    );
    n_it += 1;
  }

  return { a_o_frame, a_o_centroid, n_it, k, n_inertia: f_n_inertia(a_o_p, a_n_assign, a_o_centroid) };
};

// run k-means n_retries times and return EVERY run (each with its own frames +
// inertia) plus the index of the lowest-inertia one. with n_retries = 1 this is a
// single plain run. the client lists all runs and lets the user load any of them.
let f_o_result__k_means__runs = function (a_o_p, n_clusters, n_retries, b_kpp, n_its_max = 60) {
  let n_tries = Math.max(1, Math.round(n_retries || 1));
  let a_o_run = [];
  let n_idx__best = 0;
  for (let n_it = 0; n_it < n_tries; n_it += 1) {
    let o_result = f_o_result__k_means(a_o_p, n_clusters, n_its_max, b_kpp);
    a_o_run.push(o_result);
    if (o_result.n_inertia < a_o_run[n_idx__best].n_inertia) n_idx__best = n_it;
  }
  return { a_o_run, n_idx__best };
};

export { f_o_result__k_means, f_o_result__k_means__runs };
