// Copyright (C) 2026 Jonas Immanuel Frey - Licensed under MIT. See LICENSE file for details

import { f_write_image_plot_dataset_with_clusters, f_o_frame_recorder, f_p_gif__frames } from "./helper.js";

let f_n_rand = Math.random;
let f_n_randidx = function(n_len){return parseInt(f_n_rand()*n_len)}

// a point value 'v' is dimension-agnostic: it is either a plain number (1d) or
// an array of numbers ([x,y], [x,y,z], ...). these helpers let every step of
// the algorithm treat both forms uniformly.

// treat a value as a vector: scalar -> [scalar], vector -> itself (unchanged)
let f_a_n_vec = function(v){
    return Array.isArray(v) ? v : [v];
}
// euclidean distance between two points of any (matching) dimension
let f_n_dist_eucl = function(v1, v2){
    let a_n_1 = f_a_n_vec(v1);
    let a_n_2 = f_a_n_vec(v2);
    let n_sum = 0;
    for(let n_idx = 0; n_idx < a_n_1.length; n_idx += 1){
        let n_delta = a_n_1[n_idx] - a_n_2[n_idx];
        n_sum += n_delta * n_delta;
    }
    return Math.sqrt(n_sum);
}
// componentwise mean of an array of points, returned in the SAME form as the
// input points (scalar in -> scalar out, vector in -> vector out)
let f_v_mean = function(a_v){
    let b_scalar = !Array.isArray(a_v[0]);
    let n_dims = f_a_n_vec(a_v[0]).length;
    let a_n_sum = new Array(n_dims).fill(0);
    for(let n_idx = 0; n_idx < a_v.length; n_idx += 1){
        let a_n = f_a_n_vec(a_v[n_idx]);
        for(let n_idx_dim = 0; n_idx_dim < n_dims; n_idx_dim += 1){
            a_n_sum[n_idx_dim] += a_n[n_idx_dim];
        }
    }
    let a_n_mean = a_n_sum.map((n_sum)=>{ return n_sum / a_v.length; });
    return b_scalar ? a_n_mean[0] : a_n_mean;
}
// value equality for either form (used to pick distinct initial centroids)
let f_b_vec_eq = function(v1, v2){
    let a_n_1 = f_a_n_vec(v1);
    let a_n_2 = f_a_n_vec(v2);
    if(a_n_1.length !== a_n_2.length) return false;
    return a_n_1.every((n, n_idx)=>{ return n === a_n_2[n_idx]; });
}
// pretty-print a point value: 3 -> "[3.000]", [1,2] -> "[1.000, 2.000]"
let f_s_vec = function(v){
    return '[' + f_a_n_vec(v).map((n)=>{ return n.toFixed(3); }).join(', ') + ']';
}

