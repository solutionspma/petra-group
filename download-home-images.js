import https from 'https';
import fs from 'fs';
import path from 'path';

const PEXELS_API_KEY = '34bnCdunaiGUOBl9tVdJddI77uK4FfRxZNoZ2FkRLQWBc26wUaVTmQ51';
const OUTPUT_DIR = './src/assets/images/home';

const homeImages = [
  { name: 'hero', keyword: 'professional business office building modern' },
  { name: 'protection', keyword: 'security protection shield safety' },
  { name: 'education', keyword: 'education learning knowledge books study' },
  { name: 'teamwork', keyword: 'teamwork collaboration business team together' },
  { name: 'relationship', keyword: 'trust partnership handshake professional' },
  { name: 'accuracy', keyword: 'precision accuracy quality detail focus' }
];

async function downloadImage(url, filename) {
  return new Promise((resolve, reject) => {
    const filepath = path.join(OUTPUT_DIR, filename);
    const file = fs.createWriteStream(filepath);

    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`✅ Downloaded: ${filename}`);
        resolve(filename);
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {});
      console.error(`❌ Error downloading ${filename}:`, err.message);
      reject(err);
    });
  });
}

async function fetchPexelsImage(keyword) {
  return new Promise((resolve, reject) => {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(keyword)}&per_page=1&page=${Math.floor(Math.random() * 10)}`;

    https.get(url, {
      headers: { Authorization: PEXELS_API_KEY }
    }, (response) => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.photos && json.photos.length > 0) {
            resolve(json.photos[0].src.large);
          } else {
            reject(new Error('No photos found'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function downloadHomeImages() {
  console.log('📥 Downloading homepage images from Pexels...\n');
  console.log('🎯 Carefully selecting professional, high-quality images...\n');

  for (const image of homeImages) {
    try {
      console.log(`🔍 "${image.name}": Searching for "${image.keyword}"...`);
      const imageUrl = await fetchPexelsImage(image.keyword);
      await downloadImage(imageUrl, `${image.name}.jpg`);
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`⚠️  Failed to download ${image.name}:`, error.message);
    }
  }

  console.log('\n✨ Homepage image downloads complete!');
  console.log(`📁 Images saved to: ${path.resolve(OUTPUT_DIR)}`);
  console.log('\n💡 Images are now ready to be integrated into the homepage.');
}

downloadHomeImages().catch(console.error);
