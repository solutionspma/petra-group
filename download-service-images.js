import https from 'https';
import fs from 'fs';
import path from 'path';

const PEXELS_API_KEY = '34bnCdunaiGUOBl9tVdJddI77uK4FfRxZNoZ2FkRLQWBc26wUaVTmQ51';
const OUTPUT_DIR = './src/assets/images/services';

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const serviceImages = [
  { name: 'cafeteria-plan', keyword: 'tax planning financial benefits' },
  { name: 'flexible-spending', keyword: 'healthcare savings account' },
  { name: 'cobra-admin', keyword: 'health insurance coverage' },
  { name: 'benefits-communication', keyword: 'employee education meeting' },
  { name: 'enrollment-platform', keyword: 'digital enrollment workplace' },
  { name: 'retirement-planning', keyword: 'retirement savings investment' },
  { name: 'medical-plans', keyword: 'health insurance protection' },
  { name: 'compliance-admin', keyword: 'business compliance documentation' },
  { name: 'call-center', keyword: 'customer service support team' }
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

async function downloadAllImages() {
  console.log('📥 Downloading service images from Pexels...\n');

  for (const service of serviceImages) {
    try {
      console.log(`🔍 Searching for: "${service.keyword}"...`);
      const imageUrl = await fetchPexelsImage(service.keyword);
      await downloadImage(imageUrl, `${service.name}.jpg`);
      // Add small delay to respect API rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`⚠️  Failed to download ${service.name}:`, error.message);
    }
  }

  console.log('\n✨ Image download complete!');
  console.log(`📁 Images saved to: ${path.resolve(OUTPUT_DIR)}`);
}

downloadAllImages().catch(console.error);
