import { saveMultipleShapesAsImage, saveShapeAsImage, saveShapesOverlay } from "./helper.js";

// 1. CIRCLE (24 points, radius = 1)
const circle = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * 2 * Math.PI;
    return { x: Math.cos(angle), y: Math.sin(angle) };
});

// 2. SQUARE (28 points, with rounded corners for smoothness)
const square = [
    // Top edge (left to right)
    ...Array.from({ length: 8 }, (_, i) => ({ x: -1 + (i / 7) * 2, y: -1 })),
    // Right edge (top to bottom)
    ...Array.from({ length: 8 }, (_, i) => ({ x: 1, y: -1 + (i / 7) * 2 })),
    // Bottom edge (right to left)
    ...Array.from({ length: 8 }, (_, i) => ({ x: 1 - (i / 7) * 2, y: 1 })),
    // Left edge (bottom to top)
    ...Array.from({ length: 8 }, (_, i) => ({ x: -1, y: 1 - (i / 7) * 2 })),
];

// 3. TRIANGLE (30 points, equilateral)
const triangle = Array.from({ length: 30 }, (_, i) => {
    const t = i / 30;
    // Interpolate between 3 vertices: (0, -1), (-0.866, 0.5), (0.866, 0.5)
    const vertices = [
        { x: 0, y: -1 },
        { x: -Math.sqrt(3)/2, y: 0.5 },
        { x: Math.sqrt(3)/2, y: 0.5 }
    ];
    const seg = Math.floor(t * 3);
    const localT = (t * 3) - seg;
    const p1 = vertices[seg % 3];
    const p2 = vertices[(seg + 1) % 3];
    return {
        x: p1.x + (p2.x - p1.x) * localT,
        y: p1.y + (p2.y - p1.y) * localT
    };
});

// 4. STAR (20 points, 5-pointed star)
const star = Array.from({ length: 20 }, (_, i) => {
    const angle = (i / 20) * 2 * Math.PI - Math.PI/2;
    const radius = i % 2 === 0 ? 1.0 : 0.4; // Outer and inner vertices
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
});

// 5. HEART (50 points, parametric heart shape)
const heart = Array.from({ length: 50 }, (_, i) => {
    const t = (i / 49) * 2 * Math.PI;
    // Parametric heart equation (scaled to unit size)
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
    // Normalize to unit circle (scale and center)
    const scale = 1 / 17; // Approximate max distance
    return { x: x * scale, y: -y * scale }; // Flip Y to make it upright
});



let a_o_shape = [
   {s_name: 'circle', a_o_point: circle},
   {s_name: 'square', a_o_point: square},
   {s_name: 'triangle', a_o_point: triangle},
   {s_name: 'star', a_o_point: star},
   {s_name: 'heart', a_o_point: heart},
]
for(let o of a_o_shape){
    
    await saveShapeAsImage(o.a_o_point, {
        filename: `${o.s_name}.png`,
        size: 800,
        color: '#FF6B6B',
        lineWidth: 4,
        fill: true,
        fillColor: 'rgba(255, 107, 107, 0.3)',
        padding: 0.15
    });
}


await saveMultipleShapesAsImage(a_o_shape, {
    filename: 'shapes_grid.png',
    shapeSize: 180,
    gap: 30,
    padding: 40,
    columns: 3,          // or leave null for auto
    showPoints: true,
    pointRadius: 3,
    fill: true,
    fillAlpha: 0.15
});

// Random helpers
function rand(min, max) { return Math.random() * (max - min) + min; }

// Apply transformations to a single point (x, y)
function transformPoint(x, y, scale, angle, noise) {
    // Add noise (Gaussian-like using uniform box-Muller, but simpler: uniform)
    const nx = x + rand(-noise, noise);
    const ny = y + rand(-noise, noise);
    // Scale
    const sx = nx * scale;
    const sy = ny * scale;
    // Rotate
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    return {
        x: sx * cosA - sy * sinA,
        y: sx * sinA + sy * cosA
    };
}

// Apply to each shape
let a_o_shape2 = structuredClone(a_o_shape).map(o => {
    const points = o.a_o_point;
    // Random parameters for this shape
    const scale = rand(0.7, 5);          // scale factor
    const angle = rand(0, 2 * Math.PI);   // rotation angle
    const noise = rand(0.02, 0.2);       // noise magnitude (in normalized units)
    const n_trn_x = rand(-10, 10);
    const n_trn_y = rand(-10, 10);
    const transformed = points.map(p => {
        return transformPoint(p.x+n_trn_x, p.y+n_trn_y, scale, angle, noise);
    });

    return {
        s_name: o.s_name + '_transformed', // optional: rename
        a_o_point: transformed
    };
});
await saveShapesOverlay(a_o_shape, {
    filename: 'shapes_overlay.png',
    width: 1000,
    height: 1000,
    padding: 60,
    lineWidth: 3,
    fill: true,
    fillAlpha: 0.1,
    showPoints: true,
    pointRadius: 3,
    showOrigin: true,
    color: null,
    pointColor: '#333',
    caption: 'Generated shapes',
    captionFont: 'bold 28px sans-serif',
    captionColor: '#2C3E50'
});
await saveShapesOverlay(a_o_shape2, {
    filename: 'shapes2_overlay.png',
    width: 1000,
    height: 1000,
    padding: 60,
    lineWidth: 3,
    fill: true,
    fillAlpha: 0.1,
    showPoints: true,
    pointRadius: 3,
    showOrigin: true,
    color: null,
    pointColor: '#333',
    caption: 'Shapes with added random noise , translation, scale and rotation',
    captionFont: 'bold 28px sans-serif',
    captionColor: '#2C3E50'
});



console.log("OPA step 1a: calc center of mass ")

let a_o_shape2_centroid = a_o_shape2.map(o=>{

    let n_sum_x = 0
    let n_sum_y = 0
    
    for(let a_n of o.a_o_point){
        
        n_sum_x+=a_n.x
        n_sum_y+=a_n.y
    }
    o.o_centroid = {
        x:n_sum_x/o.a_o_point.length,
        y: n_sum_y/o.a_o_point.length,
    }
    // transform by center of mass
    return o
})
await saveShapesOverlay(a_o_shape2_centroid, {
    filename: 'shapes_with_center.png',
    width: 1000,
    height: 1000,
    padding: 60,
    fill: true,
    fillAlpha: 0.1,
    showPoints: true,
    pointRadius: 3,
    showOrigin: true,
    caption: 'OPA step 1a: find centroid',

});

console.log("OPA step 1b: translate by center of mass ")

let a_o_shape2_centroid_translated = a_o_shape2.map(o=>{

    o.a_o_point = o.a_o_point.map(o_point =>{
        let o_point2 = {
            x:o_point.x-o.o_centroid.x,
            y:o_point.y-o.o_centroid.y,
        }
        console.log({o_point,o_point2})
        return o_point2
    })
    return o
})
await saveShapesOverlay(a_o_shape2_centroid_translated, {
    filename: 'shapes_with_center2.png',
    width: 1000,
    height: 1000,
    padding: 60,
    fill: true,
    fillAlpha: 0.1,
    showPoints: true,
    pointRadius: 3,
    showOrigin: true,
    caption: 'OPA step 1a: translate by centroid',

});
