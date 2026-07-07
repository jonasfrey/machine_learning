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

// runs k-means to convergence and returns every intermediate frame. two frames
// are emitted per iteration ('assign' then 'update') so the animation shows the
// points recoloring and then the centroids sliding to their new mean.
let f_o_result__k_means = function (a_o_p, n_clusters, n_its_max = 60) {
  let a_o_frame = [];
  let k = Math.max(1, Math.min(Math.round(n_clusters), a_o_p.length));
  if (a_o_p.length == 0) return { a_o_frame, a_o_centroid: [], n_it: 0, k: 0 };

  // step 2: pick k distinct random datapoints as the initial centroids
  let a_o_centroid = [];
  let a_n_idx__used = [];
  while (a_o_centroid.length < k) {
    let n_idx = f_n_idx__rand(a_o_p.length);
    if (!a_n_idx__used.includes(n_idx)) {
      a_n_idx__used.push(n_idx);
      a_o_centroid.push(f_o_centroid(a_o_p[n_idx].n_x, a_o_p[n_idx].n_y));
    }
  }

  // init frame: grey points (-1 = unassigned) with the random centroids showing
  let a_n_assign = new Array(a_o_p.length).fill(-1);
  a_o_frame.push(f_o_frame('init', 'random means', 0, a_o_centroid, a_n_assign));

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

  return { a_o_frame, a_o_centroid, n_it, k };
};

export { f_o_result__k_means };
