const fs = require('fs');
const path = require('path');
const {minify} = require('terser');
const {minify: minifyHTML} = require('html-minifier-terser');
const CleanCSS = require('clean-css');
const {optimize} = require('svgo');
const archiver = require('archiver');

const config = {
    srcDir: './src',
    distDir: './dist',
    outputDir: './build',
    manifestPath: './manifest.json',
    bundleJS: true,
    bundledFileName: 'forecast.js',
    excludeFromBundle: ['src/visual/popup.js'],
    additionalIncludes: ['_locales', 'LICENSE'],
    sourceArchive: {
        enabled: true,
        includes: ['_locales', 'src', 'build.js', 'LICENSE', 'manifest.json', 'package.json', 'package-lock.json'],
        rename: {'BUILD.md': 'README.md'}
    },
    minifyOptions: {
        js: {
            compress: {
                dead_code: true,
                drop_console: false,
                drop_debugger: true,
                keep_classnames: true,
                keep_fnames: true,
                passes: 3,
                booleans_as_integers: false,
                collapse_vars: true,
                comparisons: true,
                conditionals: true,
                evaluate: true,
                hoist_funs: true,
                hoist_vars: false,
                if_return: true,
                join_vars: true,
                loops: true,
                negate_iife: true,
                properties: true,
                reduce_vars: true,
                sequences: true,
                side_effects: true,
                switches: true,
                toplevel: false,
                typeofs: true,
                unused: true
            },
            mangle: {
                keep_classnames: true,
                keep_fnames: true,
                toplevel: false
            },
            format: {
                comments: false,
                ascii_only: true,
                semicolons: true
            }
        },
        html: {
            collapseWhitespace: true,
            removeComments: true,
            removeRedundantAttributes: true,
            removeScriptTypeAttributes: true,
            removeStyleLinkTypeAttributes: true,
            removeEmptyAttributes: true,
            removeOptionalTags: false,
            minifyCSS: true,
            minifyJS: true,
            collapseBooleanAttributes: true,
            decodeEntities: true,
            sortAttributes: true,
            sortClassName: true
        },
        css: {
            level: {
                2: {
                    mergeAdjacentRules: true,
                    mergeIntoShorthands: true,
                    mergeMedia: true,
                    mergeNonAdjacentRules: true,
                    mergeSemantically: false,
                    overrideProperties: true,
                    removeEmpty: true,
                    reduceNonAdjacentRules: true,
                    removeDuplicateFontRules: true,
                    removeDuplicateMediaBlocks: true,
                    removeDuplicateRules: true,
                    removeUnusedAtRules: false
                }
            }
        },
        svg: {
            plugins: [
                'removeComments',
                'removeMetadata',
                'removeEditorsNSData',
                'cleanupAttrs',
                'cleanupEnableBackground',
                'cleanupIds',
                'cleanupNumericValues',
                'collapseGroups',
                'convertColors',
                'convertEllipseToCircle',
                'convertPathData',
                'convertShapeToPath',
                'convertTransform',
                'mergePaths',
                'removeDesc',
                'removeDoctype',
                'removeEmptyAttrs',
                'removeEmptyContainers',
                'removeEmptyText',
                'removeHiddenElems',
                'removeNonInheritableGroupAttrs',
                'removeTitle',
                'removeUnknownsAndDefaults',
                'removeUnusedNS',
                'removeUselessDefs',
                'removeUselessStrokeAndFill',
                'removeXMLProcInst',
                'sortAttrs',
                'minifyStyles',
                {
                    name: 'removeAttrs',
                    params: {
                        attrs: ['data-name', 'class']
                    }
                }
            ]
        }
    },
    excludeFromCopy: ['.git', '.gitignore', 'node_modules', 'build.js', 'package.json', 'package-lock.json', 'README.md', '.DS_Store', 'Thumbs.db']
};

