// Copyright (C) 2026 Jonas Immanuel Frey - Licensed under MIT. See LICENSE file for details

import { createApp, computed } from './vendor/vue.esm-browser.prod.js';
import { o_store, f_send, f_connect } from './ws.js';
import { c_window } from './c_window.js';
import { c_dataset2d } from './c_dataset2d.js';
import { c_k_means } from './c_k_means.js';

// registry of togglable windows. add a new window by registering its s_type,
// title, and the component rendered inside it — the topbar + windowing come free.
let a_o_window_def = [
  { s_type: 'dataset2d', s_title: 'dataset2d', c: 'c_dataset2d' },
  { s_type: 'k_means', s_title: 'k_means', c: 'c_k_means' },
];

let c_app = {
  components: { c_window, c_dataset2d, c_k_means },
  setup() {
    let f_o_window = function (s_type) {
      return o_store.o_state.a_o_window.find((o) => o.s_type == s_type) || null;
    };

    let f_b_open = function (s_type) {
      let o = f_o_window(s_type);
      return !!(o && o.b_open);
    };

    // toggle open/closed; a fresh window gets a sensible default geometry.
    let f_toggle = function (s_type) {
      let o = f_o_window(s_type);
      if (o && o.b_open) {
        f_send('window_upsert', { ...o, b_open: 0 });
      } else if (o) {
        f_send('window_upsert', { ...o, b_open: 1, n_z: Date.now() % 1000000 });
      } else {
        f_send('window_upsert', {
          s_type,
          b_open: 1,
          n_pos_x: 80,
          n_pos_y: 80,
          n_scl_x: 720,
          n_scl_y: 560,
          n_z: Date.now() % 1000000,
        });
      }
    };

    let f_close = function (s_type) {
      let o = f_o_window(s_type);
      if (o) f_send('window_upsert', { ...o, b_open: 0 });
    };

    let b_connected = computed(() => o_store.b_connected);

    return { a_o_window_def, f_o_window, f_b_open, f_toggle, f_close, b_connected };
  },
  template: `
    <div class="o_topbar">
      <span class="s_title">machine_learning</span>
      <button
        v-for="o_def in a_o_window_def"
        :key="o_def.s_type"
        :class="{ b_active: f_b_open(o_def.s_type) }"
        @click="f_toggle(o_def.s_type)"
      >{{ o_def.s_title }}</button>
      <span class="b_conn" :class="{ b_on: b_connected }">
        {{ b_connected ? '● connected' : '○ offline' }}
      </span>
    </div>

    <template v-for="o_def in a_o_window_def" :key="o_def.s_type">
      <c_window
        v-if="f_b_open(o_def.s_type)"
        :o_window="f_o_window(o_def.s_type)"
        :s_title="o_def.s_title"
        @close="f_close(o_def.s_type)"
      >
        <component :is="o_def.c"></component>
      </c_window>
    </template>
  `,
};

f_connect();
createApp(c_app).mount('#o_app');
