// Copyright (C) 2026 Jonas Immanuel Frey - Licensed under MIT. See LICENSE file for details

import { reactive } from './vendor/vue.esm-browser.prod.js';

// shared reactive store: the whole app renders from o_store.o_state, which the
// server owns and pushes over the websocket. the client never mutates state
// locally — it sends a message and re-renders when the new snapshot arrives.
let o_store = reactive({
  b_connected: false,
  o_state: {
    a_o_dataset2d: [],
    a_o_shape_set: [],
    a_o_window: [],
    a_s_kind: [],
  },
  // transient, per-client k-means animation result (not part of shared state)
  o_k_means_result: null,
  // transient, per-client shape-set samples fetched for visualization
  o_shape_set_samples: null,
});

let o_socket = null;

let f_send = function (s_type, v_data) {
  if (!o_socket || o_socket.readyState != WebSocket.OPEN) return;
  o_socket.send(JSON.stringify({ s_type, v_data, n_ts_ms: Date.now() }));
};

let f_connect = function () {
  let s_proto = location.protocol == 'https:' ? 'wss' : 'ws';
  o_socket = new WebSocket(`${s_proto}://${location.host}/ws`);

  o_socket.addEventListener('open', () => {
    o_store.b_connected = true;
    f_send('state_request', {});
  });
  o_socket.addEventListener('message', (o_evt) => {
    let o_msg = JSON.parse(o_evt.data);
    if (o_msg.s_type == 'state') o_store.o_state = o_msg.v_data;
    if (o_msg.s_type == 'k_means_result') {
      o_store.o_k_means_result = { ...o_msg.v_data, n_ts_ms: o_msg.n_ts_ms };
    }
    if (o_msg.s_type == 'shape_set_samples') {
      o_store.o_shape_set_samples = { ...o_msg.v_data, n_ts_ms: o_msg.n_ts_ms };
    }
  });
  o_socket.addEventListener('close', () => {
    o_store.b_connected = false;
    setTimeout(f_connect, 1000);
  });
  o_socket.addEventListener('error', () => o_socket.close());
};

export { o_store, f_send, f_connect };
