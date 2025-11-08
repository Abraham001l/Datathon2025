import { copyFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const sourceDir = join(__dirname, 'node_modules', '@pdftron', 'webviewer', 'public')
const destDir = join(__dirname, 'public', 'webviewer', 'lib')

function copyRecursive(src, dest) {
  if (!existsSync(src)) {
    console.error(`Source directory does not exist: ${src}`)
    console.log('Please make sure @pdftron/webviewer is installed: npm install')
    process.exit(1)
  }

  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true })
  }

  const entries = readdirSync(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = join(src, entry.name)
    const destPath = join(dest, entry.name)

    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath)
    } else {
      copyFileSync(srcPath, destPath)
    }
  }
}

console.log('Copying PDFTron WebViewer files...')
console.log(`From: ${sourceDir}`)
console.log(`To: ${destDir}`)

try {
  copyRecursive(sourceDir, destDir)
  console.log('✓ PDFTron WebViewer files copied successfully!')
} catch (error) {
  console.error('Error copying files:', error)
  process.exit(1)
}

