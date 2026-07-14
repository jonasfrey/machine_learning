// Copyright (C) 2026 Jonas Immanuel Frey - Licensed under MIT. See LICENSE file for details

import {
  f_a_o_dataset2d,
  f_o_dataset2d__insert,
  f_dataset2d__delete,
  f_a_o_vec2d,
  f_vec2d__insert_many,
  f_vec2d__delete_ids,
  f_vec2d__delete_all,
  f_a_o_shape_set,
  f_o_shape_set__insert,
  f_o_shape_set__update,
  f_shape_set__delete,
  f_shape_sample__insert_many,
  f_a_o_shape_sample,
  f_shape_sample__delete_all,
  f_a_o_window,
  f_o_window__upsert,
} from './db.js';
import { f_a_o_p__generate, a_s_kind } from './generate.js';
import { f_o_result__k_means__runs } from './k_means.js';
import { f_o_result__k_means_shapes } from './k_means_nd.js';

let f_o_msg = function (s_type, v_data) {
  return { s_type, v_data, n_ts_ms: Date.now() };
};

// normalize a shape-set generation payload into the recipe fields the db stores.
let f_o_recipe = function (v_data) {
  let n_its_point = Math.max(1, Math.round(v_data?.n_its_point || 0));
  return {
    s_name: v_data?.s_name || 'set',
    n_its_point,
    n_dim: n_its_point * 2,
    n_per_shape: Math.max(0, Math.round(v_data?.n_per_shape || 0)),
    a_s_label: v_data?.a_s_label || [],
    a_o_shape: Array.isArray(v_data?.a_o_shape) ? v_data.a_o_shape : [],
    n_noise__min: v_data?.n_noise__min ?? 0,
    n_noise__max: v_data?.n_noise__max ?? 0,
  };
};

// full snapshot of everything the client needs to render the app.
let f_o_state = function (o_db) {
  let a_o_dataset2d = f_a_o_dataset2d(o_db).map((o_dataset2d) => {
    return { ...o_dataset2d, a_o_vec2d: f_a_o_vec2d(o_db, o_dataset2d.n_id) };
  });
  // shape sets ship as metadata only (with a sample count); the full sample point
  // data is fetched on demand via shape_set_samples_request to keep broadcasts lean.
  let a_o_shape_set = f_a_o_shape_set(o_db).map((o_shape_set) => {
    return {
      n_id: o_shape_set.n_id,
      s_name: o_shape_set.s_name,
      n_its_point: o_shape_set.n_its_point,
      n_dim: o_shape_set.n_dim,
      n_per_shape: o_shape_set.n_per_shape,
      n_cnt__sample: o_shape_set.n_cnt__sample,
      a_s_label: JSON.parse(o_shape_set.s_json__a_s_label),
      // the generation recipe (base shape vertices + params) so a set can be
      // loaded back into the editor and re-generated. lightweight, ships in state.
      a_o_shape: JSON.parse(o_shape_set.s_json__a_o_shape || '[]'),
      n_noise__min: o_shape_set.n_noise__min,
      n_noise__max: o_shape_set.n_noise__max,
      n_ts_ms__created: o_shape_set.n_ts_ms__created,
    };
  });
  return {
    a_o_dataset2d,
    a_o_shape_set,
    a_o_window: f_a_o_window(o_db),
    a_s_kind,
  };
};

let f_broadcast_state = function (o_db, a_socket) {
  let s_json = JSON.stringify(f_o_msg('state', f_o_state(o_db)));
  for (let socket of a_socket) {
    if (socket.readyState == WebSocket.OPEN) socket.send(s_json);
  }
};

