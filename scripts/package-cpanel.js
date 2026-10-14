// Build upload-ready bundles for cPanel hosting. See docs/CPANEL_DEPLOY.md.
//   npm run package:cpanel
// Output (deploy/cpanel/):
//   frontend/      -> upload into app.<domain> document root
//   backend/       -> upload into the Node.js App root (api.<domain>)
//   upload-redirect/.htaccess -> upload.<domain> document root
//   *.zip          -> zipped copies of frontend/ and backend/ (when tar is available)
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'deploy', 'cpanel')
const frontendDir = path.join(outDir, 'frontend')
const backendDir = path.join(outDir, 'backend')
const redirectDir = path.join(outDir, 'upload-redirect')

// Backend runtime deps only — keeps `npm install` on the host light (no Vite/React/TinyMCE).
const BACKEND_DEPS = [
  '@aws-sdk/client-s3',
  '@aws-sdk/lib-storage',
  '@aws-sdk/s3-request-presigner',
  'bcryptjs',
  'cors',
  'dotenv',
  'express',
  'express-rate-limit',
  'helmet',
  'jsonwebtoken',
  'morgan',
  'multer',
  'mysql2',
  'nodemailer',
  'socket.io',
]

const SPA_HTACCESS = `# React SPA (BrowserRouter): serve index.html for every non-file path
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>

# Hashed assets can be cached long-term; index.html must always revalidate
<IfModule mod_headers.c>
  <FilesMatch "\\.(js|css|woff2?|png|jpg|jpeg|svg|webp|ico)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
  <FilesMatch "index\\.html$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
</IfModule>
`

const fail = (msg) => {
  console.error(`❌ ${msg}`)
  process.exit(1)
}

const envFile = path.join(root, '.env.cpanel')
if (!fs.existsSync(envFile)) {
  fail('Thiếu file .env.cpanel — copy từ .env.cpanel.example rồi điền VITE_API_URL / VITE_UPLOAD_API_URL')
}
const apiMatch = fs.readFileSync(envFile, 'utf8').match(/^VITE_API_URL=(.+)$/m)
const apiUrl = apiMatch ? apiMatch[1].trim().replace(/\/+$/, '') : ''
if (!apiUrl) fail('.env.cpanel chưa có VITE_API_URL')

fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })

console.log('🏗️  Building frontend (vite --mode cpanel)...')
execSync(`npx vite build --mode cpanel --outDir "${frontendDir}" --emptyOutDir`, { cwd: root, stdio: 'inherit' })
fs.writeFileSync(path.join(frontendDir, '.htaccess'), SPA_HTACCESS)

console.log('📦 Copying backend...')
fs.cpSync(path.join(root, 'server'), path.join(backendDir, 'server'), { recursive: true })
fs.copyFileSync(path.join(root, 'app.cjs'), path.join(backendDir, 'app.cjs'))
fs.mkdirSync(path.join(backendDir, 'keys'), { recursive: true })
for (const sub of ['icons', 'receipts', 'releases', 'attachments']) {
  fs.mkdirSync(path.join(backendDir, 'uploads', sub), { recursive: true })
}

const rootPkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const dependencies = {}
for (const name of BACKEND_DEPS) {
  if (!rootPkg.dependencies[name]) fail(`package.json thiếu dependency ${name}`)
  dependencies[name] = rootPkg.dependencies[name]
}
const backendPkg = {
  name: `${rootPkg.name}-server`,
  private: true,
  version: rootPkg.version,
  type: 'module',
  main: 'app.cjs',
  engines: { node: '>=20' },
  scripts: { start: 'node server/index.js', cron: 'node server/cron.js' },
  dependencies,
}
fs.writeFileSync(path.join(backendDir, 'package.json'), JSON.stringify(backendPkg, null, 2) + '\n')
fs.copyFileSync(path.join(root, '.env.example'), path.join(backendDir, '.env.example'))

// upload.<domain>: old download links (upload.<domain>/app-code.zip) -> same path on the API
fs.mkdirSync(redirectDir, { recursive: true })
fs.writeFileSync(
  path.join(redirectDir, '.htaccess'),
  `# Chuyển mọi request của upload.* sang API (giữ nguyên đường dẫn)\nRewriteEngine On\nRewriteRule ^(.*)$ ${apiUrl}/$1 [R=302,L]\n`
)

for (const name of ['frontend', 'backend']) {
  try {
    execSync(`tar -a -c -f "${name}.zip" -C "${name}" .`, { cwd: outDir, stdio: 'ignore' })
    console.log(`🗜️  deploy/cpanel/${name}.zip`)
  } catch {
    console.warn(`⚠️ Không tạo được ${name}.zip (tar không hỗ trợ zip) — tự nén thư mục deploy/cpanel/${name}`)
  }
}

console.log('\n✅ Xong. Làm tiếp theo docs/CPANEL_DEPLOY.md')
