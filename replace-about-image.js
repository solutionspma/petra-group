import https from 'https';
import fs from 'fs';
import path from 'path';

const PEXELS_API_KEY = '34bnCdunaiGUOBl9tVdJddI77uK4FfRxZNoZ2FkRLQWBc26wUaVTmQ51';
const OUTPUT_DIR = './src/assets/images/about';

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

async function replaceImage() {
  console.log('📥 Replacing about page mission image...\n');

  try {
    console.log('🔍 Searching for corporate culture/company image...');
    const imageUrl = await fetchPexelsImage('corporate company culture office professional');
    await downloadImage(imageUrl, 'mission.jpg');
    console.log('\n✨ Mission image replaced successfully!');
  } catch (error) {
    console.error(`❌ Failed to replace image:`, error.message);
  }
}

replaceImage().catch(console.error);