// each handler mutates the db then returns true to trigger a state broadcast.
let o_f_handler = {
  state_request: function () {
    return true;
  },

  dataset2d_create: function (o_db, v_data) {
    let s_name = v_data?.s_name || 'dataset2d';
    let s_kind = a_s_kind.includes(v_data?.s_kind) ? v_data.s_kind : 'random_simple';
    let o_dataset2d = f_o_dataset2d__insert(o_db, s_name, s_kind);
    // optionally seed with generated points
    if (v_data?.n_amount > 0) {
      let a_o_p = f_a_o_p__generate(
        s_kind,
        v_data.n_amount,
        v_data.n_radius ?? 0.1,
        v_data.n_random ?? 0.2
      );
      f_vec2d__insert_many(o_db, o_dataset2d.n_id, a_o_p);
    }
    return true;
  },

  dataset2d_delete: function (o_db, v_data) {
    f_dataset2d__delete(o_db, v_data.n_id);
    return true;
  },

  // (re)generate the point cloud for an existing dataset from its params.
  dataset2d_generate: function (o_db, v_data) {
    let a_o_p = f_a_o_p__generate(
      v_data.s_kind || 'random_simple',
      v_data.n_amount ?? 100,
      v_data.n_radius ?? 0.1,
      v_data.n_random ?? 0.2
    );
    if (v_data.b_replace) f_vec2d__delete_all(o_db, v_data.n_id);
    f_vec2d__insert_many(o_db, v_data.n_id, a_o_p);
    return true;
  },

  dataset2d_clear: function (o_db, v_data) {
    f_vec2d__delete_all(o_db, v_data.n_id);
    return true;
  },

  // left-click on canvas → add one or more points (spray uses n_amount + n_radius).
  vec2d_add: function (o_db, v_data) {
    let a_o_p = [];
    let n_amount = Math.max(1, Math.round(v_data.n_amount ?? 1));
    let n_radius = v_data.n_radius ?? 0;
    let n_tau = Math.PI * 2;
    for (let n_it = 0; n_it < n_amount; n_it += 1) {
      let n_ang = Math.random() * n_tau;
      let n_off = Math.random() * n_radius;
      a_o_p.push({
        n_x: Math.max(0, Math.min(1, v_data.n_x + Math.cos(n_ang) * n_off)),
        n_y: Math.max(0, Math.min(1, v_data.n_y + Math.sin(n_ang) * n_off)),
      });
    }
    f_vec2d__insert_many(o_db, v_data.n_o_dataset2d_n_id, a_o_p);
    return true;
  },

  vec2d_remove: function (o_db, v_data) {
    f_vec2d__delete_ids(o_db, v_data.n_o_dataset2d_n_id, v_data.a_n_id || []);
    return true;
  },

  window_upsert: function (o_db, v_data) {
    f_o_window__upsert(o_db, v_data);
    return true;
  },

  // persist a generated shape set: the recipe (base shapes + params) plus the
  // augmented samples the client computed from it.
  shape_set_create: function (o_db, v_data) {
    let o_recipe = f_o_recipe(v_data);
    let a_o_sample = Array.isArray(v_data?.a_o_sample) ? v_data.a_o_sample : [];
    let o_shape_set = f_o_shape_set__insert(o_db, o_recipe);
    if (a_o_sample.length) f_shape_sample__insert_many(o_db, o_shape_set.n_id, a_o_sample);
    return true;
  },

  // re-generate an existing set: replace its recipe + samples in place (same id).
  shape_set_update: function (o_db, v_data) {
    let o_recipe = f_o_recipe(v_data);
    let a_o_sample = Array.isArray(v_data?.a_o_sample) ? v_data.a_o_sample : [];
    f_o_shape_set__update(o_db, v_data.n_id, o_recipe);
    f_shape_sample__delete_all(o_db, v_data.n_id);
    if (a_o_sample.length) f_shape_sample__insert_many(o_db, v_data.n_id, a_o_sample);
    return true;
  },

  shape_set_delete: function (o_db, v_data) {
    f_shape_set__delete(o_db, v_data.n_id);
    return true;
  },

  // reply (to the asking client only) with every sample's points, for visualization.
  shape_set_samples_request: function (o_db, v_data, o_ctx) {
    let a_o_sample = f_a_o_shape_sample(o_db, v_data.n_id).map((o_row) => {
      return { n_id: o_row.n_id, s_label: o_row.s_label, a_o_p: JSON.parse(o_row.s_json__a_o_p) };
    });
    o_ctx.f_reply('shape_set_samples', { n_id: v_data.n_id, a_o_sample });
    return false;
  },

  // run k-means on a shape set: each sample is flattened to an n-d vector, clustered
  // in that space, then PCA-projected to 2d so the same animation renderer applies.
  k_means_shapes_run: function (o_db, v_data, o_ctx) {
    let a_o_sample = f_a_o_shape_sample(o_db, v_data.n_id).map((o_row) => {
      return { s_label: o_row.s_label, a_o_p: JSON.parse(o_row.s_json__a_o_p) };
    });
    let o_result = f_o_result__k_means_shapes(
      a_o_sample,
      v_data.n_clusters ?? 3,
      v_data.n_retries ?? 1,
      v_data.b_kpp ?? false
    );
    o_ctx.f_reply('k_means_result', {
      n_o_shape_set_n_id: v_data.n_id,
      n_clusters: o_result.k,
      n_dim: o_result.n_dim,
      a_o_p: o_result.a_o_p,
      // every run's frames + inertia; the client picks which to display
      a_o_run: o_result.a_o_run,
      n_idx__best: o_result.n_idx__best,
      // the original shapes (normalized outlines) so the client can redraw them
      // grouped by the cluster k-means found, once it has converged.
      a_o_sample,
    });
    return false;
  },

  // run 2D k-means on a dataset server-side and reply with the whole animation
  // (points snapshot + per-iteration frames). the result is transient — it goes
  // only to the requesting socket and is never stored in the shared state.
  k_means_run: function (o_db, v_data, o_ctx) {
    let a_o_vec2d = f_a_o_vec2d(o_db, v_data.n_id);
    let a_o_p = a_o_vec2d.map((o_vec2d) => ({ n_x: o_vec2d.n_x, n_y: o_vec2d.n_y }));
    let o_runs = f_o_result__k_means__runs(
      a_o_p,
      v_data.n_clusters ?? 3,
      v_data.n_retries ?? 1,
      v_data.b_kpp ?? false
    );
    // strip each run down to what the renderer needs (frames + inertia)
    let a_o_run = o_runs.a_o_run.map((o_run) => {
      return { n_inertia: o_run.n_inertia, a_o_frame: o_run.a_o_frame, n_it: o_run.n_it };
    });
    o_ctx.f_reply('k_means_result', {
      n_o_dataset2d_n_id: v_data.n_id,
      n_clusters: o_runs.a_o_run[0].k,
      a_o_p,
      a_o_run,
      n_idx__best: o_runs.n_idx__best,
    });
    return false;
  },
};

let f_handle_message = function (o_db, a_socket, socket, s_json) {
  let o_msg;
  try {
    o_msg = JSON.parse(s_json);
  } catch (o_err) {
    console.error('bad json message', o_err.message);
    return;
  }
  let f_handler = o_f_handler[o_msg.s_type];
  if (!f_handler) {
    console.error('unknown message type', o_msg.s_type);
    return;
  }
  let o_ctx = {
    socket,
    a_socket,
    // send a message back to just the requesting client
    f_reply: function (s_type, v_data) {
      if (socket.readyState == WebSocket.OPEN) {
        socket.send(JSON.stringify(f_o_msg(s_type, v_data)));
      }
    },
  };
  let b_broadcast = f_handler(o_db, o_msg.v_data, o_ctx);
  if (b_broadcast) f_broadcast_state(o_db, a_socket);
};

export { f_handle_message, f_o_state, f_o_msg };
