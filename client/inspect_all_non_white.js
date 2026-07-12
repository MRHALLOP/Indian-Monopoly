import pkg from 'jimp';
const Jimp = pkg.Jimp || pkg;

async function check() {
  const baseDir = "C:\\Users\\choud\\.gemini\\antigravity\\brain\\0844a26f-cbc7-4b49-81e4-fb7161c4cc9c\\";
  const image = await Jimp.read(baseDir + "monopoly_man_sale_pure_1781963562087.png");
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  const data = image.bitmap.data;
  
  console.log("Checking all pixels at x >= 750 that are not pure white (255,255,255)...");
  
  let nonWhiteByX = {};
  for (let x = 750; x < width; x++) {
    nonWhiteByX[x] = 0;
    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx+1];
      const b = data[idx+2];
      if (r < 255 || g < 255 || b < 255) {
        nonWhiteByX[x]++;
      }
    }
  }
  
  for (let x = 750; x < width; x += 10) {
    if (nonWhiteByX[x] > 0) {
      console.log(`x=${x}: ${nonWhiteByX[x]} non-white pixels`);
    }
  }
}

check();
