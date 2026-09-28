import { mkdir, copyFile } from 'node:fs/promises';
const files = ['index.html', 'style.css', 'app.css', 'app.js', 'views.js', 'client.js', 'particles.js', 'favicon.svg', '404.html'];
await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
await Promise.all(files.map(file => copyFile(new URL(`../${file}`, import.meta.url), new URL(`../dist/${file}`, import.meta.url))));
console.log(`Built ${files.length} files → dist/`);
