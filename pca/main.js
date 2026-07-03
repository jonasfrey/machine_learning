//let say we have data of 6 points

let a_o_p  = [
    {x:2,y:4},
    {x:1,y:-3},
    {x:-3,y:8},
    {x:8,y:8},
];


// we can now represent those as a vector of dimension 6*2=12

let a_n_dim12 = [
    2,4,
    1,-3,
    -3, 8,
    8, 8
];




// let say we have 10k of the points

let n = 10000;
let n_min = -10; 
let n_max = 10;
let n_range = n_max - n_min;
let np = 6;
let a_a_o_p  = new Array(n).fill(0).map((v, n_idx)=>{
    
    return new Array(np).fill(
        {
        x: parseInt(Math.random()*n_range + n_min),
        y: parseInt(Math.random()*n_range + n_min),
    }
    ) 
})

// console.log(a_a_o_p)
a_n_dim12 = a_a_o_p.map((a_o_p)=>{
    return a_o_p.map(o=>{
        return Object.values(o);
    }).flat()
})
console.log(a_n_dim12)
