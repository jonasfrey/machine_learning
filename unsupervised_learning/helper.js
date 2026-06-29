// Copyright (C) 2026 Jonas Immanuel Frey - Licensed under MIT. See LICENSE file for details

// Deno module. No Node APIs (no require / Buffer / zlib / fs).
// f_write_image_plot_datasets is async (uses the built-in CompressionStream). Callers must await it.
// Run callers with: deno run --allow-write your_script.js

// byte helpers ---------------------------------------------------------------
let f_a_nu8_concat = function(a_a_nu8){
    let n_len = a_a_nu8.reduce((n_sum, a_nu8) => n_sum + a_nu8.length, 0);
    let a_nu8_out = new Uint8Array(n_len);
    let n_off = 0;
    for(let n_it = 0; n_it < a_a_nu8.length; n_it++){
        a_nu8_out.set(a_a_nu8[n_it], n_off);
        n_off += a_a_nu8[n_it].length;
    }
    return a_nu8_out;
};

// crc32 lookup table (built once) --------------------------------------------
let f_a_n_crc_table = function(){
    let a_n_table = new Array(256);
    for(let n_it = 0; n_it < 256; n_it++){
        let n_c = n_it;
        for(let n_it_bit = 0; n_it_bit < 8; n_it_bit++){
            n_c = (n_c & 1) ? (0xEDB88320 ^ (n_c >>> 1)) : (n_c >>> 1);
        }
        a_n_table[n_it] = n_c >>> 0;
    }
    return a_n_table;
};
let a_n_crc_table = f_a_n_crc_table();

let f_n_crc32 = function(a_nu8){
    let n_crc = 0xFFFFFFFF;
    for(let n_it = 0; n_it < a_nu8.length; n_it++){
        n_crc = a_n_crc_table[(n_crc ^ a_nu8[n_it]) & 0xFF] ^ (n_crc >>> 8);
    }
    return (n_crc ^ 0xFFFFFFFF) >>> 0;
};

// zlib deflate via the built-in CompressionStream (async) --------------------
let f_p_a_nu8_deflate = async function(a_nu8){
    let o_stream = new CompressionStream('deflate'); // 'deflate' == zlib wrapper (what png needs)
    let o_writer = o_stream.writable.getWriter();
    o_writer.write(a_nu8);
    o_writer.close();
    let o_buffer = await new Response(o_stream.readable).arrayBuffer();
    return new Uint8Array(o_buffer);
};

// wrap raw chunk data into a length+type+data+crc png chunk -------------------
let f_a_nu8_chunk = function(s_type, a_nu8_data){
    let a_nu8_type = new TextEncoder().encode(s_type);
    let n_len = a_nu8_data.length;
    let a_nu8_out = new Uint8Array(n_len + 12);
    let o_view = new DataView(a_nu8_out.buffer);
    o_view.setUint32(0, n_len, false);
    a_nu8_out.set(a_nu8_type, 4);
    a_nu8_out.set(a_nu8_data, 8);
    let a_nu8_crc_src = a_nu8_out.subarray(4, 8 + n_len);
    o_view.setUint32(8 + n_len, f_n_crc32(a_nu8_crc_src), false);
    return a_nu8_out;
};

// hue (0..1) -> rgb triple, full saturation/value ----------------------------
let f_a_n_rgb__hue = function(n_hue_nor){
    let n_h = (n_hue_nor % 1) * 6;
    let n_x = Math.round((1 - Math.abs((n_h % 2) - 1)) * 255);
    if(n_h < 1) return [255, n_x, 0];
    if(n_h < 2) return [n_x, 255, 0];
    if(n_h < 3) return [0, 255, n_x];
    if(n_h < 4) return [0, n_x, 255];
    if(n_h < 5) return [n_x, 0, 255];
    return [255, 0, n_x];
};

// encode an rgb pixel buffer into a png byte buffer (async) ------------------
let f_p_a_nu8_png = async function(a_nu8_pixel, n_scl_x, n_scl_y){
    // raw scanlines: each row prefixed with a filter byte (0 = none)
    let a_nu8_raw = new Uint8Array(n_scl_y * (1 + n_scl_x * 3));
    for(let n_it_y = 0; n_it_y < n_scl_y; n_it_y++){
        let n_off__dst = n_it_y * (1 + n_scl_x * 3);
        a_nu8_raw[n_off__dst] = 0;
        a_nu8_raw.set(
            a_nu8_pixel.subarray(n_it_y * n_scl_x * 3, (n_it_y + 1) * n_scl_x * 3),
            n_off__dst + 1
        );
    }

    let a_nu8_ihdr = new Uint8Array(13);
    let o_view = new DataView(a_nu8_ihdr.buffer);
    o_view.setUint32(0, n_scl_x, false);
    o_view.setUint32(4, n_scl_y, false);
    a_nu8_ihdr[8] = 8;   // bit depth
    a_nu8_ihdr[9] = 2;   // color type 2 = truecolor rgb
    a_nu8_ihdr[10] = 0;  // compression
    a_nu8_ihdr[11] = 0;  // filter
    a_nu8_ihdr[12] = 0;  // interlace

    let a_nu8_signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    let a_nu8_idat = await f_p_a_nu8_deflate(a_nu8_raw);

    return f_a_nu8_concat([
        a_nu8_signature,
        f_a_nu8_chunk('IHDR', a_nu8_ihdr),
        f_a_nu8_chunk('IDAT', a_nu8_idat),
        f_a_nu8_chunk('IEND', new Uint8Array(0))
    ]);
};

