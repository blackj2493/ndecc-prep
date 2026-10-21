// Fixes the web export for GitHub Pages.
const fs = require('fs');
const path = require('path');
const dist = path.join(__dirname, '..', 'dist');

// 1. The gh-pages publisher skips every folder named node_modules, so fonts and images that
//    Expo exports under assets/node_modules/ (the icon font!) would 404. Move them and
//    rewrite every reference.
const from = path.join(dist, 'assets', 'node_modules');
if (fs.existsSync(from)) {
  fs.renameSync(from, path.join(dist, 'assets', 'vendor'));
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      return e.isDirectory() ? walk(p) : [p];
    });
  let n = 0;
  for (const f of walk(dist).filter((f) => /\.(js|html|json|css)$/.test(f))) {
    const s = fs.readFileSync(f, 'utf8');
    const t = s.split('/assets/node_modules/').join('/assets/vendor/');
    if (t !== s) {
      fs.writeFileSync(f, t);
      n++;
    }
  }
  console.log(`postbuild-web: moved assets/node_modules to assets/vendor (${n} files rewritten)`);
}

// 2. GitHub Pages serves 404.html for unknown paths. A copy of the app page lets deep links
//    such as /ndecc-prep/plan open the app instead of an error page.
fs.copyFileSync(path.join(dist, 'index.html'), path.join(dist, '404.html'));
console.log('postbuild-web: wrote dist/404.html');
