const fs = require('fs');
const path = require('path');

// Paths
const buildPath = path.join(__dirname, '../build/contracts');
const frontendPath = path.join(__dirname, '../frontend/src/contracts');

// Create the frontend contracts directory if it doesn't exist
if (!fs.existsSync(frontendPath)) {
  fs.mkdirSync(frontendPath, { recursive: true });
  console.log(`Created directory: ${frontendPath}`);
}

// Copy all contract JSON files
const contractFiles = fs.readdirSync(buildPath).filter(file => file.endsWith('.json'));

contractFiles.forEach(file => {
  const sourcePath = path.join(buildPath, file);
  const destPath = path.join(frontendPath, file);
  
  fs.copyFileSync(sourcePath, destPath);
  console.log(`Copied ${file} to frontend contracts directory`);
});

console.log('All contracts successfully copied to frontend!'); 