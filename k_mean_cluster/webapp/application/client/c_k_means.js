// Copyright (C) 2026 Jonas Immanuel Frey - Licensed under MIT. See LICENSE file for details

import { ref, computed, watch, onMounted, onUnmounted } from './vendor/vue.esm-browser.prod.js';
import { o_store, f_send } from './ws.js';

// distinct-ish hue per cluster; -1 (unassigned) renders grey.
let a_s_color = [
  '#4a9eff', '#ff6b6b', '#51d88a', '#ffd166', '#c792ea',
  '#4dd0e1', '#ff9f43', '#a3e635', '#f472b6', '#38bdf8',
];
let f_s_color = function (n_idx) {
  return n_idx < 0 ? '#5a6272' : a_s_color[n_idx % a_s_color.length];
};

// runs 2D k-means on a chosen dataset (computed server-side) and plays back the
// resulting frames as an animation. the client only renders + times playback;
// every cluster assignment / centroid position is calculated by the server.
let c_k_means = {
  setup() {
    let o_canvas__ref = ref(null);
    let n_id__selected = ref(null);
    let n_clusters = ref(3);
    let n_speed = ref(2); // frames per second
    let b_playing = ref(false);
    let b_loop = ref(true);
    let n_idx__frame = ref(0);
    let o_result = ref(null); // { a_o_p, a_o_frame, n_it, n_o_dataset2d_n_id }
    let b_running = ref(false);

    let a_o_dataset2d = computed(() => o_store.o_state.a_o_dataset2d);

    let o_dataset2d__selected = computed(() => {
      return a_o_dataset2d.value.find((o) => o.n_id == n_id__selected.value) || null;
    });

    // keep a valid dataset selected as datasets come and go
    watch(
      a_o_dataset2d,
      (a_o) => {
        if (!a_o.find((o) => o.n_id == n_id__selected.value)) {
          n_id__selected.value = a_o.length ? a_o[0].n_id : null;
        }
      },
      { immediate: true }
    );

    let a_o_frame = computed(() => (o_result.value ? o_result.value.a_o_frame : []));
    let o_frame__cur = computed(() => a_o_frame.value[n_idx__frame.value] || null);

    // pick up the server's reply for the dataset we asked to run
    watch(
      () => o_store.o_k_means_result,
      (o_res) => {
        if (!o_res) return;
        o_result.value = o_res;
        n_idx__frame.value = 0;
        b_running.value = false;
        b_playing.value = o_res.a_o_frame.length > 1;
      }
    );

    let f_run = function () {
      if (!o_dataset2d__selected.value) return;
      b_running.value = true;
      o_result.value = null;
      f_send('k_means_run', {
        n_id: o_dataset2d__selected.value.n_id,
        n_clusters: n_clusters.value,
      });
    };

    // ---------------------------------------------------------- rendering

    let f_draw = function () {
      let o_canvas = o_canvas__ref.value;
      if (!o_canvas) return;
      let n_scl_x = o_canvas.clientWidth;
      let n_scl_y = Math.max(200, Math.round(n_scl_x * 0.66));
      if (o_canvas.width != n_scl_x || o_canvas.height != n_scl_y) {
        o_canvas.width = n_scl_x;
        o_canvas.height = n_scl_y;
      }
      let o_ctx = o_canvas.getContext('2d');
      o_ctx.clearRect(0, 0, n_scl_x, n_scl_y);

      o_ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      o_ctx.lineWidth = 1;
      for (let n_it = 1; n_it < 10; n_it += 1) {
        let n_nor = n_it / 10;
        o_ctx.beginPath();
        o_ctx.moveTo(n_nor * n_scl_x, 0);
        o_ctx.lineTo(n_nor * n_scl_x, n_scl_y);
        o_ctx.moveTo(0, n_nor * n_scl_y);
        o_ctx.lineTo(n_scl_x, n_nor * n_scl_y);
        o_ctx.stroke();
      }

      let o_res = o_result.value;
      let o_frame = o_frame__cur.value;
      if (!o_res || !o_frame) return;

      // datapoints colored by their assigned cluster in this frame
      for (let n_idx = 0; n_idx < o_res.a_o_p.length; n_idx += 1) {
        let o_p = o_res.a_o_p[n_idx];
        o_ctx.fillStyle = f_s_color(o_frame.a_n_assign[n_idx]);
        o_ctx.beginPath();
        o_ctx.arc(o_p.n_x * n_scl_x, o_p.n_y * n_scl_y, 3, 0, Math.PI * 2);
        o_ctx.fill();
      }

      // centroids as larger ringed markers with a cross
      for (let n_idx = 0; n_idx < o_frame.a_o_centroid.length; n_idx += 1) {
        let o_c = o_frame.a_o_centroid[n_idx];
        let n_x = o_c.n_x * n_scl_x;
        let n_y = o_c.n_y * n_scl_y;
        o_ctx.fillStyle = f_s_color(n_idx);
        o_ctx.strokeStyle = '#ffffff';
        o_ctx.lineWidth = 2;
        o_ctx.beginPath();
        o_ctx.arc(n_x, n_y, 8, 0, Math.PI * 2);
        o_ctx.fill();
        o_ctx.stroke();
        o_ctx.beginPath();
        o_ctx.moveTo(n_x - 4, n_y);
        o_ctx.lineTo(n_x + 4, n_y);
        o_ctx.moveTo(n_x, n_y - 4);
        o_ctx.lineTo(n_x, n_y + 4);
        o_ctx.stroke();
      }
    };

    // ---------------------------------------------------------- playback loop

    let n_id__raf = null;
    let n_ms__last = 0;
    let f_tick = function (n_ms) {
      if (b_playing.value && a_o_frame.value.length > 1) {
        let n_ms__per_frame = 1000 / Math.max(0.25, n_speed.value);
        if (n_ms - n_ms__last >= n_ms__per_frame) {
          n_ms__last = n_ms;
          let n_next = n_idx__frame.value + 1;
          if (n_next >= a_o_frame.value.length) {
            if (b_loop.value) {
              n_next = 0;
            } else {
              n_next = a_o_frame.value.length - 1;
              b_playing.value = false;
            }
          }
          n_idx__frame.value = n_next;
        }
      }
      f_draw();
      n_id__raf = requestAnimationFrame(f_tick);
    };
    onMounted(() => {
      n_id__raf = requestAnimationFrame(f_tick);
    });
    onUnmounted(() => {
      if (n_id__raf) cancelAnimationFrame(n_id__raf);
    });

    let f_toggle_play = function () {
      b_playing.value = !b_playing.value;
    };
    let f_step = function (n_dir) {
      b_playing.value = false;
      let n_len = a_o_frame.value.length;
      if (!n_len) return;
      n_idx__frame.value = (n_idx__frame.value + n_dir + n_len) % n_len;
    };

    let n_cnt__vec2d = computed(() => {
      return o_dataset2d__selected.value ? o_dataset2d__selected.value.a_o_vec2d.length : 0;
    });

    return {
      o_canvas__ref,
      n_id__selected,
      n_clusters,
      n_speed,
      b_playing,
      b_loop,
      b_running,
      n_idx__frame,
      a_o_dataset2d,
      o_dataset2d__selected,
      a_o_frame,
      o_frame__cur,
      n_cnt__vec2d,
      f_run,
      f_toggle_play,
      f_step,
    };
  },
  template: `
    <div>
      <div class="o_row">
        <select v-model="n_id__selected">
          <option v-for="o in a_o_dataset2d" :key="o.n_id" :value="o.n_id">
            #{{ o.n_id }} · {{ o.s_name }} ({{ o.a_o_vec2d.length }})
          </option>
          <option v-if="!a_o_dataset2d.length" :value="null" disabled>no dataset yet</option>
        </select>
        <div class="o_slider" style="max-width:160px">
          <label>k (clusters) <span>{{ n_clusters }}</span></label>
          <input type="range" min="1" max="10" step="1" v-model.number="n_clusters" />
        </div>
        <button
          class="b_active"
          @click="f_run"
          :disabled="!o_dataset2d__selected || n_cnt__vec2d < 1 || b_running"
        >{{ b_running ? 'running…' : '▶ run k-means' }}</button>
      </div>

      <div class="o_row" v-if="a_o_frame.length">
        <button @click="f_step(-1)">⏮</button>
        <button @click="f_toggle_play">{{ b_playing ? '⏸ pause' : '▶ play' }}</button>
        <button @click="f_step(1)">⏭</button>
        <label style="display:flex;align-items:center;gap:4px">
          <input type="checkbox" v-model="b_loop" /> loop
        </label>
        <div class="o_slider" style="max-width:160px">
          <label>speed <span>{{ n_speed }} fps</span></label>
          <input type="range" min="0.5" max="12" step="0.5" v-model.number="n_speed" />
        </div>
      </div>

      <div class="o_row" v-if="a_o_frame.length">
        <input
          type="range"
          min="0"
          :max="a_o_frame.length - 1"
          step="1"
          v-model.number="n_idx__frame"
          style="flex:1"
        />
        <span class="s_hint" style="min-width:210px;text-align:right">
          frame {{ n_idx__frame + 1 }}/{{ a_o_frame.length }} ·
          it {{ o_frame__cur ? o_frame__cur.n_it : 0 }} ·
          {{ o_frame__cur ? o_frame__cur.s_caption : '' }}
        </span>
      </div>

      <div class="o_canvas_wrap">
        <canvas ref="o_canvas__ref"></canvas>
      </div>
      <div class="s_hint">
        pick a dataset and a cluster count k, then run. the animation replays the
        assign → recalculate-mean steps until the centroids converge.
      </div>
    </div>
  `,
};

export { c_k_means };
