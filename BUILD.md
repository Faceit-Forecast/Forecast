# Forecast Extension - Build Instructions

## Prerequisites

- **Node.js**: v16.0.0 or higher
- **npm**: v8.0.0 or higher
- **Operating System**: Windows, macOS, or Linux

## Installation

1. Extract the source code archive
2. Open terminal/command prompt in the extracted folder
3. Install dependencies:
```bash
   npm install
```

## Build Process

Run the build command:
```bash
npm run build
```

This will:
1. Clean previous build artifacts
2. Copy source files from `./src` to `./dist`
3. Bundle JavaScript files into a single `forecast.js` file
4. Minify all JS, HTML, CSS, SVG, and JSON files
5. Create a packaged ZIP file in `./build` folder

## Build Output

- **Development files**: `./dist/` - Ready for Firefox temporary installation
- **Packaged extension**: `./build/forecast-extension-v1.0.0.zip`

## Verification

The build process is deterministic. Running `npm run build` multiple times will produce identical output (except timestamps in logs).

## Third-party Libraries

All dependencies are listed in `package.json` and installed via npm:
- terser v5.27.0 - JavaScript minification
- archiver v6.0.1 - ZIP archive creation
- html-minifier-terser v7.2.0 - HTML minification
- clean-css v5.3.3 - CSS minification
- svgo v3.0.2 - SVG optimization

No other external tools are required.