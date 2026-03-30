const electronmon = require('electronmon');

const { prepareMacOsDevBundle } = require('./prepare-macos-dev-bundle.cjs');

async function run() {
  const electronPath = process.platform === 'darwin' ? prepareMacOsDevBundle() : require('electron');

  await electronmon({
    args: process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['.'],
    cwd: process.cwd(),
    electronPath,
    logLevel: process.env.ELECTRONMON_LOGLEVEL || 'info',
  });
}

run().catch((error) => {
  console.error('Failed to start Electron development runtime.', error);
  process.exit(1);
});
