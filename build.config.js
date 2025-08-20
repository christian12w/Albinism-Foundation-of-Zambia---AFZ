const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const NODE_ENV = process.env.NODE_ENV || 'production';
const BUILD_DIR = NODE_ENV === 'production' ? 'dist' : 'dev-build';

console.log(`🏗️ Building AFZ Advocacy App for ${NODE_ENV} environment`);
console.log(`📁 Output directory: ${BUILD_DIR}`);

// Clean build directory
if (fs.existsSync(BUILD_DIR)) {
    fs.rmSync(BUILD_DIR, { recursive: true, force: true });
    console.log(`🧹 Cleaned ${BUILD_DIR} directory`);
}

// Create build directory
fs.mkdirSync(BUILD_DIR, { recursive: true });

// Files and directories to copy
const copyItems = [
    'index.html',
    'dashboard.html',
    'debug-cache.html',
    'test-language.html',
    'manifest.json',
    'robots.txt',
    'sitemap.xml',
    'sw.js',
    'browserconfig.xml',
    '.htaccess',
    'web.config',
    'css/',
    'js/',
    'images/',
    'pages/',
    'translations/'
];

// Copy files and directories
copyItems.forEach(item => {
    const srcPath = path.join(__dirname, item);
    const destPath = path.join(__dirname, BUILD_DIR, item);

    if (fs.existsSync(srcPath)) {
        const stats = fs.statSync(srcPath);

        if (stats.isDirectory()) {
            // Copy directory recursively
            copyDirectory(srcPath, destPath);
            console.log(`📁 Copied directory: ${item}`);
        } else {
            // Copy file
            fs.copyFileSync(srcPath, destPath);
            console.log(`📄 Copied file: ${item}`);
        }
    } else {
        console.log(`⚠️ Item not found, skipping: ${item}`);
    }
});

// Function to copy directory recursively
function copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirectory(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// Optimize files for production
if (NODE_ENV === 'production') {
    console.log('🔧 Optimizing for production...');

    // Try to minify CSS (if cleancss-cli is available)
    try {
        console.log('🎨 Minifying CSS...');
        execSync(`npx cleancss -o ${BUILD_DIR}/css/afz-unified-design.min.css css/afz-unified-design.css`, { stdio: 'inherit' });

        // Update HTML to use minified CSS
        const indexPath = path.join(__dirname, BUILD_DIR, 'index.html');
        if (fs.existsSync(indexPath)) {
            let indexContent = fs.readFileSync(indexPath, 'utf8');
            indexContent = indexContent.replace(
                'href="./css/afz-unified-design.css"',
                'href="./css/afz-unified-design.min.css"'
            );
            fs.writeFileSync(indexPath, indexContent);
            console.log('✅ CSS minification complete');
        }
    } catch (error) {
        console.log('⚠️ CSS minification skipped (cleancss-cli not available)');
    }

    // Try to minify JavaScript (if terser is available)
    try {
        console.log('⚡ Minifying JavaScript...');
        const jsFiles = ['main.js', 'language.js', 'navigation.js', 'pwa.js'];
        const minifiedFiles = [];

        jsFiles.forEach(file => {
            const jsPath = path.join(__dirname, 'js', file);
            if (fs.existsSync(jsPath)) {
                const minPath = path.join(__dirname, BUILD_DIR, 'js', `${path.parse(file).name}.min.js`);
                execSync(`npx terser ${jsPath} -o ${minPath} --compress --mangle`, { stdio: 'inherit' });
                minifiedFiles.push(file);
            }
        });

        if (minifiedFiles.length > 0) {
            // Update HTML to use minified JS
            const indexPath = path.join(__dirname, BUILD_DIR, 'index.html');
            if (fs.existsSync(indexPath)) {
                let indexContent = fs.readFileSync(indexPath, 'utf8');
                minifiedFiles.forEach(file => {
                    const originalName = path.parse(file).name;
                    indexContent = indexContent.replace(
                        new RegExp(`src="./js/${file}"`, 'g'),
                        `src="./js/${originalName}.min.js"`
                    );
                });
                fs.writeFileSync(indexPath, indexContent);
            }
            console.log('✅ JavaScript minification complete');
        }
    } catch (error) {
        console.log('⚠️ JavaScript minification skipped (terser not available)');
    }
}

// Generate build info
const buildInfo = {
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    version: require('./package.json').version,
    buildDir: BUILD_DIR,
    nodeVersion: process.version
};

fs.writeFileSync(
    path.join(__dirname, BUILD_DIR, 'build-info.json'),
    JSON.stringify(buildInfo, null, 2)
);

// Calculate build size
function calculateSize(dir) {
    let size = 0;
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
            size += calculateSize(filePath);
        } else {
            size += stats.size;
        }
    }

    return size;
}

const buildSize = calculateSize(path.join(__dirname, BUILD_DIR));
console.log('📊 Build complete!');
console.log(`📁 Output: ${BUILD_DIR}/`);
console.log(`📏 Size: ${Math.round(buildSize / 1024)}KB`);
console.log(`⏰ Built at: ${buildInfo.timestamp}`);

// Create deployment instructions
const deployInstructions = `
# AFZ Advocacy App - Deployment Instructions

## Build Information
- Environment: ${NODE_ENV}
- Build Directory: ${BUILD_DIR}/
- Build Size: ${Math.round(buildSize / 1024)}KB
- Built: ${buildInfo.timestamp}

## Static Hosting Deployment

### Netlify
1. Drag and drop the '${BUILD_DIR}' folder to Netlify
2. Or connect to Git and set build command: 'npm run build'
3. Set publish directory: '${BUILD_DIR}'

### Vercel
1. Run: vercel --prod
2. Or connect to Git with build command: 'npm run build'
3. Set output directory: '${BUILD_DIR}'

### Traditional Hosting
1. Upload contents of '${BUILD_DIR}' folder to your web server
2. Ensure .htaccess file is uploaded for Apache servers
3. Configure SSL certificate

## Server Deployment (Full-Stack)

### Requirements
- Node.js ${process.version} or higher
- npm or yarn package manager

### Environment Setup
1. Copy .env.example to .env
2. Configure environment variables
3. Set up database (if using dynamic features)

### Start Server
\`\`\`bash
npm install
npm start
\`\`\`

## Post-Deployment Checklist
- [ ] Test all page navigation
- [ ] Verify contact form functionality
- [ ] Test language switching
- [ ] Check mobile responsiveness
- [ ] Validate accessibility features
- [ ] Test PWA installation
- [ ] Verify SSL certificate
- [ ] Submit to search engines

Built with ❤️ for AFZ Advocacy
`;

fs.writeFileSync(
    path.join(__dirname, BUILD_DIR, 'DEPLOYMENT.md'),
    deployInstructions
);

console.log(`📋 Deployment instructions created: ${BUILD_DIR}/DEPLOYMENT.md`);
console.log('🎉 Build process complete!');
