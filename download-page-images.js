import https from 'https';
import fs from 'fs';
import path from 'path';

const PEXELS_API_KEY = '34bnCdunaiGUOBl9tVdJddI77uK4FfRxZNoZ2FkRLQWBc26wUaVTmQ51';

const pageImages = {
  about: [
    { name: 'mission', keyword: 'business mission vision strategy' },
    { name: 'heritage', keyword: 'company history insurance legacy' },
    { name: 'teamwork', keyword: 'team collaboration professional' }
  ],
  carriers: [
    { name: 'health-insurance', keyword: 'health insurance medical coverage' },
    { name: 'supplemental', keyword: 'insurance supplement protection' },
    { name: 'retirement', keyword: 'retirement planning 401k savings' },
    { name: 'voluntary-benefits', keyword: 'employee benefits wellness' }
  ]
};

async function downloadImage(url, filename, outputDir) {
  return new Promise((resolve, reject) => {
    const filepath = path.join(outputDir, filename);
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

async function downloadPageImages() {
  console.log('📥 Downloading page images from Pexels...\n');

  for (const [page, images] of Object.entries(pageImages)) {
    const outputDir = `./src/assets/images/${page}`;
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`\n📄 Downloading ${page.toUpperCase()} images...`);
    
    for (const image of images) {
      try {
        console.log(`🔍 Searching for: "${image.keyword}"...`);
        const imageUrl = await fetchPexelsImage(image.keyword);
        await downloadImage(imageUrl, `${image.name}.jpg`, outputDir);
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`⚠️  Failed to download ${image.name}:`, error.message);
      }
    }
  }

  console.log('\n✨ All image downloads complete!');
}

downloadPageImages().catch(console.error);
