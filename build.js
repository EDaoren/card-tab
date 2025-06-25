/**
 * Build script for Card Tab Chrome Extension
 *
 * This script helps package the extension for Chrome Web Store submission
 * Uses Node.js built-in modules only (no external dependencies)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Create directory for builds if it doesn't exist
const buildDir = path.join(__dirname, 'build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir);
}

console.log('🔄 Building extension package...');

// Files and directories to include
const filesToInclude = [
  'index.html',
  'manifest.json',
  'privacy-policy.html',
  'README.md',
  'README_EN.md',
  'supabase-init.sql',
  'icons',
  'js',
  'styles',
  'fonts'
];

// Files to exclude (test files, development files, etc.)
const filesToExclude = [
  'test-local-font.html',
  'test-offline.html',
  'test-performance.html',
  'test-supabase-fix.html',
  'build.js',
  'package.json',
  'package-lock.json',
  'node_modules',
  '.git',
  '.gitignore',
  'build',
  'verify-csp-compliance.js',
  'csp-violations-report.json'
];

/**
 * Copy files to build directory
 */
function copyFiles() {
  const tempDir = path.join(buildDir, 'temp');

  // Create temp directory
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  // Copy included files
  filesToInclude.forEach(item => {
    const sourcePath = path.join(__dirname, item);
    const destPath = path.join(tempDir, item);

    if (!fs.existsSync(sourcePath)) {
      console.warn(`⚠️ Warning: ${item} not found, skipping...`);
      return;
    }

    if (fs.lstatSync(sourcePath).isDirectory()) {
      // Copy directory recursively
      copyDirectory(sourcePath, destPath);
    } else {
      // Copy file
      fs.copyFileSync(sourcePath, destPath);
    }

    console.log(`✅ Copied: ${item}`);
  });

  return tempDir;
}

/**
 * Copy directory recursively
 */
function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Create zip file using system command
 */
function createZip(sourceDir) {
  const zipPath = path.join(buildDir, 'card-tab.zip');

  // Remove existing zip file
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  try {
    // Try PowerShell Compress-Archive first (Windows)
    const powershellCmd = `powershell -Command "Compress-Archive -Path '${sourceDir}\\*' -DestinationPath '${zipPath}' -Force"`;
    execSync(powershellCmd, { stdio: 'pipe' });
    console.log('✅ Created zip using PowerShell Compress-Archive');
  } catch (error) {
    try {
      // Fallback to 7zip if available
      const sevenZipCmd = `7z a "${zipPath}" "${sourceDir}\\*"`;
      execSync(sevenZipCmd, { stdio: 'pipe' });
      console.log('✅ Created zip using 7zip');
    } catch (error2) {
      // Manual zip creation using Node.js
      console.log('⚠️ System zip tools not available, creating manual archive...');
      createManualZip(sourceDir, zipPath);
    }
  }

  return zipPath;
}

/**
 * Create zip manually using Node.js (fallback)
 */
function createManualZip(sourceDir, zipPath) {
  // This is a simplified approach - in production you might want to use a library
  console.log('📦 Manual zip creation not implemented. Please install 7zip or use PowerShell.');
  console.log(`📁 Files are ready in: ${sourceDir}`);
  console.log('💡 You can manually create a zip file from the temp directory.');
}

// Main build process
try {
  console.log('📦 Copying files...');
  const tempDir = copyFiles();

  console.log('🗜️ Creating zip archive...');
  const zipPath = createZip(tempDir);

  if (fs.existsSync(zipPath)) {
    const stats = fs.statSync(zipPath);
    console.log(`✅ Archive created successfully: ${Math.round(stats.size / 1024)} KB`);
    console.log(`📦 The zip file is ready: ${zipPath}`);
  }

  // Clean up temp directory
  console.log('🧹 Cleaning up...');
  fs.rmSync(tempDir, { recursive: true, force: true });

  console.log('🎉 Build completed successfully!');

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}