// Copyright (C) 2026 Jonas Immanuel Frey - Licensed under MIT. See LICENSE file for details

import { ref, computed, watch } from './vendor/vue.esm-browser.prod.js';
import { o_store, f_send } from './ws.js';

// the dataset_shapes editor: define a set of base shapes, each an ordered list of
// vertices the user draws by clicking (drag to move, clear to reset). the vertices
// are connected into a closed outline that gets sampled into n points; from those
// an augmented, labeled dataset (noisy / rotated / translated copies per shape) is
// produced and downloaded as json. everything lives in normalized [0..1] space.

let n_tau = Math.PI * 2;
let n_radius__shape = 0.38; // outline radius inside the unit square (centered at 0.5)
let n_id__seq = 0; // module-local id source for shape rows

// one distinct color per label, used in the set visualization + legend.
let a_s_color = [
  '#4a9eff', '#ff6b6b', '#51d88a', '#ffd166', '#c792ea',
  '#4dd0e1', '#ff9f43', '#a3e635', '#f472b6', '#38bdf8',
];

let f_n_clamp01 = function (n) {
  return Math.max(0, Math.min(1, n));
};

// full-range box-muller standard normal (sd = 1), scaled by the caller's noise.
let f_n_gauss = function () {
  let n_u1 = Math.random() || 1e-9;
  let n_u2 = Math.random();
  return Math.sqrt(-2 * Math.log(n_u1)) * Math.cos(n_tau * n_u2);
};

// ---------------------------------------------------------------- shape rows

// a shape owns its vertices directly, so the user can freely edit them.
let f_o_shape = function (s_name, a_o_p_vertex) {
  return { s_id: ++n_id__seq, s_name, a_o_p_vertex };
};

// vertices of a regular n-gon on the shape radius, rotated so it looks upright.
let f_a_o_p_vertex__polygon = function (n_corner, n_rot_off) {
  let a_o_p_vertex = [];
  for (let n_it = 0; n_it < n_corner; n_it += 1) {
    let n_it_nor = n_it / n_corner;
    let n_ang = n_it_nor * n_tau + n_rot_off;
    a_o_p_vertex.push({
      n_x: 0.5 + Math.cos(n_ang) * n_radius__shape,
      n_y: 0.5 + Math.sin(n_ang) * n_radius__shape,
    });
  }
  return a_o_p_vertex;
};

// vertices of an n-pointed star (alternating outer / inner radius).
let f_a_o_p_vertex__star = function (n_point) {
  let a_o_p_vertex = [];
  let n_its = n_point * 2;
  for (let n_it = 0; n_it < n_its; n_it += 1) {
    let n_it_nor = n_it / n_its;
    let n_r = n_it % 2 == 0 ? n_radius__shape : n_radius__shape * 0.42;
    let n_ang = n_it_nor * n_tau - Math.PI / 2;
    a_o_p_vertex.push({
      n_x: 0.5 + Math.cos(n_ang) * n_r,
      n_y: 0.5 + Math.sin(n_ang) * n_r,
    });
  }
  return a_o_p_vertex;
};

// ---------------------------------------------------------------- sampling

// place n_its_point points evenly (by arc length) along the closed outline.
let f_a_o_p__sample_outline = function (a_o_p_vertex, n_its_point) {
  let n_its_edge = a_o_p_vertex.length;
  if (n_its_edge < 2) return a_o_p_vertex.map((o_p) => ({ n_x: o_p.n_x, n_y: o_p.n_y }));

  let a_n_len = [];
  let n_len__total = 0;
  for (let n_it = 0; n_it < n_its_edge; n_it += 1) {
    let o_p__a = a_o_p_vertex[n_it];
    let o_p__b = a_o_p_vertex[(n_it + 1) % n_its_edge];
    let n_len = Math.hypot(o_p__b.n_x - o_p__a.n_x, o_p__b.n_y - o_p__a.n_y);
    a_n_len.push(n_len);
    n_len__total += n_len;
  }
  if (n_len__total == 0) return a_o_p_vertex.map((o_p) => ({ n_x: o_p.n_x, n_y: o_p.n_y }));

  let a_o_p = [];
  for (let n_it = 0; n_it < n_its_point; n_it += 1) {
    let n_dist = (n_it / n_its_point) * n_len__total;
    let n_acc = 0;
    for (let n_it_edge = 0; n_it_edge < n_its_edge; n_it_edge += 1) {
      let b_last = n_it_edge == n_its_edge - 1;
      if (n_acc + a_n_len[n_it_edge] >= n_dist || b_last) {
        let n_nor_edge = a_n_len[n_it_edge] ? (n_dist - n_acc) / a_n_len[n_it_edge] : 0;
        let o_p__a = a_o_p_vertex[n_it_edge];
        let o_p__b = a_o_p_vertex[(n_it_edge + 1) % n_its_edge];
        a_o_p.push({
          n_x: o_p__a.n_x + (o_p__b.n_x - o_p__a.n_x) * n_nor_edge,
          n_y: o_p__a.n_y + (o_p__b.n_y - o_p__a.n_y) * n_nor_edge,
        });
        break;
      }
      n_acc += a_n_len[n_it_edge];
    }
  }
  return a_o_p;
};

