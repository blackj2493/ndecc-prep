// GitHub Pages serves 404.html for unknown paths. A copy of the app page lets deep links
// such as /ndecc-prep/plan open the app instead of an error page.
const fs = require('fs');
const path = require('path');
const dist = path.join(__dirname, '..', 'dist');
fs.copyFileSync(path.join(dist, 'index.html'), path.join(dist, '404.html'));
console.log('postbuild-web: wrote dist/404.html');
