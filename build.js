/**
 * Build script for Quick Nav Tab Chrome Extension
 * 
 * This script helps package the extension for Chrome Web Store submission
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Create directory for builds if it doesn't exist
const buildDir = path.join(__dirname, 'build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir);
}

// Create a file to stream archive data to
const output = fs.createWriteStream(path.join(buildDir, 'quick-nav-tab.zip'));
const archive = archiver('zip', {
  zlib: { level: 9 } // Set compression level
});

// Listen for all archive data to be written
output.on('close', function() {
  console.log(`✅ Archive created successfully: ${archive.pointer()} total bytes`);
  console.log('📦 The zip file is ready in the build directory');
});

// Catch warnings and errors
archive.on('warning', function(err) {
  if (err.code === 'ENOENT') {
    console.warn('⚠️ Warning:', err);
  } else {
    throw err;
  }
});

archive.on('error', function(err) {
  throw err;
});

// Pipe archive data to the file
archive.pipe(output);

// Files and directories to include
const filesToInclude = [
  'index.html',
  'manifest.json',
  'privacy-policy.html',
  'README.md',
  'README_EN.md',
  'supabase-init.sql',
  'store-listing.md',
  'icons',
  'js',
  'styles',
  'fonts'
];

// Files to exclude from js directory
const jsFilesToExclude = [
  'js/config-manager.js' // 已废弃，功能合并到theme-config-manager.js
];

// Add each file/directory to the archive
filesToInclude.forEach(item => {
  const itemPath = path.join(__dirname, item);
  
  if (fs.lstatSync(itemPath).isDirectory()) {
    // Add a directory
    archive.directory(itemPath, item);
  } else {
    // Add a file
    archive.file(itemPath, { name: item });
  }
});

// Finalize the archive
archive.finalize();

console.log('🔄 Building extension package...'); 