// one augmented copy: random rotation + scale + translation about the center, then
// per-point gaussian jitter. this deliberately varies the pose — the server
// normalizes every shape vector to a canonical pose before k-means, so clustering
// still groups by shape, not by pose. transforms are bounded to stay roughly in
// frame (avoids edge clamping that would distort the shape).
let f_a_o_p__augment = function (a_o_p, n_noise) {
  let n_rot = Math.random() * n_tau;
  let n_cos = Math.cos(n_rot);
  let n_sin = Math.sin(n_rot);
  let n_scl = 0.6 + Math.random() * 0.4; // 0.6 .. 1.0
  let n_trn_x = (Math.random() - 0.5) * 0.2;
  let n_trn_y = (Math.random() - 0.5) * 0.2;
  return a_o_p.map((o_p) => {
    let n_dx = (o_p.n_x - 0.5) * n_scl;
    let n_dy = (o_p.n_y - 0.5) * n_scl;
    let n_rx = n_dx * n_cos - n_dy * n_sin;
    let n_ry = n_dx * n_sin + n_dy * n_cos;
    return {
      n_x: f_n_clamp01(0.5 + n_rx + n_trn_x + f_n_gauss() * n_noise),
      n_y: f_n_clamp01(0.5 + n_ry + n_trn_y + f_n_gauss() * n_noise),
    };
  });
};

// ---------------------------------------------------------------- component

