// Copyright (C) 2026 Jonas Immanuel Frey - Licensed under MIT. See LICENSE file for details

import { f_send } from './ws.js';

// a generic movable / resizable window. it reads geometry from the o_window row
// (server-owned) and, on drag/resize end, writes it back via window_upsert so
// the layout survives a reload. n_z is bumped on focus so click brings to front.
let c_window = {
  props: {
    o_window: { type: Object, required: true },
    s_title: { type: String, default: '' },
  },
  emits: ['close'],
  setup(o_props, o_ctx) {
    let f_style = function () {
      let o = o_props.o_window;
      // o_window can be momentarily absent during a teardown re-render
      if (!o) return { display: 'none' };
      return {
        left: o.n_pos_x + 'px',
        top: o.n_pos_y + 'px',
        width: o.n_scl_x + 'px',
        height: o.n_scl_y + 'px',
        zIndex: o.n_z,
      };
    };

    // persist current geometry + open flag to the server.
    let f_persist = function () {
      let o = o_props.o_window;
      f_send('window_upsert', {
        s_type: o.s_type,
        b_open: 1,
        n_pos_x: Math.round(o.n_pos_x),
        n_pos_y: Math.round(o.n_pos_y),
        n_scl_x: Math.round(o.n_scl_x),
        n_scl_y: Math.round(o.n_scl_y),
        n_z: o.n_z,
      });
    };

    let f_focus = function () {
      o_props.o_window.n_z = Date.now() % 1000000;
    };

    // shared pointer-drag driver: f_step gets the live dx/dy each move, f_persist
    // fires once on release. the local o_window fields mutate live for smoothness,
    // then the final values are pushed to the server.
    let f_drag = function (o_evt, f_step) {
      f_focus();
      let n_x__start = o_evt.clientX;
      let n_y__start = o_evt.clientY;
      let f_move = function (o_evt__move) {
        f_step(o_evt__move.clientX - n_x__start, o_evt__move.clientY - n_y__start);
      };
      let f_up = function () {
        globalThis.removeEventListener('pointermove', f_move);
        globalThis.removeEventListener('pointerup', f_up);
        f_persist();
      };
      globalThis.addEventListener('pointermove', f_move);
      globalThis.addEventListener('pointerup', f_up);
    };

    let f_drag_move = function (o_evt) {
      let o = o_props.o_window;
      let n_pos_x__start = o.n_pos_x;
      let n_pos_y__start = o.n_pos_y;
      f_drag(o_evt, (n_dx, n_dy) => {
        o.n_pos_x = Math.max(0, n_pos_x__start + n_dx);
        o.n_pos_y = Math.max(40, n_pos_y__start + n_dy);
      });
    };

    let f_drag_resize = function (o_evt) {
      o_evt.stopPropagation();
      let o = o_props.o_window;
      let n_scl_x__start = o.n_scl_x;
      let n_scl_y__start = o.n_scl_y;
      f_drag(o_evt, (n_dx, n_dy) => {
        o.n_scl_x = Math.max(260, n_scl_x__start + n_dx);
        o.n_scl_y = Math.max(180, n_scl_y__start + n_dy);
      });
    };

    let f_close = function () {
      f_send('window_upsert', {
        s_type: o_props.o_window.s_type,
        b_open: 0,
        n_pos_x: Math.round(o_props.o_window.n_pos_x),
        n_pos_y: Math.round(o_props.o_window.n_pos_y),
        n_scl_x: Math.round(o_props.o_window.n_scl_x),
        n_scl_y: Math.round(o_props.o_window.n_scl_y),
        n_z: o_props.o_window.n_z,
      });
      o_ctx.emit('close');
    };

    return { f_style, f_drag_move, f_drag_resize, f_focus, f_close };
  },
  template: `
    <div class="o_window" :style="f_style()" @pointerdown="f_focus">
      <div class="o_titlebar" @pointerdown="f_drag_move">
        <span class="s_title">{{ s_title }}</span>
        <button class="b_close" @pointerdown.stop @click="f_close">✕</button>
      </div>
      <div class="o_body">
        <slot></slot>
      </div>
      <div class="o_resize" @pointerdown="f_drag_resize"></div>
    </div>
  `,
};

export { c_window };
