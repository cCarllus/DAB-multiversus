const fs = require('fs');
const path = require('path');

const APP_BUNDLE_NAME = 'Dead As Battle';
const APP_ID = 'com.deadasbattle.multiversus.dev';

function replacePlistString(contents, key, value) {
  const pattern = new RegExp(`(<key>${key}<\\/key>\\s*<string>)([^<]*)(<\\/string>)`);

  if (!pattern.test(contents)) {
    return contents;
  }

  return contents.replace(pattern, `$1${value}$3`);
}

function resolveElectronAppBundle() {
  const electronBinaryPath = require('electron');
  return path.resolve(electronBinaryPath, '../../..');
}

function prepareMacOsDevBundle() {
  const electronPackage = require('electron/package.json');
  const sourceAppBundle = resolveElectronAppBundle();
  const devRoot = path.join(process.cwd(), '.electron-dev');
  const targetAppBundle = path.join(devRoot, `${APP_BUNDLE_NAME}.app`);
  const targetInfoPlist = path.join(targetAppBundle, 'Contents', 'Info.plist');
  const targetExecutableDir = path.join(targetAppBundle, 'Contents', 'MacOS');
  const targetExecutablePath = path.join(targetExecutableDir, APP_BUNDLE_NAME);
  const originalExecutablePath = path.join(targetExecutableDir, 'Electron');
  const targetIconPath = path.join(targetAppBundle, 'Contents', 'Resources', 'dab-icon.icns');
  const sourceIconPath = path.join(process.cwd(), 'build-resources', 'dab-icon.icns');
  const metadataPath = path.join(devRoot, 'metadata.json');

  const metadata = {
    appName: APP_BUNDLE_NAME,
    electronVersion: electronPackage.version,
  };

  let shouldRefreshBundle = !fs.existsSync(targetAppBundle);

  if (!shouldRefreshBundle && fs.existsSync(metadataPath)) {
    try {
      const previousMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      shouldRefreshBundle =
        previousMetadata.appName !== metadata.appName ||
        previousMetadata.electronVersion !== metadata.electronVersion;
    } catch {
      shouldRefreshBundle = true;
    }
  } else if (!fs.existsSync(metadataPath)) {
    shouldRefreshBundle = true;
  }

  if (shouldRefreshBundle) {
    fs.rmSync(targetAppBundle, { force: true, recursive: true });
    fs.mkdirSync(devRoot, { recursive: true });
    fs.cpSync(sourceAppBundle, targetAppBundle, { recursive: true });
  }

  if (fs.existsSync(originalExecutablePath) && !fs.existsSync(targetExecutablePath)) {
    fs.renameSync(originalExecutablePath, targetExecutablePath);
  }

  if (fs.existsSync(sourceIconPath)) {
    fs.copyFileSync(sourceIconPath, targetIconPath);
  }

  let plistContents = fs.readFileSync(targetInfoPlist, 'utf8');
  plistContents = replacePlistString(plistContents, 'CFBundleDisplayName', APP_BUNDLE_NAME);
  plistContents = replacePlistString(plistContents, 'CFBundleName', APP_BUNDLE_NAME);
  plistContents = replacePlistString(plistContents, 'CFBundleExecutable', APP_BUNDLE_NAME);
  plistContents = replacePlistString(plistContents, 'CFBundleIdentifier', APP_ID);
  plistContents = replacePlistString(plistContents, 'CFBundleIconFile', 'dab-icon');
  fs.writeFileSync(targetInfoPlist, plistContents, 'utf8');

  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  return targetExecutablePath;
}

module.exports = {
  prepareMacOsDevBundle,
};
