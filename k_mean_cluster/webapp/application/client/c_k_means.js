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
    let s_key__selected = ref(null); // 'd:<id>' for a 2d dataset, 's:<id>' for a shape set
    let n_clusters = ref(3);

    // run options (all default to a single, plain k-means run)
    let b_keep_best = ref(false); // keep the lowest-inertia run out of n_retries
    let n_retries = ref(10);
    let b_kpp = ref(false); // spread initial centroids out (k-means++)
    let n_speed = ref(2); // frames per second
    let b_playing = ref(false);
    let b_loop = ref(false);
    let n_idx__frame = ref(0);
    let o_result = ref(null); // { a_o_p, a_o_run, n_idx__best, ... }
    let n_idx__run = ref(0); // which of the runs is currently displayed
    let b_running = ref(false);

    // one combined source list: 2d point datasets and shape sets. a shape set's
    // samples are clustered as flattened n-d vectors, so it runs a different handler.
    let a_o_source = computed(() => {
      let a_o = [];
      for (let o of o_store.o_state.a_o_dataset2d) {
        a_o.push({
          s_key: 'd:' + o.n_id,
          s_kind: 'dataset2d',
          n_id: o.n_id,
          s_label: '2d #' + o.n_id + ' · ' + o.s_name + ' (' + o.a_o_vec2d.length + ')',
          n_cnt: o.a_o_vec2d.length,
        });
      }
      for (let o of o_store.o_state.a_o_shape_set) {
        a_o.push({
          s_key: 's:' + o.n_id,
          s_kind: 'shape_set',
          n_id: o.n_id,
          s_label: 'set #' + o.n_id + ' · ' + o.s_name + ' (' + o.n_cnt__sample + '×' + o.n_dim + 'd)',
          n_cnt: o.n_cnt__sample,
        });
      }
      return a_o;
    });

    let o_source__selected = computed(() => {
      return a_o_source.value.find((o) => o.s_key == s_key__selected.value) || null;
    });

    // keep a valid source selected as datasets / sets come and go
    watch(
      a_o_source,
      (a_o) => {
        if (!a_o.find((o) => o.s_key == s_key__selected.value)) {
          s_key__selected.value = a_o.length ? a_o[0].s_key : null;
        }
      },
      { immediate: true }
    );

    // every run's frames + inertia; the displayed run is n_idx__run (defaults to
    // the lowest-inertia one, but the user can click any run's inertia to load it).
    let a_o_run = computed(() => (o_result.value ? o_result.value.a_o_run || [] : []));
    let o_run__cur = computed(() => a_o_run.value[n_idx__run.value] || null);
    let a_o_frame = computed(() => (o_run__cur.value ? o_run__cur.value.a_o_frame : []));
    let o_frame__cur = computed(() => a_o_frame.value[n_idx__frame.value] || null);

    // load a specific run into the animation view (reset to its first frame)
    let f_run__select = function (n_idx) {
      n_idx__run.value = n_idx;
      n_idx__frame.value = 0;
      b_playing.value = a_o_frame.value.length > 1;
    };

    // pick up the server's reply for the dataset we asked to run
    watch(
      () => o_store.o_k_means_result,
      (o_res) => {
        if (!o_res) return;
        o_result.value = o_res;
        n_idx__run.value = o_res.n_idx__best ?? 0; // show the best run first
        n_idx__frame.value = 0;
        b_running.value = false;
        b_playing.value = a_o_frame.value.length > 1;
      }
    );

    let f_run = function () {
      let o_source = o_source__selected.value;
      if (!o_source) return;
      b_running.value = true;
      o_result.value = null;
      let s_type = o_source.s_kind == 'shape_set' ? 'k_means_shapes_run' : 'k_means_run';
      f_send(s_type, {
        n_id: o_source.n_id,
        n_clusters: n_clusters.value,
        n_retries: b_keep_best.value ? Math.max(1, n_retries.value) : 1,
        b_kpp: b_kpp.value,
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

    let n_cnt__source = computed(() => (o_source__selected.value ? o_source__selected.value.n_cnt : 0));
    let b_shape_set = computed(() => o_source__selected.value?.s_kind == 'shape_set');

    // ---- grouped-shape view: once k-means on a high-dim shape set has finished,
    // redraw the original shapes colored by the cluster it assigned them to. only
    // meaningful when the vectors can't be looked at directly (more than 2/3 dims).
    let n_cap__group = 500;
    let a_n_assign__final = computed(() => {
      let a_o = a_o_frame.value;
      return a_o.length ? a_o[a_o.length - 1].a_n_assign : [];
    });
    let b_grouped_ready = computed(() => {
      let o_res = o_result.value;
      return !!(o_res && o_res.a_o_sample && o_res.n_dim > 3 && !b_running.value);
    });
    // samples paired with their final cluster, sorted so a cluster's shapes cluster together
    let a_o_group = computed(() => {
      let o_res = o_result.value;
      if (!o_res || !o_res.a_o_sample) return [];
      let a_n = a_n_assign__final.value;
      let a_o = o_res.a_o_sample.map((o_sample, n_idx) => {
        return { o_sample, n_cluster: a_n[n_idx] ?? 0, n_idx };
      });
      a_o.sort((o_a, o_b) => o_a.n_cluster - o_b.n_cluster);
      return a_o.slice(0, n_cap__group);
    });
    let f_s_points__sample = function (o_sample) {
      return o_sample.a_o_p.map((o_p) => o_p.n_x + ',' + o_p.n_y).join(' ');
    };

    return {
      o_canvas__ref,
      s_key__selected,
      n_clusters,
      b_keep_best,
      n_retries,
      b_kpp,
      n_speed,
      b_playing,
      b_loop,
      b_running,
      n_idx__frame,
      n_idx__run,
      a_o_source,
      o_source__selected,
      a_o_run,
      o_run__cur,
      a_o_frame,
      o_frame__cur,
      n_cnt__source,
      b_shape_set,
      o_result,
      b_grouped_ready,
      a_o_group,
      n_cap__group,
      f_s_color,
      f_s_points__sample,
      f_run,
      f_run__select,
      f_toggle_play,
      f_step,
    };
  },
  template: `
    <div>
      <div class="o_row">
        <select v-model="s_key__selected">
          <option v-for="o in a_o_source" :key="o.s_key" :value="o.s_key">{{ o.s_label }}</option>
          <option v-if="!a_o_source.length" :value="null" disabled>no dataset yet</option>
        </select>
        <div class="o_slider" style="max-width:160px">
          <label>k (clusters) <span>{{ n_clusters }}</span></label>
          <input type="range" min="1" max="10" step="1" v-model.number="n_clusters" />
        </div>
        <button
          class="b_active"
          @click="f_run"
          :disabled="!o_source__selected || n_cnt__source < 1 || b_running"
        >{{ b_running ? 'running…' : '▶ run k-means' }}</button>
      </div>
      <div class="s_hint" v-if="b_shape_set" style="margin-top:0">
        shape set: each shape is clustered as an n-d vector, then projected to 2d via PCA for display
      </div>

      <div class="o_row">
        <label style="display:flex;align-items:center;gap:4px" title="run k-means several times and keep the tightest (lowest-inertia) result">
          <input type="checkbox" v-model="b_keep_best" /> keep lowest inertia
        </label>
        <label v-if="b_keep_best" style="display:flex;align-items:center;gap:4px">
          retries <input type="number" min="1" max="200" step="1" v-model.number="n_retries" style="width:60px" />
        </label>
        <label style="display:flex;align-items:center;gap:4px" title="seed the initial centroids spread apart instead of purely random">
          <input type="checkbox" v-model="b_kpp" /> spread initial centroids (k-means++)
        </label>
      </div>
      <div class="o_runs" v-if="a_o_run.length">
        <span class="s_hint" style="margin:0">
          {{ a_o_run.length > 1 ? a_o_run.length + ' runs — click an inertia to load that run:' : 'inertia (lower = tighter clusters):' }}
        </span>
        <a
          v-for="(o_run, n_idx) in a_o_run"
          :key="n_idx"
          class="b_inertia"
          :class="{ b_sel: n_idx == n_idx__run, b_best: n_idx == o_result.n_idx__best }"
          @click="f_run__select(n_idx)"
          :title="'run ' + (n_idx + 1) + (n_idx == o_result.n_idx__best ? ' (best)' : '')"
        >{{ o_run.n_inertia.toFixed(4) }}<span v-if="n_idx == o_result.n_idx__best"> ★</span></a>
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
        <span class="s_hint" style="min-width:260px;text-align:right">
          <template v-if="a_o_run.length > 1">run {{ n_idx__run + 1 }}/{{ a_o_run.length }} · </template>
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

      <div v-if="b_grouped_ready" style="margin-top:10px">
        <div class="s_section">shapes grouped by k-means cluster ({{ o_result.n_dim }}d)</div>
        <div class="s_hint" style="margin-top:2px">
          the original shapes, recolored by the cluster k-means assigned them to
        </div>
        <div class="o_grid_viz" style="margin-top:6px">
          <svg
            v-for="o in a_o_group"
            :key="o.n_idx"
            class="o_svg_viz"
            viewBox="0 0 1 1"
            preserveAspectRatio="xMidYMid meet"
          >
            <polygon
              :points="f_s_points__sample(o.o_sample)"
              :style="{ stroke: f_s_color(o.n_cluster) }"
              class="o_outline_viz"
            />
            <circle
              v-for="(o_p, n_i) in o.o_sample.a_o_p"
              :key="n_i"
              :cx="o_p.n_x"
              :cy="o_p.n_y"
              r="0.03"
              :style="{ fill: f_s_color(o.n_cluster) }"
            />
          </svg>
        </div>
        <div class="s_hint" v-if="o_result.a_o_sample.length > n_cap__group">
          showing first {{ n_cap__group }} of {{ o_result.a_o_sample.length }} shapes
        </div>
      </div>
    </div>
  `,
};

export { c_k_means };
