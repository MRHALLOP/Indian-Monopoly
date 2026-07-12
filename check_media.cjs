const sharp = require('sharp');
const fs = require('fs');

const mediaFiles = [
  'C:/Users/choud/.gemini/antigravity/brain/0844a26f-cbc7-4b49-81e4-fb7161c4cc9c/media__1781945832991.jpg',
  'C:/Users/choud/.gemini/antigravity/brain/0844a26f-cbc7-4b49-81e4-fb7161c4cc9c/media__1781946055128.jpg',
  'C:/Users/choud/.gemini/antigravity/brain/0844a26f-cbc7-4b49-81e4-fb7161c4cc9c/media__1781948464907.jpg'
];

async function checkFiles() {
  for (const file of mediaFiles) {
    if (fs.existsSync(file)) {
      const metadata = await sharp(file).metadata();
      console.log(`${file}: ${metadata.width}x${metadata.height}`);
      // Try to crop a 100x100 corner to verify what it is
      await sharp(file)
        .extract({ left: 0, top: 0, width: Math.min(200, metadata.width), height: Math.min(200, metadata.height) })
        .toFile(`corner_${file.split('/').pop()}`);
    } else {
      console.log(`Not found: ${file}`);
    }
  }
}

checkFiles().catch(console.error);
