import { f_a_n_rand_clustered, f_a_n_rand_mathrand, f_write_image_plot_datasets } from "./helper.js";


let f_a_a_n__testdata = function(
    n_datasets = 50,
    n_points_per_set = 50, 
    n_min = -20,
    n_max = 20,
    n_clusters = 5
){


    let n_range = n_max-n_min;
    
    let a_a_n = new Array(n_datasets).fill(0).map((n, n_idx)=>{
        // if(n_idx%2 == 0){ // simply random points
        //     return f_a_n_rand_mathrand(
        //         n_min, 
        //         n_max, 
        //         n_points_per_set
        //     );
        // }
            let a = f_a_n_rand_clustered(
                n_points_per_set, 
                n_clusters, 
                n_min, 
                n_max,
                0.1
            );
            return a.flat();
    
    });

    f_write_image_plot_datasets(a_a_n, `a_a_n_testdata_nds${n_datasets}_${n_points_per_set}.png`);

    return a_a_n;
}



export {
    f_a_a_n__testdata
}


// console.log(a_a_n)