let c_dataset_shapes = {
  setup() {
    // the fixed number of points every shape consists of. a shape IS exactly this
    // many points (no outline resampling at generation) and the editor caps you at
    // this count. changing it re-points all shapes so they stay consistent.
    let n_its_point = ref(10);
    let a_o_shape = ref([
      f_o_shape('star', f_a_o_p__sample_outline(f_a_o_p_vertex__star(5), n_its_point.value)),
      f_o_shape('rect', f_a_o_p__sample_outline(f_a_o_p_vertex__polygon(4, -Math.PI / 4), n_its_point.value)),
      f_o_shape('triangle', f_a_o_p__sample_outline(f_a_o_p_vertex__polygon(3, -Math.PI / 2), n_its_point.value)),
    ]);

    // augmentation params (the lower section of the list sketch)
    let n_per_shape = ref(100);
    let n_noise__min = ref(0.01);
    let n_noise__max = ref(0.1);
    let s_name = ref('set_1');

    // which shape (if any) is open in the single-shape editor
    let s_id__edit = ref(null);
    let o_svg__edit__ref = ref(null);
    let o_shape__edit = computed(() => {
      return a_o_shape.value.find((o_shape) => o_shape.s_id == s_id__edit.value) || null;
    });

    // ---- shape row actions
    let f_shape_add = function () {
      // start from an empty shape and drop the user straight into the editor.
      let o_shape = f_o_shape('shape_' + (a_o_shape.value.length + 1), []);
      a_o_shape.value.push(o_shape);
      s_id__edit.value = o_shape.s_id;
    };
    let f_shape_remove = function (s_id) {
      a_o_shape.value = a_o_shape.value.filter((o_shape) => o_shape.s_id != s_id);
      if (s_id__edit.value == s_id) s_id__edit.value = null;
    };
    let f_edit_open = function (s_id) {
      s_id__edit.value = s_id;
    };
    let f_edit_close = function () {
      s_id__edit.value = null;
    };

    // ---- editor: pointer → normalized, add / drag / clear vertices
    let f_o_p__from_event = function (o_evt) {
      let o_rect = o_svg__edit__ref.value.getBoundingClientRect();
      return {
        n_x: f_n_clamp01((o_evt.clientX - o_rect.left) / o_rect.width),
        n_y: f_n_clamp01((o_evt.clientY - o_rect.top) / o_rect.height),
      };
    };

    // pointerdown on empty canvas → append a new point, but only up to the fixed
    // point count; once the shape is full, clicks do nothing.
    let f_svg_pointerdown = function (o_evt) {
      if (o_evt.target.tagName == 'circle') return; // vertex drag handles its own
      if (!o_shape__edit.value) return;
      if (o_shape__edit.value.a_o_p_vertex.length >= n_its_point.value) return; // shape full
      o_shape__edit.value.a_o_p_vertex.push(f_o_p__from_event(o_evt));
    };

    // pointerdown on a vertex → drag it until pointerup.
    let f_vertex_drag = function (o_evt, o_p) {
      o_evt.stopPropagation();
      o_evt.preventDefault();
      let f_move = function (o_evt__move) {
        let o = f_o_p__from_event(o_evt__move);
        o_p.n_x = o.n_x;
        o_p.n_y = o.n_y;
      };
      let f_up = function () {
        globalThis.removeEventListener('pointermove', f_move);
        globalThis.removeEventListener('pointerup', f_up);
      };
      globalThis.addEventListener('pointermove', f_move);
      globalThis.addEventListener('pointerup', f_up);
    };

    let f_points_clear = function () {
      if (o_shape__edit.value) o_shape__edit.value.a_o_p_vertex = [];
    };

    // ---- preview / outline helpers (viewBox is the unit square → coords map 1:1)
    // the placed points ARE the shape's data points, so preview == the vertices.
    let f_s_outline = function (o_shape) {
      return o_shape.a_o_p_vertex.map((o_p) => o_p.n_x + ',' + o_p.n_y).join(' ');
    };

    // a shape is "complete" once it holds exactly the fixed number of points.
    let f_b_complete = function (o_shape) {
      return o_shape.a_o_p_vertex.length == n_its_point.value;
    };
    let a_o_shape__complete = computed(() => a_o_shape.value.filter(f_b_complete));

    // editor point-count state
    let n_cnt__vertex__edit = computed(() => {
      return o_shape__edit.value ? o_shape__edit.value.a_o_p_vertex.length : 0;
    });
    let b_full__edit = computed(() => n_cnt__vertex__edit.value >= n_its_point.value);

    // changing the fixed point count re-points every shape so they all stay at the
    // new count: fully-defined shapes are redistributed along their outline; any
    // shape now over the cap is trimmed. shapes still being drawn are left alone.
    watch(n_its_point, (n_new_raw, n_old) => {
      let n_new = Math.round(n_new_raw);
      if (!Number.isFinite(n_new) || n_new < 2) return;
      for (let o_shape of a_o_shape.value) {
        let n_len = o_shape.a_o_p_vertex.length;
        if (n_len == n_old && n_len >= 2) {
          o_shape.a_o_p_vertex = f_a_o_p__sample_outline(o_shape.a_o_p_vertex, n_new);
        } else if (n_len > n_new) {
          o_shape.a_o_p_vertex = o_shape.a_o_p_vertex.slice(0, n_new);
        }
      }
    });

    let n_cnt__sample = computed(() => a_o_shape__complete.value.length * n_per_shape.value);

    // the set currently being edited (loaded from storage); null = a fresh set.
    let n_id__loaded = ref(null);

    // ---- build the augmented samples + recipe and store / update the set
    let f_generate = function () {
      if (!a_o_shape.value.length) return;
      let n_noise__lo = Math.min(n_noise__min.value, n_noise__max.value);
      let n_noise__hi = Math.max(n_noise__min.value, n_noise__max.value);
      let a_o_sample = [];
      let a_o_shape__recipe = [];
      for (let o_shape of a_o_shape.value) {
        if (!f_b_complete(o_shape)) continue; // only shapes with the full point count
        // the editable definition, stored so the set can be loaded + edited again
        a_o_shape__recipe.push({
          s_name: o_shape.s_name,
          a_o_p_vertex: o_shape.a_o_p_vertex.map((o_p) => ({ n_x: o_p.n_x, n_y: o_p.n_y })),
        });
        // the placed points ARE the base sample — no outline resampling
        for (let n_it = 0; n_it < n_per_shape.value; n_it += 1) {
          let n_noise = n_noise__lo + Math.random() * (n_noise__hi - n_noise__lo);
          a_o_sample.push({
            s_label: o_shape.s_name,
            a_o_p: f_a_o_p__augment(o_shape.a_o_p_vertex, n_noise),
          });
        }
      }
      let o_payload = {
        s_name: s_name.value || 'set',
        n_its_point: n_its_point.value,
        n_per_shape: n_per_shape.value,
        n_noise__min: n_noise__lo,
        n_noise__max: n_noise__hi,
        a_s_label: a_o_shape__recipe.map((o_shape) => o_shape.s_name),
        a_o_shape: a_o_shape__recipe,
        a_o_sample,
      };
      // re-generate the loaded set in place, or create a new one
      if (n_id__loaded.value != null) {
        f_send('shape_set_update', { n_id: n_id__loaded.value, ...o_payload });
      } else {
        f_send('shape_set_create', o_payload);
      }
    };

    // ---- stored sets + visualization
    let a_o_shape_set = computed(() => o_store.o_state.a_o_shape_set);
    let s_id__viz = ref(null);
    let o_shape_set__viz = computed(() => {
      return a_o_shape_set.value.find((o_shape_set) => o_shape_set.n_id == s_id__viz.value) || null;
    });

    let f_set_delete = function (n_id) {
      f_send('shape_set_delete', { n_id });
      if (s_id__viz.value == n_id) s_id__viz.value = null;
      if (n_id__loaded.value == n_id) n_id__loaded.value = null;
    };

    // load a stored set's recipe back into the editor so its shapes can be edited
    // again; a subsequent generate re-generates that same set in place.
    let f_set_load = function (o_shape_set) {
      s_id__viz.value = null;
      s_id__edit.value = null;
      n_id__loaded.value = o_shape_set.n_id;
      s_name.value = o_shape_set.s_name;
      n_its_point.value = o_shape_set.n_its_point;
      n_per_shape.value = o_shape_set.n_per_shape;
      n_noise__min.value = o_shape_set.n_noise__min;
      n_noise__max.value = o_shape_set.n_noise__max;
      a_o_shape.value = (o_shape_set.a_o_shape || []).map((o_shape) => {
        return f_o_shape(
          o_shape.s_name,
          (o_shape.a_o_p_vertex || []).map((o_p) => ({ n_x: o_p.n_x, n_y: o_p.n_y }))
        );
      });
    };
    // detach from the loaded set so the next generate makes a brand-new set
    let f_loaded_clear = function () {
      n_id__loaded.value = null;
    };
    let o_shape_set__loaded = computed(() => {
      return a_o_shape_set.value.find((o) => o.n_id == n_id__loaded.value) || null;
    });
    let f_viz_open = function (n_id) {
      s_id__viz.value = n_id;
      f_send('shape_set_samples_request', { n_id }); // reply lands in o_shape_set_samples
    };
    let f_viz_close = function () {
      s_id__viz.value = null;
    };

    // the fetched samples for the set currently being visualized (or null while loading)
    let a_o_sample__viz = computed(() => {
      let o = o_store.o_shape_set_samples;
      if (!o || o.n_id != s_id__viz.value) return null;
      return o.a_o_sample;
    });
    // cap how many mini-previews we draw so huge sets stay responsive
    let n_cap__viz = 500;
    let a_o_sample__viz_shown = computed(() => {
      return a_o_sample__viz.value ? a_o_sample__viz.value.slice(0, n_cap__viz) : [];
    });

    let f_s_color__label = function (s_label) {
      let a_s = o_shape_set__viz.value ? o_shape_set__viz.value.a_s_label : [];
      let n_idx = a_s.indexOf(s_label);
      return a_s_color[(n_idx < 0 ? 0 : n_idx) % a_s_color.length];
    };
    let f_s_points__sample = function (o_sample) {
      return o_sample.a_o_p.map((o_p) => o_p.n_x + ',' + o_p.n_y).join(' ');
    };

    // drop stale references if the set they point at disappears (e.g. deleted elsewhere)
    watch(a_o_shape_set, (a_o) => {
      if (s_id__viz.value != null && !a_o.find((o) => o.n_id == s_id__viz.value)) {
        s_id__viz.value = null;
      }
      if (n_id__loaded.value != null && !a_o.find((o) => o.n_id == n_id__loaded.value)) {
        n_id__loaded.value = null;
      }
    });

    return {
      n_its_point,
      a_o_shape,
      n_per_shape,
      n_noise__min,
      n_noise__max,
      s_name,
      s_id__edit,
      o_svg__edit__ref,
      o_shape__edit,
      n_cnt__sample,
      f_shape_add,
      f_shape_remove,
      f_edit_open,
      f_edit_close,
      f_svg_pointerdown,
      f_vertex_drag,
      f_points_clear,
      f_s_outline,
      f_b_complete,
      a_o_shape__complete,
      n_cnt__vertex__edit,
      b_full__edit,
      f_generate,
      a_o_shape_set,
      s_id__viz,
      o_shape_set__viz,
      a_o_sample__viz,
      a_o_sample__viz_shown,
      n_cap__viz,
      n_id__loaded,
      o_shape_set__loaded,
      f_set_delete,
      f_set_load,
      f_loaded_clear,
      f_viz_open,
      f_viz_close,
      f_s_color__label,
      f_s_points__sample,
    };
  },
  template: `
    <div>
      <!-- ====================================================== shape editor -->
      <div v-if="o_shape__edit" class="o_shape_edit">
        <div class="o_row">
          <input type="text" class="s_label" v-model="o_shape__edit.s_name" placeholder="custom name" style="flex:1" />
          <span class="s_hint" :class="{ b_full: b_full__edit }" style="margin:0">
            {{ n_cnt__vertex__edit }} / {{ n_its_point }} points
          </span>
          <button class="b_danger" @click="f_points_clear" title="clear points">✕ clear</button>
          <button @click="f_edit_close">done</button>
        </div>

        <svg
          ref="o_svg__edit__ref"
          class="o_svg_edit"
          :class="{ b_full: b_full__edit }"
          viewBox="0 0 1 1"
          preserveAspectRatio="xMidYMid meet"
          @pointerdown="f_svg_pointerdown"
        >
          <polygon :points="f_s_outline(o_shape__edit)" class="o_outline" />
          <circle
            v-for="(o_p, n_idx) in o_shape__edit.a_o_p_vertex"
            :key="'v' + n_idx"
            :cx="o_p.n_x"
            :cy="o_p.n_y"
            r="0.028"
            class="o_vertex"
            @pointerdown="f_vertex_drag($event, o_p)"
          />
        </svg>
        <div class="s_hint" v-if="b_full__edit">
          shape complete ({{ n_its_point }} points) · drag points to move them, or ✕ clear to redraw
        </div>
        <div class="s_hint" v-else>
          click to add points ({{ n_its_point - n_cnt__vertex__edit }} left) · drag to move · ✕ clear to restart
        </div>
      </div>

      <!-- ================================================= set visualization -->
      <div v-else-if="o_shape_set__viz" class="o_shape_viz">
        <div class="o_row">
          <button @click="f_viz_close">← back</button>
          <span class="s_section" style="margin:0">{{ o_shape_set__viz.s_name }}</span>
          <span class="s_hint" style="margin:0">
            {{ o_shape_set__viz.n_cnt__sample }} shapes · {{ o_shape_set__viz.n_dim }}d ·
            {{ o_shape_set__viz.n_its_point }} points each
          </span>
        </div>
        <div class="o_row">
          <span
            v-for="s_label in o_shape_set__viz.a_s_label"
            :key="s_label"
            class="o_legend"
          >
            <span class="o_swatch" :style="{ background: f_s_color__label(s_label) }"></span>{{ s_label }}
          </span>
        </div>
        <div v-if="!a_o_sample__viz" class="s_hint">loading samples…</div>
        <template v-else>
          <div class="o_grid_viz">
            <svg
              v-for="o_sample in a_o_sample__viz_shown"
              :key="o_sample.n_id"
              class="o_svg_viz"
              viewBox="0 0 1 1"
              preserveAspectRatio="xMidYMid meet"
            >
              <polygon
                :points="f_s_points__sample(o_sample)"
                :style="{ stroke: f_s_color__label(o_sample.s_label) }"
                class="o_outline_viz"
              />
              <circle
                v-for="(o_p, n_idx) in o_sample.a_o_p"
                :key="n_idx"
                :cx="o_p.n_x"
                :cy="o_p.n_y"
                r="0.03"
                :style="{ fill: f_s_color__label(o_sample.s_label) }"
              />
            </svg>
          </div>
          <div class="s_hint" v-if="a_o_sample__viz.length > n_cap__viz">
            showing first {{ n_cap__viz }} of {{ a_o_sample__viz.length }} shapes
          </div>
        </template>
      </div>

      <!-- ====================================================== shape list -->
      <template v-else>
        <div class="o_row">
          <label class="s_label">number of points</label>
          <input type="number" min="3" max="500" step="1" v-model.number="n_its_point" style="width:70px" />
          <span class="s_hint" style="margin-top:0">per shape (fixed — every shape has exactly this many)</span>
        </div>

        <div class="o_grid_shape">
          <div class="o_card_shape" v-for="o_shape in a_o_shape" :key="o_shape.s_id">
            <div class="o_card_head">
              <input type="text" class="s_name_shape" v-model="o_shape.s_name" />
              <button class="b_close" @click="f_shape_remove(o_shape.s_id)" title="remove shape">✕</button>
            </div>
            <svg
              class="o_svg_shape"
              viewBox="0 0 1 1"
              preserveAspectRatio="xMidYMid meet"
              @click="f_edit_open(o_shape.s_id)"
              title="edit shape"
            >
              <polygon :points="f_s_outline(o_shape)" class="o_outline" />
              <circle
                v-for="(o_p, n_idx) in o_shape.a_o_p_vertex"
                :key="n_idx"
                :cx="o_p.n_x"
                :cy="o_p.n_y"
                r="0.02"
                class="o_point"
              />
            </svg>
            <button class="b_edit" @click="f_edit_open(o_shape.s_id)">
              ✎ {{ f_b_complete(o_shape) ? 'edit points' : o_shape.a_o_p_vertex.length + '/' + n_its_point + ' — finish' }}
            </button>
          </div>

          <div class="o_card_shape o_card_add" @click="f_shape_add" title="add a shape">
            <div class="s_plus">＋</div>
            <div>add</div>
          </div>
        </div>

        <div class="o_augment">
          <div class="s_section">create augmented data</div>
          <div class="o_row">
            <label class="s_label">per shape</label>
            <input type="number" min="1" max="100000" step="1" v-model.number="n_per_shape" style="width:80px" />
          </div>
          <div class="o_row">
            <label class="s_label">noise min</label>
            <input type="number" min="0" max="1" step="0.01" v-model.number="n_noise__min" style="width:80px" />
            <label class="s_label">max</label>
            <input type="number" min="0" max="1" step="0.01" v-model.number="n_noise__max" style="width:80px" />
          </div>
          <div class="o_row" v-if="o_shape_set__loaded">
            <span class="s_hint" style="margin:0">
              editing set #{{ o_shape_set__loaded.n_id }} — generate re-generates it in place
            </span>
            <button style="margin-left:auto" @click="f_loaded_clear" title="detach; generate a new set instead">
              ＋ new set
            </button>
          </div>
          <div class="o_row">
            <label class="s_label">name</label>
            <input type="text" v-model="s_name" style="width:120px" />
            <button class="b_active" @click="f_generate" :disabled="!a_o_shape__complete.length">
              {{ n_id__loaded != null ? '↻ regenerate' : '⬇ generate' }}
            </button>
            <span class="s_hint" style="margin:0 0 0 auto">
              {{ a_o_shape__complete.length }}/{{ a_o_shape.length }} shapes · {{ n_cnt__sample }} samples
            </span>
          </div>
          <div class="s_hint" v-if="a_o_shape__complete.length < a_o_shape.length">
            shapes with fewer than {{ n_its_point }} points are skipped — finish or remove them
          </div>
        </div>

        <div class="o_augment" v-if="a_o_shape_set.length">
          <div class="s_section">stored sets</div>
          <div
            class="o_set_row"
            v-for="o_shape_set in a_o_shape_set"
            :key="o_shape_set.n_id"
            :class="{ b_active: o_shape_set.n_id == n_id__loaded }"
          >
            <span class="s_set_name">#{{ o_shape_set.n_id }} · {{ o_shape_set.s_name }}</span>
            <span class="s_hint" style="margin:0">
              {{ o_shape_set.n_cnt__sample }} shapes · {{ o_shape_set.n_dim }}d
            </span>
            <button style="margin-left:auto" @click="f_set_load(o_shape_set)">load</button>
            <button @click="f_viz_open(o_shape_set.n_id)">visualize</button>
            <button class="b_danger" @click="f_set_delete(o_shape_set.n_id)">✕</button>
          </div>
        </div>
      </template>
    </div>
  `,
};

export { c_dataset_shapes };
