const fs = require('fs');
const path = require('path');
process.chdir(__dirname);
const OUT = path.join(__dirname, '..', 'public', 'gym');
const crypto = require('crypto');
const js = ['data', 'engine', 'ui', 'views', 'actions'].map(f => fs.readFileSync(`src/${f}.js`, 'utf8')).join('\n');
const body = fs.readFileSync('src/shell.html', 'utf8').replace('/*__APP__*/', () => js);
const splash = fs.existsSync('splash-links.html') ? fs.readFileSync('splash-links.html', 'utf8') : '';
const fonts = fs.readFileSync('src/fonts.css', 'utf8');
const pwaHead = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<title>Gym</title>
<meta name="description" content="Personal gym tracker: programme, set logging, progression coaching and records.">
<meta name="theme-color" content="#0D0F13">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Gym">
<meta name="application-name" content="Gym">
<meta name="format-detection" content="telephone=no">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" href="icons/favicon.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
${splash}
<style>${fonts}
html{background:#0D0F13}</style>
</head>
<body>
`;
fs.mkdirSync(OUT, { recursive: true });
const html = pwaHead + body + '\n</body>\n</html>\n';
fs.writeFileSync(path.join(OUT, 'index.html'), html);
const version = crypto.createHash('sha1').update(html).digest('hex').slice(0, 10);
fs.writeFileSync(path.join(OUT, 'sw.js'), fs.readFileSync('src/sw.js', 'utf8').replace('__VERSION__', version));
fs.writeFileSync(path.join(OUT, 'manifest.webmanifest'), JSON.stringify({
  name: 'Gym', short_name: 'Gym', description: 'Personal gym tracker', id: './', start_url: './', scope: './',
  display: 'standalone', orientation: 'portrait', background_color: '#0D0F13', theme_color: '#0D0F13',
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2));
console.log('built public/gym/index.html', html.length, 'version', version);