function log(msg, type = 'info') {
    const colors = {info: '\x1b[36m', success: '\x1b[32m', error: '\x1b[31m', warning: '\x1b[33m', reset: '\x1b[0m'};
    console.log(`${colors[type]}[${new Date().toLocaleTimeString()}] ${msg}${colors.reset}`);
}

function cleanDirectory(dir) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, {recursive: true, force: true});
    }
}

function ensureDirectory(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive: true});
}

function shouldExclude(itemPath) {
    return config.excludeFromCopy.some(exclude => itemPath.includes(exclude));
}

function copyDirectory(src, dest, excludeJS = false) {
    const entries = fs.readdirSync(src, {withFileTypes: true});
    let hasContent = false;

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (shouldExclude(srcPath)) continue;

        if (entry.isDirectory()) {
            if (copyDirectory(srcPath, destPath, excludeJS)) hasContent = true;
        } else {
            const isJS = path.extname(entry.name) === '.js';

            if (excludeJS && isJS) {
                const normalizedSrcPath = srcPath.replace(/\\/g, '/');
                const shouldKeep = config.excludeFromBundle.some(excluded => {
                    const normalizedExcluded = excluded.replace(/\\/g, '/');
                    return normalizedSrcPath.includes(normalizedExcluded) || normalizedSrcPath.endsWith(normalizedExcluded);
                });

                if (!shouldKeep) continue;
            }

            if (!hasContent) {
                ensureDirectory(dest);
                hasContent = true;
            }
            fs.copyFileSync(srcPath, destPath);
        }
    }

    return hasContent;
}

async function bundleJSFiles(jsFiles, outputPath) {
    let bundledCode = '';

    for (const file of jsFiles) {
        const filePath = path.join('.', file);
        if (fs.existsSync(filePath)) {
            const code = fs.readFileSync(filePath, 'utf8');
            bundledCode += `\n// ${file}\n${code}\n`;
        }
    }

    const result = await minify(bundledCode, config.minifyOptions.js);
    if (result.error) throw new Error(`Bundle minification error: ${result.error}`);

    ensureDirectory(path.dirname(outputPath));
    fs.writeFileSync(outputPath, result.code);

    log(`Bundle created: ${formatBytes(Buffer.byteLength(result.code, 'utf8'))}`, 'success');
    return true;
}

function updateManifestForBundle(manifestPath, bundledFileName) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    if (manifest.content_scripts) {
        for (const script of manifest.content_scripts) {
            if (script.js && script.js.length > 0) {
                script.js = [bundledFileName];
            }
        }
    }

    if (manifest.web_accessible_resources) {
        for (const resource of manifest.web_accessible_resources) {
            if (resource.resources) {
                resource.resources = resource.resources.filter(r => !r.endsWith('.js'));
                if (!resource.resources.includes(bundledFileName)) {
                    resource.resources.push(bundledFileName);
                }
            }
        }
    }

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

async function minifyJavaScript(filePath) {
    try {
        const code = fs.readFileSync(filePath, 'utf8');
        const result = await minify(code, config.minifyOptions.js);
        if (result.error || !result.code) return false;
        fs.writeFileSync(filePath, result.code);
        return true;
    } catch (error) {
        log(`Error: ${filePath} - ${error.message}`, 'error');
        return false;
    }
}

async function minifyHTMLFile(filePath) {
    try {
        const html = fs.readFileSync(filePath, 'utf8');
        const result = await minifyHTML(html, config.minifyOptions.html);
        fs.writeFileSync(filePath, result);
        return true;
    } catch (error) {
        log(`Error: ${filePath} - ${error.message}`, 'error');
        return false;
    }
}

function minifyCSSFile(filePath) {
    try {
        const css = fs.readFileSync(filePath, 'utf8');
        const result = new CleanCSS(config.minifyOptions.css).minify(css);
        if (result.errors.length > 0) return false;
        fs.writeFileSync(filePath, result.styles);
        return true;
    } catch (error) {
        log(`Error: ${filePath} - ${error.message}`, 'error');
        return false;
    }
}

