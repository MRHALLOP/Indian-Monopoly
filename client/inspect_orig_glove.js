import pkg from 'jimp';
const Jimp = pkg.Jimp || pkg;

async function check() {
  const baseDir = "C:\\Users\\choud\\.gemini\\antigravity\\brain\\0844a26f-cbc7-4b49-81e4-fb7161c4cc9c\\";
  const image = await Jimp.read(baseDir + "monopoly_man_chest_pure_1781963582176.png");
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  const data = image.bitmap.data;
  
  console.log("Average color of 10x10 blocks:");
  for (let y = 400; y < 600; y += 20) {
    let line = "";
    for (let x = 700; x < 900; x += 20) {
      // Calculate average color in 10x10 block starting at x,y
      let sumR = 0, sumG = 0, sumB = 0, count = 0;
      for (let dy = 0; dy < 10; dy++) {
        for (let dx = 0; dx < 10; dx++) {
          const px = x + dx;
          const py = y + dy;
          if (px < width && py < height) {
            const idx = (py * width + px) * 4;
            sumR += data[idx];
            sumG += data[idx+1];
            sumB += data[idx+2];
            count++;
          }
        }
      }
      const r = Math.round(sumR / count);
      const g = Math.round(sumG / count);
      const b = Math.round(sumB / count);
      
      if (r > 245 && g > 245 && b > 245) {
        line += " [  W  ] ";
      } else {
        line += ` [${r.toString().padStart(3)},${g.toString().padStart(3)},${b.toString().padStart(3)}]`;
      }
    }
    console.log(`y=${y.toString().padStart(3)}: ${line}`);
  }
}

check();
