const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(dirPath);
  });
}

walk(path.join(__dirname, '../apps/mobile/src'), (filePath) => {
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Remove console.log calls
    content = content.replace(/console\.log\([^;]+\);?/g, '');
    
    // Some console.logs might span multiple lines, let's just use a more robust regex if needed, or just run it twice.
    
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Removed console.log from:', filePath);
    }
  }
});
