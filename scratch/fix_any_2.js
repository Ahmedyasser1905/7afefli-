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

    content = content.replace(/\(\{\s*route\s*\}\s*:\s*any\)/g, '({ route }: { route: Record<string, unknown> })');
    content = content.replace(/\(\{\s*focused\s*,\s*color\s*\}\s*:\s*any\)/g, '({ focused, color }: { focused: boolean, color: string })');
    content = content.replace(/\(s:\s*any\)/g, '(s: Record<string, unknown>)');
    content = content.replace(/\(u:\s*any\)/g, '(u: Record<string, unknown>)');
    content = content.replace(/\(err:\s*any\)/g, '(err: Error)');
    content = content.replace(/\(\{ route, navigation \}:\s*any\)/g, '({ route, navigation }: { route: Record<string, unknown>, navigation: Record<string, unknown> })');
    content = content.replace(/\(\{ navigation \}:\s*any\)/g, '({ navigation }: { navigation: Record<string, unknown> })');
    content = content.replace(/\(reservation\s*as\s*any\)/g, '(reservation as Record<string, unknown>)');
    content = content.replace(/\(statusIcon\s*as\s*any\)/g, '(statusIcon as unknown)');
    content = content.replace(/\(res:\s*any\)/g, '(res: Record<string, unknown>)');
    content = content.replace(/\(r\s*as\s*any\)/g, '(r as Record<string, unknown>)');
    content = content.replace(/\(service:\s*any\)/g, '(service: Record<string, unknown>)');
    content = content.replace(/\(photo:\s*any\)/g, '(photo: Record<string, unknown>)');
    content = content.replace(/\(member:\s*any\)/g, '(member: Record<string, unknown>)');
    content = content.replace(/\(review:\s*any\)/g, '(review: Record<string, unknown>)');
    content = content.replace(/\(salon\s*as\s*any\)/g, '(salon as Record<string, unknown>)');
    content = content.replace(/\(r:\s*any\)/g, '(r: Record<string, unknown>)');
    content = content.replace(/\(response:\s*any\)/g, '(response: Record<string, unknown>)');
    content = content.replace(/as\s*any;/g, 'as unknown;');
    content = content.replace(/as\s*any\)/g, 'as unknown)');
    content = content.replace(/role\s*as\s*any/g, 'role as unknown');

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Modified:', filePath);
    }
  }
});
