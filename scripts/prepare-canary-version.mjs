import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { URL } from 'node:url';

const packagePath = new URL('../package.json', import.meta.url);
const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
const baseVersion = String(packageJson.version).split('-')[0];
const sha = (process.env.RELEASE_SHA ?? '').slice(0, 12);
const runNumber = process.env.RELEASE_RUN_NUMBER ?? '';

if (!/^\d+\.\d+\.\d+$/.test(baseVersion)) {
  throw new Error(`Expected a stable SemVer base version, received: ${packageJson.version}`);
}

if (!/^[0-9a-f]{7,12}$/i.test(sha)) {
  throw new Error('RELEASE_SHA must contain a Git commit SHA');
}

if (!/^\d+$/.test(runNumber)) {
  throw new Error('RELEASE_RUN_NUMBER must be numeric');
}

const canaryVersion = `${baseVersion}-canary.${runNumber}.sha${sha}`;
packageJson.version = canaryVersion;

await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
process.stdout.write(`Prepared timonel@${canaryVersion}\n`);
