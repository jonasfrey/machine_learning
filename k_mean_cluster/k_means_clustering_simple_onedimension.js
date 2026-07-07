import { f_write_image_plot_dataset_with_clusters, f_o_frame_recorder, f_p_gif__frames } from "./helper.js";

let f_n_rand = Math.random;
let f_n_randidx = function(n_len){return parseInt(f_n_rand()*n_len)}

let f_o_cluster = function(
    n_idx, 
    n_val,
    a_n = [],
    n_mean, 
    n_mean__last,
    n_mean__diff, 
){
    return {n_idx,n_val,a_n, n_mean, n_mean__last, n_mean__diff}
}
let f_o_eucldist_min = function(
    n, 
    a_o_cluster
){
    let a_o_dist = new Array(a_o_cluster.length).fill(0).map((v_ignore, n_idx)=>{
        let n_dist = Math.abs(n-a_o_cluster[n_idx].n_val);
        return {n_dist, o_cluster: a_o_cluster[n_idx]}; 
    });
    let o_dist_min = a_o_dist.sort((o1, o2)=>{return o1.n_dist-o2.n_dist}).at(0);
    // console.log({a_o_dist, o_dist_min})

    return o_dist_min;
}
let f_assign_clusters = function(
    a_o_cluster, 
    a_n
){
    for(let n_idx = 0; n_idx< a_n.length; n_idx+=1){
        let n_val = a_n[n_idx];
        let o_dist_min = f_o_eucldist_min(
            n_val, 
            a_o_cluster
        );
        o_dist_min?.o_cluster.a_n.push(n_val);
    }
}
let f_calculate_mean = function(
    a_o_cluster
){
    for(let o_cluster of a_o_cluster){
        o_cluster.n_mean__last = o_cluster.n_mean;

        // empty cluster → keep old position, otherwise mean = sum / count
        if(o_cluster.a_n.length == 0){
            o_cluster.n_mean = o_cluster.n_val;
        }else{
            let n_sum = o_cluster.a_n.reduce((n_sum, n)=>{return n_sum + n}, 0);
            o_cluster.n_mean = n_sum / o_cluster.a_n.length;
        }

        // first iteration has no previous mean → treat diff as "changed"
        o_cluster.n_mean__diff = o_cluster.n_mean__last == undefined
            ? Infinity
            : o_cluster.n_mean - o_cluster.n_mean__last;

        // assign the mean as the new 'location'
        o_cluster.n_val = o_cluster.n_mean;
    }
}
let f_a_o_cluster = async function(
    n_clusters,
    a_n

){

    let k = n_clusters;
    let a_o_cluster = []

    // step 2 , randomly select 3 distinct datapoints (initial clusters)
    while(a_o_cluster.length < k){
        let n_idx = f_n_randidx(a_n.length);
        let n_val = a_n[n_idx];
        let o_cluster = a_o_cluster.find(o=>o.n_val == n_val);
        if(!o_cluster){
            a_o_cluster.push(f_o_cluster(n_idx, n_val, []))
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
            a_n, a_o_cluster, o_recorder.f_s_path__next(),
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
        for(let o_cluster of a_o_cluster){ o_cluster.a_n = []; }

        // step 3+4: assign each point to its nearest centroid
        f_assign_clusters(a_o_cluster, a_n);
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
            `cluster ${n_idx}: centroid=${o_cluster.n_val.toFixed(3)} `+
            `members=${o_cluster.a_n.length} `+
            `[${o_cluster.a_n.map(n=>n.toFixed(2)).join(', ')}]`
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