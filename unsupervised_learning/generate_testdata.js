import { f_a_n_rand_clustered, f_a_n_rand_mathrand, f_write_image_plot_datasets } from "./helper.js";

let n_datasets = 50; 
let n_points_per_set = 30; 
let n_min = -20;
let n_max = 20;
let n_range = n_max-n_min;

let a_a_n = new Array(n_datasets).fill(0).map((n, n_idx)=>{
    if(n_idx%2 == 0){
        return f_a_n_rand_mathrand(
            n_min, 
            n_max, 
            n_points_per_set
        );
    }
        let a = f_a_n_rand_clustered(
            n_points_per_set, 
            2, 
            n_min, 
            n_max,
            0.1
        );
        return a.flat();

});

f_write_image_plot_datasets(a_a_n, 'a_a_n_testdata.png');
// console.log(a_a_n)