// build a drawing surface with pixel/line/rect/dot primitives ----------------
let f_o_surface = function(n_scl_x, n_scl_y){
    let a_nu8_pixel = new Uint8Array(n_scl_x * n_scl_y * 3).fill(255);

    let f_set_pixel = function(n_x, n_y, a_n_rgb){
        if(n_x < 0 || n_x >= n_scl_x || n_y < 0 || n_y >= n_scl_y) return;
        let n_off = (n_y * n_scl_x + n_x) * 3;
        a_nu8_pixel[n_off] = a_n_rgb[0];
        a_nu8_pixel[n_off + 1] = a_n_rgb[1];
        a_nu8_pixel[n_off + 2] = a_n_rgb[2];
    };

    // bresenham line
    let f_line = function(n_x__start, n_y__start, n_x__end, n_y__end, a_n_rgb){
        let n_dx = Math.abs(n_x__end - n_x__start);
        let n_dy = Math.abs(n_y__end - n_y__start);
        let n_step_x = n_x__start < n_x__end ? 1 : -1;
        let n_step_y = n_y__start < n_y__end ? 1 : -1;
        let n_err = n_dx - n_dy;
        let n_x = n_x__start;
        let n_y = n_y__start;
        while(true){
            f_set_pixel(n_x, n_y, a_n_rgb);
            if(n_x === n_x__end && n_y === n_y__end) break;
            let n_err__double = n_err * 2;
            if(n_err__double > -n_dy){ n_err -= n_dy; n_x += n_step_x; }
            if(n_err__double < n_dx){ n_err += n_dx; n_y += n_step_y; }
        }
    };

    // rectangle outline
    let f_rect = function(n_x0, n_y0, n_x1, n_y1, a_n_rgb){
        f_line(n_x0, n_y0, n_x1, n_y0, a_n_rgb);
        f_line(n_x0, n_y1, n_x1, n_y1, a_n_rgb);
        f_line(n_x0, n_y0, n_x0, n_y1, a_n_rgb);
        f_line(n_x1, n_y0, n_x1, n_y1, a_n_rgb);
    };

    // filled square marker of half-size n_rad
    let f_dot = function(n_x, n_y, n_rad, a_n_rgb){
        for(let n_it_y = -n_rad; n_it_y <= n_rad; n_it_y++){
            for(let n_it_x = -n_rad; n_it_x <= n_rad; n_it_x++){
                f_set_pixel(n_x + n_it_x, n_y + n_it_y, a_n_rgb);
            }
        }
    };

    return { a_nu8_pixel, f_set_pixel, f_line, f_rect, f_dot };
};

// draw one dataset inside its own coordinate system (a framed cell) ----------
// the data is 1d: every value is only an x position, there is no y information,
// so all points sit on a single horizontal x-axis (scatter on a number line).
let f_draw_cell = function(o_surface, a_n, o_cell, a_n_rgb){
    let a_n_rgb__frame = [170, 170, 170];
    let a_n_rgb__axis = [120, 120, 120];
    let n_pad = 4; // inner padding so points don't sit on the frame

    let n_x0 = o_cell.n_px_x + o_cell.n_margin;
    let n_y0 = o_cell.n_px_y + o_cell.n_margin;
    let n_x1 = o_cell.n_px_x + o_cell.n_scl_x - o_cell.n_margin;
    let n_y1 = o_cell.n_px_y + o_cell.n_scl_y - o_cell.n_margin;

    // frame = the coordinate system box
    o_surface.f_rect(n_x0, n_y0, n_x1, n_y1, a_n_rgb__frame);

    // the single horizontal x-axis, centered vertically
    let n_px_y__axis = Math.round((n_y0 + n_y1) / 2);
    o_surface.f_line(n_x0, n_px_y__axis, n_x1, n_px_y__axis, a_n_rgb__axis);

    // per-dataset (own) horizontal range
    let n_min = Infinity;
    let n_max = -Infinity;
    for(let n_it_point = 0; n_it_point < a_n.length; n_it_point++){
        let n_val = a_n[n_it_point];
        if(typeof n_val !== 'number' || !isFinite(n_val)) continue;
        if(n_val < n_min) n_min = n_val;
        if(n_val > n_max) n_max = n_val;
    }
    if(!isFinite(n_min) || !isFinite(n_max)){ n_min = 0; n_max = 1; }
    let n_range = (n_max - n_min) || 1;

    let n_px_x__left = n_x0 + n_pad;
    let n_scl_x__plot = (n_x1 - n_pad) - n_px_x__left;

    // each value is a single point placed along the x-axis (no y)
    for(let n_it_point = 0; n_it_point < a_n.length; n_it_point++){
        let n_val = a_n[n_it_point];
        if(typeof n_val !== 'number' || !isFinite(n_val)) continue;
        let n_val_nor = (n_val - n_min) / n_range;
        let n_px_x = Math.round(n_px_x__left + n_val_nor * n_scl_x__plot);
        o_surface.f_dot(n_px_x, n_px_y__axis, 2, a_n_rgb);
    }
};

