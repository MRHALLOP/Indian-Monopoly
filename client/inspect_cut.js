import pkg from 'jimp';
const Jimp = pkg.Jimp || pkg;

async function inspect() {
  const baseDir = "C:\\Users\\choud\\.gemini\\antigravity\\brain\\0844a26f-cbc7-4b49-81e4-fb7161c4cc9c\\";
  const image = await Jimp.read(baseDir + "monopoly_man_sale_pure_1781963562087.png");
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  const data = image.bitmap.data;
  
  // Let's print out the actual RGB values in a grid around x=740 to 800, y=440 to 480
  // to see if the arm/hand outlines are present but white/grayish, or if they are completely missing.
  console.log("Grid values (R,G,B):");
  for (let y = 440; y < 490; y += 4) {
    let line = "";
    for (let x = 730; x < 800; x += 4) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx+1];
      const b = data[idx+2];
      
      if (r === 255 && g === 255 && b === 255) {
        line += " W ";
      } else {
        // print average value
        const avg = Math.floor((r + g + b) / 3);
        line += avg.toString().padStart(3, ' ');
      }
    }
    console.log(`${y}: ${line}`);
  }
}

inspect();
