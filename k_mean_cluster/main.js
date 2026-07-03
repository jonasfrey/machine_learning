import { f_a_a_n__testdata } from "./generate_testdata.js"
import { f_a_o_cluster } from "./k_means_clustering.js";


let n_clusters = 5;

let a_a_n = f_a_a_n__testdata(
    1,
    30, 
    -20,
    20, 
    n_clusters
);
let a_n  = a_a_n[0].sort((n1,n2)=>{return n1-n2})
console.log(a_n)
let a_o_cluster = f_a_o_cluster(
    n_clusters, 
    a_n
);

