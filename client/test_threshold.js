import pkg from 'jimp';
const Jimp = pkg.Jimp || pkg;

async function cleanWithThreshold(sourcePath, destPath, threshold) {
  const image = await Jimp.read(sourcePath);
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  const data = image.bitmap.data;

  const getIdx = (x, y) => (y * width + x) * 4;
  const visited = new Uint8Array(width * height);
  const queue = [];

  for (let x = 0; x < width; x++) {
    queue.push([x, 0]);
    visited[0 * width + x] = 1;
    queue.push([x, height - 1]);
    visited[(height - 1) * width + x] = 1;
  }
  for (let y = 0; y < height; y++) {
    queue.push([0, y]);
    visited[y * width + 0] = 1;
    queue.push([width - 1, y]);
    visited[y * width + (width - 1)] = 1;
  }

  let head = 0;
  while (head < queue.length) {
    const [cx, cy] = queue[head++];
    const idx = getIdx(cx, cy);

    const r = data[idx + 0];
    const g = data[idx + 1];
    const b = data[idx + 2];

    const isGrayish = Math.max(r, g, b) - Math.min(r, g, b) < 30;
    const isLight = r > threshold && g > threshold && b > threshold;

    if (isLight && isGrayish) {
      data[idx + 3] = 0;

      const neighbors = [
        [cx + 1, cy],
        [cx - 1, cy],
        [cx, cy + 1],
        [cx, cy - 1]
      ];

      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const vIdx = ny * width + nx;
          if (!visited[vIdx]) {
            visited[vIdx] = 1;
            queue.push([nx, ny]);
          }
        }
      }
    }
  }

  await image.write(destPath);
  
  // Verify
  const bgIdx = (10 * width + 10) * 4;
  const gloveIdx = (520 * width + 750) * 4;
  console.log(`Threshold ${threshold}:`);
  console.log(`  Background pixel (10,10) alpha: ${data[bgIdx+3]}`);
  console.log(`  Glove pixel (750,520) alpha: ${data[gloveIdx+3]}`);
}

async function run() {
  const baseDir = "C:\\Users\\choud\\.gemini\\antigravity\\brain\\0844a26f-cbc7-4b49-81e4-fb7161c4cc9c\\";
  await cleanWithThreshold(
    baseDir + "monopoly_man_sale_pure_1781963562087.png",
    "./client/public/test_sale_t248.png",
    248
  );
}

run();
