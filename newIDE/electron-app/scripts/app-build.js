// Build the editor (newIDE/app) and copy it into app/www, where the
// packaged desktop application loads it from.
const shell = require('shelljs');
const args = require('minimist')(process.argv.slice(2));

if (!args['skip-app-build']) {
  shell.cd('../app');
  if (shell.exec('npm run build').code !== 0) shell.exit(1);
  shell.cd('../electron-app');
}

shell.rm('-rf', 'app/www');
shell.mkdir('-p', 'app/www');
if (shell.cp('-r', '../app/build/*', 'app/www').code !== 0) {
  shell.echo(`❌ Copy from "../app/build" to "app/www" failed.`);
  shell.exit(1);
}
shell.echo('✅ Editor copied into app/www.');
