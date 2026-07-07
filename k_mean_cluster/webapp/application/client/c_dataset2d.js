// Copyright (C) 2026 Jonas Immanuel Frey - Licensed under MIT. See LICENSE file for details

import { ref, computed, watch, onMounted, onUnmounted } from './vendor/vue.esm-browser.prod.js';
import { o_store, f_send } from './ws.js';

// the dataset2d editor: pick / create / delete a dataset, tune generation params,
// and paint points onto a canvas. all points live in normalized [0..1] space on
// the server; the canvas only maps them to pixels for display and back on click.
let c_dataset2d = {
  setup() {
    let o_canvas__ref = ref(null);
    let n_id__selected = ref(null);
    let s_kind__new = ref('random_simple');

    // generation / spray parameters (the sketch's sliders)
    let n_amount = ref(80);
    let n_radius = ref(0.06);
    let n_random = ref(0.2);
    let s_mode = ref('add'); // 'add' | 'remove'

    // live cursor position in normalized space for the preview-radius circle
    let o_cursor = ref(null);

    let a_o_dataset2d = computed(() => o_store.o_state.a_o_dataset2d);
    let a_s_kind = computed(() => o_store.o_state.a_s_kind);

    let o_dataset2d__selected = computed(() => {
      return a_o_dataset2d.value.find((o) => o.n_id == n_id__selected.value) || null;
    });

    // keep a valid selection as datasets come and go over the websocket.
    watch(
      a_o_dataset2d,
      (a_o) => {
        if (!a_o.find((o) => o.n_id == n_id__selected.value)) {
          n_id__selected.value = a_o.length ? a_o[a_o.length - 1].n_id : null;
        }
      },
      { immediate: true }
    );

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

      // faint grid
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

      let o_dataset2d = o_dataset2d__selected.value;
      if (o_dataset2d) {
        o_ctx.fillStyle = '#4a9eff';
        for (let o_vec2d of o_dataset2d.a_o_vec2d) {
          o_ctx.beginPath();
          o_ctx.arc(o_vec2d.n_x * n_scl_x, o_vec2d.n_y * n_scl_y, 3, 0, Math.PI * 2);
          o_ctx.fill();
        }
      }

      // preview radius circle at the cursor
      if (o_cursor.value) {
        o_ctx.strokeStyle = s_mode.value == 'remove' ? '#ff5c5c' : 'rgba(255,255,255,0.5)';
        o_ctx.lineWidth = 1.5;
        o_ctx.beginPath();
        o_ctx.arc(
          o_cursor.value.n_x * n_scl_x,
          o_cursor.value.n_y * n_scl_y,
          n_radius.value * n_scl_x,
          0,
          Math.PI * 2
        );
        o_ctx.stroke();
      }
    };

    // redraw whenever the dataset, params, or cursor change
    watch([o_dataset2d__selected, o_cursor, n_radius, s_mode], f_draw, { deep: true });

    let n_id__raf = null;
    let f_tick = function () {
      f_draw();
      n_id__raf = requestAnimationFrame(f_tick);
    };
    onMounted(() => {
      f_tick();
    });
    onUnmounted(() => {
      if (n_id__raf) cancelAnimationFrame(n_id__raf);
    });

    // ---------------------------------------------------------- pointer → normalized

    let f_o_p__from_event = function (o_evt) {
      let o_canvas = o_canvas__ref.value;
      let o_rect = o_canvas.getBoundingClientRect();
      return {
        n_x: Math.max(0, Math.min(1, (o_evt.clientX - o_rect.left) / o_rect.width)),
        n_y: Math.max(0, Math.min(1, (o_evt.clientY - o_rect.top) / o_rect.height)),
      };
    };

    let f_canvas_move = function (o_evt) {
      o_cursor.value = f_o_p__from_event(o_evt);
    };
    let f_canvas_leave = function () {
      o_cursor.value = null;
    };

    let f_canvas_click = function (o_evt) {
      let o_dataset2d = o_dataset2d__selected.value;
      if (!o_dataset2d) return;
      let o_p = f_o_p__from_event(o_evt);

      if (s_mode.value == 'add') {
        f_send('vec2d_add', {
          n_o_dataset2d_n_id: o_dataset2d.n_id,
          n_x: o_p.n_x,
          n_y: o_p.n_y,
          n_amount: n_amount.value > 1 ? Math.round(n_amount.value / 8) + 1 : 1,
          n_radius: n_radius.value,
        });
      } else {
        // remove: collect ids of points inside the preview radius (server deletes)
        let a_n_id = o_dataset2d.a_o_vec2d
          .filter((o_vec2d) => {
            let n_dx = o_vec2d.n_x - o_p.n_x;
            let n_dy = o_vec2d.n_y - o_p.n_y;
            return Math.sqrt(n_dx * n_dx + n_dy * n_dy) <= n_radius.value;
          })
          .map((o_vec2d) => o_vec2d.n_id);
        if (a_n_id.length) {
          f_send('vec2d_remove', { n_o_dataset2d_n_id: o_dataset2d.n_id, a_n_id });
        }
      }
    };

    // ---------------------------------------------------------- actions

    let f_dataset2d_create = function () {
      f_send('dataset2d_create', {
        s_name: s_kind__new.value,
        s_kind: s_kind__new.value,
        n_amount: n_amount.value,
        n_radius: n_radius.value,
        n_random: n_random.value,
      });
    };
    let f_dataset2d_delete = function () {
      if (o_dataset2d__selected.value) {
        f_send('dataset2d_delete', { n_id: o_dataset2d__selected.value.n_id });
      }
    };
    let f_generate = function () {
      if (!o_dataset2d__selected.value) return;
      f_send('dataset2d_generate', {
        n_id: o_dataset2d__selected.value.n_id,
        s_kind: o_dataset2d__selected.value.s_kind,
        n_amount: n_amount.value,
        n_radius: n_radius.value,
        n_random: n_random.value,
        b_replace: true,
      });
    };
    let f_clear = function () {
      if (o_dataset2d__selected.value) {
        f_send('dataset2d_clear', { n_id: o_dataset2d__selected.value.n_id });
      }
    };

    let n_cnt__vec2d = computed(() => {
      return o_dataset2d__selected.value ? o_dataset2d__selected.value.a_o_vec2d.length : 0;
    });

    return {
      o_canvas__ref,
      n_id__selected,
      s_kind__new,
      n_amount,
      n_radius,
      n_random,
      s_mode,
      a_o_dataset2d,
      a_s_kind,
      o_dataset2d__selected,
      n_cnt__vec2d,
      f_canvas_move,
      f_canvas_leave,
      f_canvas_click,
      f_dataset2d_create,
      f_dataset2d_delete,
      f_generate,
      f_clear,
    };
  },
  template: `
    <div>
      <div class="o_row">
        <select v-model="n_id__selected">
          <option v-for="o in a_o_dataset2d" :key="o.n_id" :value="o.n_id">
            #{{ o.n_id }} · {{ o.s_name }}
          </option>
          <option v-if="!a_o_dataset2d.length" :value="null" disabled>no dataset yet</option>
        </select>
        <select v-model="s_kind__new">
          <option v-for="s in a_s_kind" :key="s" :value="s">{{ s }}</option>
        </select>
        <button @click="f_dataset2d_create" title="add new dataset">+ add</button>
        <button class="b_danger" @click="f_dataset2d_delete" :disabled="!o_dataset2d__selected">
          remove
        </button>
      </div>

      <div class="o_row">
        <div class="o_slider">
          <label>amount <span>{{ n_amount }}</span></label>
          <input type="range" min="1" max="1000" step="1" v-model.number="n_amount" />
        </div>
        <div class="o_slider">
          <label>radius <span>{{ n_radius.toFixed(3) }}</span></label>
          <input type="range" min="0" max="0.5" step="0.005" v-model.number="n_radius" />
        </div>
        <div class="o_slider">
          <label>random <span>{{ n_random.toFixed(2) }}</span></label>
          <input type="range" min="0" max="1" step="0.01" v-model.number="n_random" />
        </div>
      </div>

      <div class="o_row">
        <button :class="{ b_active: s_mode == 'add' }" @click="s_mode = 'add'">✎ add</button>
        <button :class="{ b_active: s_mode == 'remove' }" @click="s_mode = 'remove'">⌫ remove</button>
        <button @click="f_generate" :disabled="!o_dataset2d__selected">generate</button>
        <button class="b_danger" @click="f_clear" :disabled="!o_dataset2d__selected">clear</button>
        <span class="s_hint" style="margin-left:auto">{{ n_cnt__vec2d }} points</span>
      </div>

      <div class="o_canvas_wrap">
        <canvas
          ref="o_canvas__ref"
          @mousemove="f_canvas_move"
          @mouseleave="f_canvas_leave"
          @click="f_canvas_click"
        ></canvas>
      </div>
      <div class="s_hint">
        left-click to {{ s_mode == 'add' ? 'paint' : 'erase' }} points ·
        the circle previews the {{ s_mode == 'add' ? 'spray' : 'erase' }} radius
      </div>
    </div>
  `,
};

export { c_dataset2d };
