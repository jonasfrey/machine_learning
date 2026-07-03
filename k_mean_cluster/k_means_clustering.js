import { f_write_image_plot_dataset_with_clusters } from "./helper.js";

let f_n_rand = Math.random;
let f_n_randidx = function(n_len){return parseInt(f_n_rand()*n_len)}

let f_o_cluster = function(
    n_idx, 
    n_val,
    n_mean, 
    a_n = []
){
    return {n_idx,n_val,a_n}
}
let f_o_dist_min = function(
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
let f_a_o_cluster = function(
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
            a_o_cluster.push(f_o_cluster(n_idx, n_val,null, []))
        }
    }

    console.log('Initial clusters: ')
    console.log({a_o_cluster})

    f_write_image_plot_dataset_with_clusters(a_n, a_o_cluster, `a_n_a_o_cluster.png`);

    // step 3, measure distance ,between first point and 3 initial clusters

    for(let n_idx = 0; n_idx< a_n.length; n_idx+=1){
        let n_val = a_n[n_idx];
        let o_dist_min = f_o_dist_min(
            n_val, 
            a_o_cluster
        );
        o_dist_min?.o_cluster.a_n.push(n_val);

        f_write_image_plot_dataset_with_clusters(a_n, a_o_cluster, `a_n_a_o_cluster2.png`);
    }

    return a_o_cluster;
}


export {
    f_a_o_cluster
}