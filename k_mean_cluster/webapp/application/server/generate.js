// Copyright (C) 2026 Jonas Immanuel Frey - Licensed under MIT. See LICENSE file for details

// coordinates live in a normalized space [0..1] x [0..1]; the client maps them
// onto whatever canvas size it currently has.

let n_tau = Math.PI * 2;

let f_n_gauss = function () {
  // box-muller, returns roughly [-1..1] centered noise
  let n_u1 = Math.random() || 1e-9;
  let n_u2 = Math.random();
  return Math.sqrt(-2 * Math.log(n_u1)) * Math.cos(n_tau * n_u2) * 0.25;
};

let f_n_clamp01 = function (n) {
  return Math.max(0, Math.min(1, n));
};

// 'random simple' generator: a few gaussian blobs scattered in the unit square.
// n_amount = total points, n_radius = blob spread [0..1], n_random = extra jitter.
let f_a_o_p__random_simple = function (n_amount, n_radius, n_random) {
  let n_its_blob = Math.max(1, Math.round(2 + n_random * 4));
  let a_o_center = new Array(n_its_blob).fill(0).map(() => {
    return {
      n_x: 0.15 + Math.random() * 0.7,
      n_y: 0.15 + Math.random() * 0.7,
    };
  });
  let a_o_p = new Array(n_amount).fill(0).map(() => {
    let o_center = a_o_center[Math.floor(Math.random() * a_o_center.length)];
    let n_off = f_n_gauss() * n_radius + f_n_gauss() * n_random * 0.5;
    let n_ang = Math.random() * n_tau;
    return {
      n_x: f_n_clamp01(o_center.n_x + Math.cos(n_ang) * n_off),
      n_y: f_n_clamp01(o_center.n_y + Math.sin(n_ang) * n_off),
    };
  });
  return a_o_p;
};

// 'uniform' generator: flat random spread, ignores radius.
let f_a_o_p__uniform = function (n_amount, _n_radius, _n_random) {
  return new Array(n_amount).fill(0).map(() => {
    return { n_x: Math.random(), n_y: Math.random() };
  });
};

// 'ring' generator: points on a ring of the given radius around the center.
let f_a_o_p__ring = function (n_amount, n_radius, n_random) {
  return new Array(n_amount).fill(0).map((_v, n_idx) => {
    let n_it_nor = n_idx / n_amount;
    let n_r = n_radius * 0.45 + f_n_gauss() * n_random * 0.3;
    return {
      n_x: f_n_clamp01(0.5 + Math.cos(n_it_nor * n_tau) * n_r),
      n_y: f_n_clamp01(0.5 + Math.sin(n_it_nor * n_tau) * n_r),
    };
  });
};

let o_f_generator = {
  random_simple: f_a_o_p__random_simple,
  uniform: f_a_o_p__uniform,
  ring: f_a_o_p__ring,
};

let f_a_o_p__generate = function (s_kind, n_amount, n_radius, n_random) {
  let f_gen = o_f_generator[s_kind] || f_a_o_p__random_simple;
  return f_gen(Math.max(0, Math.round(n_amount)), n_radius, n_random);
};

let a_s_kind = Object.keys(o_f_generator);

export { f_a_o_p__generate, a_s_kind };
