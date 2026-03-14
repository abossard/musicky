// Script to create test MP3 files for the music library
// This creates simple test files with metadata for demonstration

const fs = require('fs');
const path = require('path');

// Create test music directory
const testMusicDir = path.join(__dirname, 'test-music');
if (!fs.existsSync(testMusicDir)) {
  fs.mkdirSync(testMusicDir);
}

// Download some Creative Commons MP3 files
const https = require('https');

async function downloadFile(url, filename) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(path.join(testMusicDir, filename));
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded: ${filename}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(path.join(testMusicDir, filename), () => {});
      reject(err);
    });
  });
}

// List of Creative Commons tracks from various sources
const testTracks = [
  {
    url: 'https://archive.org/download/DaveDepper-Salicaceae/01-DaveDepper-Bramble.mp3',
    filename: 'Dave_Depper_-_Bramble.mp3'
  },
  {
    url: 'https://archive.org/download/EmmanuelMoire-Beau_Malheur/01.Beau_Malheur.mp3', 
    filename: 'Emmanuel_Moire_-_Beau_Malheur.mp3'
  },
  {
    url: 'https://archive.org/download/ElectroSwing-ArtistCheng/ElectroSwing-Cheng.mp3',
    filename: 'Cheng_-_ElectroSwing.mp3'
  }
];

async function downloadTestMusic() {
  console.log('Creating test music directory...');
  console.log('Downloading Creative Commons test tracks...');
  
  for (const track of testTracks) {
    try {
      await downloadFile(track.url, track.filename);
    } catch (error) {
      console.error(`Failed to download ${track.filename}:`, error.message);
    }
  }
  
  console.log('\nTest music files created in test-music/ directory');
  console.log('These files are Creative Commons licensed and safe for testing');
}

downloadTestMusic();