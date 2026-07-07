// Copyright (C) 2026 Jonas Immanuel Frey - Licensed under MIT. See LICENSE file for details

import {
  f_a_o_dataset2d,
  f_o_dataset2d__insert,
  f_dataset2d__delete,
  f_a_o_vec2d,
  f_vec2d__insert_many,
  f_vec2d__delete_ids,
  f_vec2d__delete_all,
  f_a_o_window,
  f_o_window__upsert,
} from './db.js';
import { f_a_o_p__generate, a_s_kind } from './generate.js';
import { f_o_result__k_means } from './k_means.js';

let f_o_msg = function (s_type, v_data) {
  return { s_type, v_data, n_ts_ms: Date.now() };
};

// full snapshot of everything the client needs to render the app.
let f_o_state = function (o_db) {
  let a_o_dataset2d = f_a_o_dataset2d(o_db).map((o_dataset2d) => {
    return { ...o_dataset2d, a_o_vec2d: f_a_o_vec2d(o_db, o_dataset2d.n_id) };
  });
  return {
    a_o_dataset2d,
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

  // run 2D k-means on a dataset server-side and reply with the whole animation
  // (points snapshot + per-iteration frames). the result is transient — it goes
  // only to the requesting socket and is never stored in the shared state.
  k_means_run: function (o_db, v_data, o_ctx) {
    let a_o_vec2d = f_a_o_vec2d(o_db, v_data.n_id);
    let a_o_p = a_o_vec2d.map((o_vec2d) => ({ n_x: o_vec2d.n_x, n_y: o_vec2d.n_y }));
    let o_result = f_o_result__k_means(a_o_p, v_data.n_clusters ?? 3);
    o_ctx.f_reply('k_means_result', {
      n_o_dataset2d_n_id: v_data.n_id,
      n_clusters: o_result.k,
      a_o_p,
      a_o_frame: o_result.a_o_frame,
      n_it: o_result.n_it,
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
