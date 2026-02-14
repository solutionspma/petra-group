import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Utility function to recursively copy directories
function copyDirectory(src, dest) {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  // Read all files/folders in source directory
  const files = fs.readdirSync(src);

  files.forEach((file) => {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);

    // Check if it's a directory
    if (fs.statSync(srcPath).isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      // Copy file
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

// Clear dist directory
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true });
}

// Create dist directory
fs.mkdirSync(distDir, { recursive: true });

// Copy all assets
console.log('📋 Building Petra Group static site...');

try {
  // Copy pages
  copyDirectory(path.join(__dirname, 'src/pages'), path.join(distDir));
  console.log('✅ Pages copied');

  // Copy CSS
  copyDirectory(path.join(__dirname, 'src/css'), path.join(distDir, 'css'));
  console.log('✅ Styles copied');

  // Copy JavaScript
  copyDirectory(path.join(__dirname, 'src/js'), path.join(distDir, 'js'));
  console.log('✅ Scripts copied');

  // Copy data files
  copyDirectory(path.join(__dirname, 'src/data'), path.join(distDir, 'data'));
  console.log('✅ Data files copied');

  // Copy assets
  if (fs.existsSync(path.join(__dirname, 'src/assets'))) {
    copyDirectory(path.join(__dirname, 'src/assets'), path.join(distDir, 'assets'));
    console.log('✅ Assets copied');
  }

  console.log('\n✨ Build complete! ✨');
  console.log(`📁 Output directory: ${distDir}`);
  console.log('\n🚀 Ready for deployment!');
  console.log('   → Upload /dist to your web server');
  console.log('   → GoDaddy File Manager: Use FTP or Web Interface');
  console.log('   → DNS: Point to your hosted files');

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
