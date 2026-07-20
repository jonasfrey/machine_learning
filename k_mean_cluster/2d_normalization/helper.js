// helper.js
import { createCanvas } from "jsr:@gfx/canvas";

// ------------------------------------------------------------
// Internal: convert points to [[x, y], ...] regardless of input
// ------------------------------------------------------------
function toArrayPoints(points) {
    if (!points || points.length === 0) return [];
    // If first element is an array, assume it's already [[x,y], ...]
    if (Array.isArray(points[0])) return points;
    // Otherwise expect {x, y} objects
    return points.map(p => [p.x, p.y]);
}

// ------------------------------------------------------------
// Internal: draw a single shape (points are [x, y] arrays)
// ------------------------------------------------------------
function drawShapeOnContext(ctx, points, cx, cy, shapeSize, options = {}) {
    const {
        color = '#2196F3',
        lineWidth = 3,
        fill = false,
        fillColor = 'rgba(33,150,243,0.2)',
        showPoints = true,
        pointColor = '#FF0000',
        pointRadius = 4,
        showOrigin = true,
        originColor = '#ff5722',
        label = '',
        labelColor = '#333',
        labelFont = '16px sans-serif',
        debug = false,
        debugBorderColor = '#ccc'
    } = options;

    const pts = toArrayPoints(points);
    if (pts.length < 3) {
        console.warn('Skipping shape with < 3 points');
        return;
    }

    // Debug: cell border
    if (debug) {
        ctx.strokeStyle = debugBorderColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(cx - shapeSize/2, cy - shapeSize/2, shapeSize, shapeSize);
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy);
        ctx.lineTo(cx + 10, cy);
        ctx.moveTo(cx, cy - 10);
        ctx.lineTo(cx, cy + 10);
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Bounding box
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (const p of pts) {
        const x = p[0], y = p[1];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    }
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const maxRange = Math.max(rangeX, rangeY);

    const internalPadding = 0.1;
    const scale = (shapeSize * (1 - 2 * internalPadding)) / maxRange;
    const offsetX = cx - ((minX + maxX) / 2) * scale;
    const offsetY = cy - ((minY + maxY) / 2) * scale;

    const mapX = (x) => x * scale + offsetX;
    const mapY = (y) => y * scale + offsetY;

    // Outline
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
        const x = mapX(pts[i][0]);
        const y = mapY(pts[i][1]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();

    if (fill) {
        ctx.fillStyle = fillColor;
        ctx.fill();
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Points
    if (showPoints) {
        ctx.fillStyle = pointColor;
        for (const p of pts) {
            const x = mapX(p[0]);
            const y = mapY(p[1]);
            ctx.beginPath();
            ctx.arc(x, y, pointRadius, 0, 2 * Math.PI);
            ctx.fill();
        }
    }

    // Origin marker
    if (showOrigin) {
        const ox = mapX(0);
        const oy = mapY(0);
        ctx.beginPath();
        ctx.arc(ox, oy, 4, 0, 2 * Math.PI);
        ctx.fillStyle = originColor;
        ctx.fill();
    }

    // Label
    if (label) {
        ctx.fillStyle = labelColor;
        ctx.font = labelFont;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(label, cx, cy + shapeSize/2 + 6);
    }
}

// ------------------------------------------------------------
// Export: save a single shape
// ------------------------------------------------------------
export async function saveShapeAsImage(points, options = {}) {
    const {
        filename = 'shape.png',
        size = 500,
        color = '#2196F3',
        lineWidth = 3,
        fill = false,
        fillColor = 'rgba(33,150,243,0.2)',
        padding = 0.1,
        outputDir = '.',
        showPoints = true,
        pointColor = '#FF0000',
        pointRadius = 4,
        label = '',
        labelColor = '#333',
        labelFont = '16px sans-serif',
        debug = false
    } = options;

    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    const shapeSize = size * (1 - 2 * padding);
    drawShapeOnContext(ctx, points, size/2, size/2, shapeSize, {
        color, lineWidth, fill, fillColor,
        showPoints, pointColor, pointRadius,
        showOrigin: true, originColor: '#ff5722',
        label, labelColor, labelFont,
        debug
    });

    const fullPath = `${outputDir}/${filename}`;
    await Deno.mkdir(outputDir, { recursive: true });
    canvas.save(fullPath);
    console.log(`✅ Shape saved to: ${fullPath}`);
}

// ------------------------------------------------------------
// Export: save multiple shapes in a grid
// ------------------------------------------------------------
export async function saveMultipleShapesAsImage(shapes, options = {}) {
    const {
        filename = 'shapes_grid.png',
        outputDir = '.',
        shapeSize = 200,
        gap = 30,
        padding = 40,
        columns = null,
        lineWidth = 3,
        fill = false,
        fillAlpha = 0.15,
        showPoints = true,
        pointRadius = 4,
        showOrigin = true,
        labelFont = '14px sans-serif',
        labelColor = '#333',
        backgroundColor = '#ffffff',
        debug = true,
        debugBorderColor = '#e0e0e0'
    } = options;

    if (!shapes || shapes.length === 0) {
        throw new Error('No shapes provided');
    }

    // Log info
    console.log(`📊 Received ${shapes.length} shapes:`);
    shapes.forEach((s, i) => {
        const pts = s.a_o_point || s.points || [];
        console.log(`   ${i+1}. ${s.s_name || s.name || 'unnamed'} – ${pts.length} points`);
    });

    const n = shapes.length;
    const cols = columns || Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);

    const totalWidth = padding * 2 + cols * shapeSize + (cols - 1) * gap;
    const totalHeight = padding * 2 + rows * shapeSize + (rows - 1) * gap;

    const canvas = createCanvas(totalWidth, totalHeight);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    function randomVibrantColor() {
        const hue = Math.floor(Math.random() * 360);
        const sat = 70 + Math.floor(Math.random() * 30);
        const lig = 50 + Math.floor(Math.random() * 20);
        return `hsl(${hue}, ${sat}%, ${lig}%)`;
    }

    let drawnCount = 0;
    for (let i = 0; i < n; i++) {
        const shape = shapes[i];
        const points = shape.a_o_point || shape.points;
        const name = shape.s_name || shape.name || `shape_${i}`;

        if (!points || points.length < 3) {
            console.warn(`⚠️ Skipping "${name}" – insufficient points (${points?.length || 0})`);
            continue;
        }

        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = padding + col * (shapeSize + gap) + shapeSize / 2;
        const cy = padding + row * (shapeSize + gap) + shapeSize / 2;

        const color = shape.color || randomVibrantColor();
        const hueMatch = color.match(/\d+/);
        const hue = hueMatch ? parseInt(hueMatch[0]) : 200;
        const fillColor = shape.fillColor || `hsla(${hue}, 80%, 60%, ${fillAlpha})`;

        drawShapeOnContext(ctx, points, cx, cy, shapeSize, {
            color,
            lineWidth,
            fill,
            fillColor,
            showPoints,
            pointColor: '#FF0000',
            pointRadius,
            showOrigin,
            originColor: '#ff5722',
            label: name,
            labelColor,
            labelFont,
            debug,
            debugBorderColor
        });
        drawnCount++;
    }

    console.log(`🖌️ Drew ${drawnCount} out of ${n} shapes.`);

    const fullPath = `${outputDir}/${filename}`;
    await Deno.mkdir(outputDir, { recursive: true });
    canvas.save(fullPath);
    console.log(`✅ Grid saved to: ${fullPath}`);
}

// ------------------------------------------------------------
// NEW: save multiple shapes on one canvas using absolute coordinates
// ------------------------------------------------------------
// helper.js – corrected saveShapesOverlay
// helper.js – saveShapesOverlay with optional marker
// helper.js – saveShapesOverlay with per-shape centroid markers
export async function saveShapesOverlay(shapes, options = {}) {
    const {
        filename = 'shapes_overlay.png',
        outputDir = '.',
        width = 800,
        height = 800,
        padding = 40,
        lineWidth = 3,
        fill = false,
        fillAlpha = 0.15,
        showPoints = true,
        pointRadius = 4,
        showOrigin = true,
        labelFont = '14px sans-serif',
        labelColor = '#333',
        backgroundColor = '#ffffff',
        color = null,
        pointColor = '#FF0000',
        // Caption
        caption = '',
        captionFont = 'bold 24px sans-serif',
        captionColor = '#222',
        captionY = null,
        // NEW: centroid visualization options
        showCentroids = true,          // enable/disable all centroids
        centroidColor = '#00AA00',     // default color for centroids
        centroidRadius = 8,
        centroidLabel = true,          // show label with shape name? (or false)
        centroidLabelFont = '12px sans-serif',
        centroidLabelColor = '#333'
    } = options;

    if (!shapes || shapes.length === 0) {
        throw new Error('No shapes provided');
    }

    // Collect all points and shape info
    let allPoints = [];
    const shapeInfo = [];
    for (const shape of shapes) {
        const pts = toArrayPoints(shape.a_o_point || shape.points);
        if (!pts || pts.length < 3) {
            console.warn(`Skipping shape "${shape.s_name || shape.name}" – insufficient points`);
            continue;
        }
        allPoints = allPoints.concat(pts);
        shapeInfo.push({
            name: shape.s_name || shape.name || 'unnamed',
            points: pts,
            color: shape.color || null,
            centroid: shape.o_centroid || null   // store optional centroid
        });
    }

    if (allPoints.length === 0) {
        throw new Error('No valid shapes with points');
    }

    // Global bounding box
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (const p of allPoints) {
        const x = p[0], y = p[1];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    }
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    // Reserve space for caption if present
    const captionSpace = caption ? 60 : 0;
    const availableWidth = width - 2 * padding;
    const availableHeight = height - 2 * padding - captionSpace;
    const scale = Math.min(availableWidth / rangeX, availableHeight / rangeY);
    const centerX = width / 2;
    const centerY = (height + captionSpace) / 2;
    const offsetX = centerX - ((minX + maxX) / 2) * scale;
    const offsetY = centerY - ((minY + maxY) / 2) * scale;

    const mapX = (x) => x * scale + offsetX;
    const mapY = (y) => y * scale + offsetY;

    // Create canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Draw caption
    if (caption) {
        ctx.fillStyle = captionColor;
        ctx.font = captionFont;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const yPos = captionY !== null ? captionY : padding / 2;
        ctx.fillText(caption, width / 2, yPos);
    }

    // Draw each shape
    for (const info of shapeInfo) {
        const pts = info.points;
        const col = info.color || color || randomVibrantColor();
        const hueMatch = col.match(/\d+/);
        const hue = hueMatch ? parseInt(hueMatch[0]) : 200;
        const fillColor = `hsla(${hue}, 80%, 60%, ${fillAlpha})`;

        // Draw shape outline
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
            const x = mapX(pts[i][0]);
            const y = mapY(pts[i][1]);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();

        if (fill) {
            ctx.fillStyle = fillColor;
            ctx.fill();
        }
        ctx.strokeStyle = col;
        ctx.lineWidth = lineWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();

        // Draw points
        if (showPoints) {
            ctx.fillStyle = pointColor;
            for (const p of pts) {
                const x = mapX(p[0]);
                const y = mapY(p[1]);
                ctx.beginPath();
                ctx.arc(x, y, pointRadius, 0, 2 * Math.PI);
                ctx.fill();
            }
        }

        // ---- Draw centroid marker for this shape (if available) ----
        if (showCentroids && info.centroid) {
            const cx = mapX(info.centroid.x);
            const cy = mapY(info.centroid.y);
            const cColor = info.centroid.color || centroidColor;

            // Draw a filled circle
            ctx.beginPath();
            ctx.arc(cx, cy, centroidRadius, 0, 2 * Math.PI);
            ctx.fillStyle = cColor;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Crosshair inside
            ctx.beginPath();
            ctx.moveTo(cx - centroidRadius * 0.6, cy);
            ctx.lineTo(cx + centroidRadius * 0.6, cy);
            ctx.moveTo(cx, cy - centroidRadius * 0.6);
            ctx.lineTo(cx, cy + centroidRadius * 0.6);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Label (if enabled)
            if (centroidLabel) {
                const labelText = info.centroid.label || info.name + ' centroid';
                ctx.fillStyle = centroidLabelColor;
                ctx.font = centroidLabelFont;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'bottom';
                ctx.fillText(labelText, cx + centroidRadius + 6, cy - 4);
            }
        }
    }

    // Global origin marker
    if (showOrigin) {
        const ox = mapX(0);
        const oy = mapY(0);
        ctx.beginPath();
        ctx.arc(ox, oy, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#ff5722';
        ctx.fill();
        ctx.fillStyle = '#333';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText('Origin', ox + 8, oy - 2);
    }

    // Save
    const fullPath = `${outputDir}/${filename}`;
    await Deno.mkdir(outputDir, { recursive: true });
    canvas.save(fullPath);
    console.log(`✅ Overlay of ${shapeInfo.length} shapes saved to: ${fullPath}`);
}

// Helper: random vibrant color
function randomVibrantColor() {
    const hue = Math.floor(Math.random() * 360);
    const sat = 70 + Math.floor(Math.random() * 30);
    const lig = 50 + Math.floor(Math.random() * 20);
    return `hsl(${hue}, ${sat}%, ${lig}%)`;
}