function minifySVGFile(filePath) {
    try {
        const svg = fs.readFileSync(filePath, 'utf8');
        const result = optimize(svg, {path: filePath, plugins: config.minifyOptions.svg.plugins});
        fs.writeFileSync(filePath, result.data);
        return true;
    } catch (error) {
        log(`Error: ${filePath} - ${error.message}`, 'error');
        return false;
    }
}

function minifyJSONFile(filePath) {
    try {
        const json = fs.readFileSync(filePath, 'utf8');
        fs.writeFileSync(filePath, JSON.stringify(JSON.parse(json)));
        return true;
    } catch (error) {
        log(`Error: ${filePath} - ${error.message}`, 'error');
        return false;
    }
}

async function minifyAllFiles(dir, skipJS = false) {
    const entries = fs.readdirSync(dir, {withFileTypes: true});
    let stats = {js: 0, html: 0, css: 0, svg: 0, json: 0};

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            const dirStats = await minifyAllFiles(fullPath, skipJS);
            Object.keys(stats).forEach(k => stats[k] += dirStats[k]);
        } else {
            const ext = path.extname(entry.name).toLowerCase();

            if (ext === '.js' && !skipJS && await minifyJavaScript(fullPath)) stats.js++;
            else if (ext === '.html' && await minifyHTMLFile(fullPath)) stats.html++;
            else if (ext === '.css' && minifyCSSFile(fullPath)) stats.css++;
            else if (ext === '.svg' && minifySVGFile(fullPath)) stats.svg++;
            else if (ext === '.json' && entry.name !== 'manifest.json' && minifyJSONFile(fullPath)) stats.json++;
        }
    }

    return stats;
}

function getVersion() {
    if (fs.existsSync(config.manifestPath)) {
        return JSON.parse(fs.readFileSync(config.manifestPath, 'utf8')).version || '1.0.0';
    }
    return '1.0.0';
}

function getExtensionName() {
    if (fs.existsSync(config.manifestPath)) {
        const name = JSON.parse(fs.readFileSync(config.manifestPath, 'utf8')).name || 'extension';
        return name.toLowerCase().replace(/\s+/g, '-');
    }
    return 'extension';
}

function calculateSize(dir, debug = false) {
    let total = 0;

    const calc = (d, depth = 0) => {
        const entries = fs.readdirSync(d, {withFileTypes: true});
        let localTotal = 0;

        for (const entry of entries) {
            const p = path.join(d, entry.name);

            if (entry.isDirectory()) {
                const subTotal = calc(p, depth + 1);
                localTotal += subTotal;
                if (debug && depth < 2) {
                    log(`${'  '.repeat(depth)}📁 ${entry.name}: ${formatBytes(subTotal)}`, 'info');
                }
            } else {
                const size = fs.statSync(p).size;
                localTotal += size;
                if (debug && depth < 2 && size > 10000) {
                    log(`${'  '.repeat(depth)}📄 ${entry.name}: ${formatBytes(size)}`, 'info');
                }
            }
        }

        total += localTotal;
        return localTotal;
    };

    return calc(dir);
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

async function createZipArchive(sourceDir, outputPath) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputPath);
        const archive = archiver('zip', {zlib: {level: 9}});
        output.on('close', () => resolve(archive.pointer()));
        archive.on('error', reject);
        archive.pipe(output);
        archive.directory(sourceDir, false);
        archive.finalize();
    });
}

