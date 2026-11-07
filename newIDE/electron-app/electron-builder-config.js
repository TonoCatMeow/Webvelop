/**
 * Packaging of the Webvelop desktop application.
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
const config = {
  appId: 'com.webvelop.app',
  productName: 'Webvelop',
  copyright: 'Webvelop - MIT License',
  directories: {
    app: 'app',
    buildResources: 'build',
    output: 'dist',
  },
  extraResources: [{ from: '../../LICENSE.md', to: 'LICENSE.md' }],
  fileAssociations: [
    {
      ext: 'webvelop',
      name: 'Webvelop website',
      description: 'Webvelop website project',
      role: 'Editor',
    },
  ],
  win: {
    executableName: 'Webvelop',
    icon: 'build/icon.ico',
    target: [
      // A single executable, run without installation.
      { target: 'portable', arch: ['x64'] },
    ],
    // Not signed: no certificate is configured.
    signAndEditExecutable: true,
  },
  portable: {
    artifactName: 'Webvelop.exe',
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    shortcutName: 'Webvelop',
    uninstallDisplayName: 'Webvelop',
  },
  linux: {
    target: ['AppImage', 'deb'],
    category: 'Development',
  },
  mac: {
    category: 'public.app-category.developer-tools',
    target: 'dmg',
  },
  // Webvelop does not update itself from any server.
  publish: null,
};

module.exports = config;
