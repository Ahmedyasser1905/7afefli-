import os

target_dir = 'C:/Users/dz laptops/Desktop/projets/Barber/apps/admin/app'

for root, dirs, files in os.walk(target_dir):
    for file in files:
        if file.endswith('.tsx'):
            file_path = os.path.join(root, file)
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            if '<a href=' in content:
                # Replace links
                content = content.replace('<a href=', '<Link href=')
                content = content.replace('</a>', '</Link>')
                
                # Add import if missing
                if 'import Link from' not in content:
                    content = "import Link from 'next/link';\n" + content
                
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"Updated {file_path}")
