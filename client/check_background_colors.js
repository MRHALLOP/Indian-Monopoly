import pkg from 'jimp';
const Jimp = pkg.Jimp || pkg;

async function checkBackground() {
  const baseDir = "C:\\Users\\choud\\.gemini\\antigravity\\brain\\0844a26f-cbc7-4b49-81e4-fb7161c4cc9c\\";
  const image = await Jimp.read(baseDir + "monopoly_man_tipping_hat_1781961769193.png");
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  const data = image.bitmap.data;
  
  // Let's sample the left margin (x < 150) and right margin (x > 900)
  // and see what colors are present and their counts
  const colors = {};
  
  const sample = (x, y) => {
    const idx = (y * width + x) * 4;
    const r = data[idx];
    const g = data[idx+1];
    const b = data[idx+2];
    const key = `${r},${g},${b}`;
    colors[key] = (colors[key] || 0) + 1;
  };
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < 150; x++) sample(x, y);
    for (let x = 900; x < width; x++) sample(x, y);
  }
  
  // Print top 10 colors
  const sorted = Object.entries(colors).sort((a, b) => b[1] - a[1]);
  console.log("Top colors in margins:");
  sorted.slice(0, 10).forEach(([color, count]) => {
    console.log(`color rgb(${color}): count=${count}`);
  });
}

checkBackground();