let f_o_cluster = function(
    n_idx,
    v_val,
    a_v = [],
    v_mean,
    v_mean__last,
    n_mean__diff,
){
    return {n_idx, v_val, a_v, v_mean, v_mean__last, n_mean__diff}
}
let f_o_eucldist_min = function(
    v,
    a_o_cluster
){
    let a_o_dist = a_o_cluster.map((o_cluster)=>{
        return {n_dist: f_n_dist_eucl(v, o_cluster.v_val), o_cluster};
    });
    let o_dist_min = a_o_dist.sort((o1, o2)=>{return o1.n_dist-o2.n_dist}).at(0);
    // console.log({a_o_dist, o_dist_min})

    return o_dist_min;
}
let f_assign_clusters = function(
    a_o_cluster,
    a_v
){
    for(let n_idx = 0; n_idx< a_v.length; n_idx+=1){
        let v = a_v[n_idx];
        let o_dist_min = f_o_eucldist_min(
            v,
            a_o_cluster
        );
        o_dist_min?.o_cluster.a_v.push(v);
    }
}
let f_calculate_mean = function(
    a_o_cluster
){
    for(let o_cluster of a_o_cluster){
        o_cluster.v_mean__last = o_cluster.v_mean;

        // empty cluster → keep old position, otherwise mean = componentwise avg
        if(o_cluster.a_v.length == 0){
            o_cluster.v_mean = o_cluster.v_val;
        }else{
            o_cluster.v_mean = f_v_mean(o_cluster.a_v);
        }

        // first iteration has no previous mean → treat diff as "changed".
        // diff is the euclidean distance the centroid moved this step.
        o_cluster.n_mean__diff = o_cluster.v_mean__last == undefined
            ? Infinity
            : f_n_dist_eucl(o_cluster.v_mean, o_cluster.v_mean__last);

        // assign the mean as the new 'location'
        o_cluster.v_val = o_cluster.v_mean;
    }
}
let f_a_o_cluster = async function(
    n_clusters,
    a_v

){

    let k = n_clusters;
    let a_o_cluster = []

    // step 2 , randomly select k distinct datapoints (initial clusters)
    while(a_o_cluster.length < k){
        let n_idx = f_n_randidx(a_v.length);
        let v = a_v[n_idx];
        let o_cluster = a_o_cluster.find(o=>f_b_vec_eq(o.v_val, v));
        if(!o_cluster){
            a_o_cluster.push(f_o_cluster(n_idx, v, []))
        }
    }

    console.log('Initial clusters: ')
    console.log({a_o_cluster})

    // one recorder hands out sequential frame paths (frames/frame_0000.png ...)
    // and wipes old frames from a previous run
    let o_recorder = f_o_frame_recorder('./frames');
    // draw the CURRENT state (datapoints colored by cluster + centroids) into
    // the next frame slot. one call == one frame of the animation.
    let f_addframe = async function(s_caption, b_hide_cluster){
        await f_write_image_plot_dataset_with_clusters(
            a_v, a_o_cluster, o_recorder.f_s_path__next(),
            { s_caption, b_hide_cluster }
        );
    };

    await f_addframe('random datapoints', true); // only grey points, no centroids
    await f_addframe('random means');            // the randomly selected means appear

    let b_mean_same = false;
    let n_it = 0;
    let n_its_max = 100; // safety cap so it can never loop forever
    while(!b_mean_same && n_it < n_its_max){

        // clear old members before re-assigning from scratch
        for(let o_cluster of a_o_cluster){ o_cluster.a_v = []; }

        // step 3+4: assign each point to its nearest centroid
        f_assign_clusters(a_o_cluster, a_v);
        await f_addframe('closest means');    // points recolored to nearest mean

        // step 5: move each centroid to the mean of its members
        f_calculate_mean(a_o_cluster);
        await f_addframe('recalculate mean'); // centroids move to the new mean

        let a_o_cluster_with_diff_mean = a_o_cluster.find(o=>{
            return o.n_mean__diff != 0
        });
        // converged when NO cluster changed its mean (find returned nothing)
        b_mean_same = a_o_cluster_with_diff_mean == undefined;

        n_it += 1;
    }
    console.log(`converged after ${n_it} iterations`);

    // print each cluster's centroid and its member count
    for(let n_idx = 0; n_idx < a_o_cluster.length; n_idx += 1){
        let o_cluster = a_o_cluster[n_idx];
        console.log(
            `cluster ${n_idx}: centroid=${f_s_vec(o_cluster.v_val)} `+
            `members=${o_cluster.a_v.length} `+
            `[${o_cluster.a_v.map(v=>f_s_vec(v)).join(', ')}]`
        );
    }

    // hold the final converged state for a moment before the gif loops around
    for(let n_it_hold = 0; n_it_hold < 3; n_it_hold += 1){
        await f_addframe('converged');
    }

    // stitch every recorded frame into an animated gif so the whole run is
    // visible as one looping animation (1 fps == each step held for 1s so the
    // caption text is readable; lower n_fps further to slow it down more)
    await f_p_gif__frames('./frames', `./k_means_${new Date().getTime()}.gif`, { n_fps: 1 });

    return a_o_cluster;
}


export {
    f_a_o_cluster
}