// render each dataset of a_a_n in its OWN coordinate system, laid out in a grid
let f_write_image_plot_datasets = async function(a_a_n, s_path, o_opt){
    o_opt = o_opt || {};
    let n_scl_x__cell = o_opt.n_scl_x__cell || 200;
    let n_scl_y__cell = o_opt.n_scl_y__cell || 140;
    let n_margin__cell = o_opt.n_margin__cell || 12;

    // only datasets that actually hold points get a coordinate system
    let a_a_n__valid = a_a_n.filter((a_n) => Array.isArray(a_n) && a_n.length > 0);
    let n_its_dataset = a_a_n__valid.length;
    if(n_its_dataset === 0){
        throw new Error('f_write_image_plot_datasets: no non-empty datasets to draw');
    }

    let n_its_col = o_opt.n_its_col || Math.ceil(Math.sqrt(n_its_dataset));
    let n_its_row = Math.ceil(n_its_dataset / n_its_col);

    let n_scl_x = n_its_col * n_scl_x__cell;
    let n_scl_y = n_its_row * n_scl_y__cell;

    let o_surface = f_o_surface(n_scl_x, n_scl_y);

    for(let n_it_dataset = 0; n_it_dataset < n_its_dataset; n_it_dataset++){
        let n_it_col = n_it_dataset % n_its_col;
        let n_it_row = Math.floor(n_it_dataset / n_its_col);
        let n_it_nor_dataset = n_its_dataset > 1 ? n_it_dataset / (n_its_dataset - 1) : 0;
        let a_n_rgb = f_a_n_rgb__hue(n_it_nor_dataset);
        let o_cell = {
            n_px_x: n_it_col * n_scl_x__cell,
            n_px_y: n_it_row * n_scl_y__cell,
            n_scl_x: n_scl_x__cell,
            n_scl_y: n_scl_y__cell,
            n_margin: n_margin__cell
        };
        f_draw_cell(o_surface, a_a_n__valid[n_it_dataset], o_cell, a_n_rgb);
    }

    let a_nu8_png = await f_p_a_nu8_png(o_surface.a_nu8_pixel, n_scl_x, n_scl_y);
    Deno.writeFileSync(s_path, a_nu8_png);
    console.log(
        `wrote ${n_its_dataset} coordinate system(s) ` +
        `(${n_its_col}x${n_its_row} grid) to ${s_path} (${n_scl_x}x${n_scl_y})`
    );
};

let f_a_n_rand_mathrand = function(
    n_min,
    n_max, 
    n_points
){
    let n_range= n_max-n_min;
    return new Array(n_points).fill(0).map((n, n_idx)=>{
        return Math.random()*n_range+n_min;
    })
}
let f_a_n_rand_clustered = function(
    n_points, 
    n_clusters, 
    n_min, 
    n_max,
    n_clusterspread_nor 
){
    if(n_max < n_min){
        console.log('error, n_max is smaller than n_min')
        return -1;
    }

    let n_range = n_max - n_min; 
    let n_p_per_clust = Math.floor(n_points/n_clusters);
    let n_pointsleft = n_points%n_clusters;
    let a_a_n = new Array(n_clusters).fill(0).map((n,n_idx)=>{
        let n_start = Math.random()*n_range + n_min;
        console.log({n_start})
        let a_n = new Array(
            n_p_per_clust+ (
            (n_idx == (n_clusters-1))*n_pointsleft)
        ).fill(0).map((n2, n_idx2)=>{
            let n_rand =  n_start + Math.random()*n_clusterspread_nor*n_range;

            n_rand = (n_rand%n_max)-n_min;
            return n_rand;
        })
        return a_n;
    })
    return a_a_n
}
export { f_write_image_plot_datasets, f_a_n_rand_clustered, f_a_n_rand_mathrand };
