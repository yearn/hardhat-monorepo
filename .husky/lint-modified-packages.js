const { promisify } = require('util');
const exec = require('child_process').exec;
const promisedExec = promisify(exec);
const _ = require('lodash');

const lint = async () => {
  const diffOutput = await promisedExec('git diff --name-only HEAD');
  const filesChanged = diffOutput.stdout.split('\n');
  const packagesModified = [];
  filesChanged.forEach(fileChanged => {
    const packageModifiedMatch = /packages\/([^\/]*)\//gm.exec(fileChanged);
    if (packageModifiedMatch) {
      const packageModified = packageModifiedMatch[1];
      if (!_.includes(packagesModified, packageModified) && packageModified !== 'commons') {
        packagesModified.push(packageModified);
      }
    }
  });
  if (packagesModified.length > 0) {
    const scopes = `--scope @yearn/${packagesModified.join(' --scope @yearn/')}`;
    try {
      await promisedExec(`lerna exec ${scopes} -- "yarn lint:fix"`)
    } catch (error) {
      console.log(error.stderr)
    }
  }
}

lint();