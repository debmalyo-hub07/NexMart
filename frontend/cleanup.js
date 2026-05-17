const fs = require('fs');
const path = require('path');

const files = [
  'src/app/checkout/page.tsx',
  'src/app/orders/[id]/page.tsx',
  'src/app/search/page.tsx',
  'src/app/profile/page.tsx',
  'src/app/products/page.tsx',
  'src/app/products/[slug]/page.tsx',
  'src/app/orders/page.tsx',
  'src/app/page.tsx',
  'src/app/categories/[slug]/page.tsx',
  'src/app/cart/page.tsx',
  'src/app/about/page.tsx',
];

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Remove imports
    content = content.replace(/import\s+{\s*Navbar\s*}\s+from\s+['"]@\/components\/layout\/Navbar['"];?\r?\n?/g, '');
    content = content.replace(/import\s+{\s*Footer\s*}\s+from\s+['"]@\/components\/layout\/Footer['"];?\r?\n?/g, '');
    
    // Remove tags
    content = content.replace(/\s*<Navbar\s*\/>\r?\n?/g, '');
    content = content.replace(/\s*<Footer\s*\/>\r?\n?/g, '');
    
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Cleaned ${file}`);
  }
});
