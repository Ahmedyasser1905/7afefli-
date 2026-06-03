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

    // Replace various specific instances of 'any'
    content = content.replace(/catch\s*\(\s*err\s*:\s*any\s*\)/g, 'catch (err: unknown)');
    content = content.replace(/catch\s*\(\s*error\s*:\s*any\s*\)/g, 'catch (error: unknown)');
    content = content.replace(/catch\s*\(\s*e\s*:\s*any\s*\)/g, 'catch (e: unknown)');
    
    // Replace <any> or <any[]>
    content = content.replace(/<any\s*>/g, '<Record<string, unknown>>');
    content = content.replace(/<any\s*\[\s*\]\s*>/g, '<Record<string, unknown>[]>');
    content = content.replace(/<any\s*,\s*any>/g, '<Record<string, unknown>, Record<string, unknown>>');
    content = content.replace(/<any>/g, '<Record<string, unknown>>');

    // Replace specific variable types
    content = content.replace(/reservation:\s*any/g, 'reservation: Record<string, unknown>');
    content = content.replace(/salon:\s*any/g, 'salon: Record<string, unknown>');
    content = content.replace(/profileData:\s*any/g, 'profileData: Record<string, unknown>');
    content = content.replace(/style\?:\s*any/g, 'style?: unknown');
    content = content.replace(/event:\s*any/g, 'event: unknown');
    content = content.replace(/data:\s*any/g, 'data: Record<string, unknown>');
    content = content.replace(/payload:\s*any/g, 'payload: Record<string, unknown>');
    content = content.replace(/item:\s*any/g, 'item: Record<string, unknown>');
    
    // Replace (any) callbacks
    content = content.replace(/\(\s*item\s*:\s*any\s*\)/g, '(item: Record<string, unknown>)');
    content = content.replace(/\(\s*val\s*:\s*any\s*\)/g, '(val: unknown)');

    // Fallback: simple `: any` replacements
    content = content.replace(/:\s*any\s*;/g, ': unknown;');
    content = content.replace(/:\s*any\s*=/g, ': unknown =');
    content = content.replace(/:\s*any\s*\[\s*\]/g, ': unknown[]');

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Modified:', filePath);
    }
  }
});