async function createSourceArchive(outputPath, includes, rename = {}) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputPath);
        const archive = archiver('zip', {zlib: {level: 9}});
        output.on('close', () => resolve(archive.pointer()));
        archive.on('error', reject);
        archive.pipe(output);

        for (const item of includes) {
            const itemPath = `./${item}`;
            if (fs.existsSync(itemPath)) {
                if (fs.statSync(itemPath).isDirectory()) {
                    archive.directory(itemPath, item);
                } else {
                    archive.file(itemPath, {name: item});
                }
            }
        }

        for (const [srcFile, destName] of Object.entries(rename)) {
            const srcPath = `./${srcFile}`;
            if (fs.existsSync(srcPath)) {
                archive.file(srcPath, {name: destName});
            }
        }

        archive.finalize();
    });
}

async function build() {
    const startTime = Date.now();

    log('Build started', 'info');
    log(`Bundle mode: ${config.bundleJS ? 'ENABLED' : 'DISABLED'}`, 'info');

    cleanDirectory(config.distDir);
    cleanDirectory(config.outputDir);
    ensureDirectory(config.distDir);
    ensureDirectory(config.outputDir);

    if (config.bundleJS) {
        copyDirectory(config.srcDir, path.join(config.distDir, 'src'), true);
    } else {
        copyDirectory(config.srcDir, path.join(config.distDir, 'src'));
    }

    for (const include of config.additionalIncludes) {
        const src = `./${include}`;
        if (fs.existsSync(src)) {
            const dest = path.join(config.distDir, include);
            if (fs.statSync(src).isDirectory()) {
                copyDirectory(src, dest);
            } else {
                ensureDirectory(path.dirname(dest));
                fs.copyFileSync(src, dest);
            }
        }
    }

    if (fs.existsSync(config.manifestPath)) {
        const distManifest = path.join(config.distDir, 'manifest.json');
        fs.copyFileSync(config.manifestPath, distManifest);

        if (config.bundleJS) {
            const manifest = JSON.parse(fs.readFileSync(config.manifestPath, 'utf8'));
            const jsFiles = [];

            if (manifest.content_scripts) {
                for (const script of manifest.content_scripts) {
                    if (script.js) jsFiles.push(...script.js);
                }
            }

            if (jsFiles.length > 0) {
                log(`Bundling ${jsFiles.length} JS files`, 'info');
                await bundleJSFiles(jsFiles, path.join(config.distDir, config.bundledFileName));
                updateManifestForBundle(distManifest, config.bundledFileName);
            }
        }
    }

    const srcSize = calculateSize(config.distDir);

    const stats = await minifyAllFiles(config.distDir, config.bundleJS);

    if (!config.bundleJS) log(`JS: ${stats.js}`, 'success');
    log(`HTML: ${stats.html}, CSS: ${stats.css}, SVG: ${stats.svg}, JSON: ${stats.json}`, 'success');

    const distSize = calculateSize(config.distDir);
    const reduction = srcSize > 0 ? ((srcSize - distSize) / srcSize * 100).toFixed(2) : '0.00';
    log(`Size: ${formatBytes(distSize)} (${reduction}% reduction from ${formatBytes(srcSize)})`, 'success');

    const version = getVersion();
    const name = getExtensionName();
    const zipName = `${name}-v${version}.zip`;
    const zipPath = path.join(config.outputDir, zipName);

    const zipSize = await createZipArchive(config.distDir, zipPath);
    log(`Archive: ${zipName} (${formatBytes(zipSize)})`, 'success');

    if (config.sourceArchive.enabled) {
        const sourceZipName = `forecast-source-v${version}.zip`;
        const sourceZipPath = path.join(config.outputDir, sourceZipName);
        const sourceZipSize = await createSourceArchive(sourceZipPath, config.sourceArchive.includes, config.sourceArchive.rename);
        log(`Source archive: ${sourceZipName} (${formatBytes(sourceZipSize)})`, 'success');
    }

    log(`Duration: ${((Date.now() - startTime) / 1000).toFixed(2)}s`, 'info');
}

build().catch((error) => {
    log('Build failed', 'error');
    log(error.message, 'error');
    console.error(error);
    process.exit(1);
});