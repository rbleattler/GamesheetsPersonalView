import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const required = [
  'index.html',
  'app/index.html',
  'assets/app.css',
  'assets/foundation.js',
  'assets/app.js',
  'assets/router.js',
  'assets/diagnostics.js',
  'assets/site.css',
  'data/seasons.json',
  'versions.html',
  'v3.6.html'
];

await Promise.all(required.map(path => access(join(dist, path))));
const appHtml = await readFile(join(dist, 'app/index.html'), 'utf8');
const homeHtml = await readFile(join(dist, 'index.html'), 'utf8');
const appJs = await readFile(join(dist, 'assets/app.js'), 'utf8');
const foundationJs = await readFile(join(dist, 'assets/foundation.js'), 'utf8');
const diagnosticsJs = await readFile(join(dist, 'assets/diagnostics.js'), 'utf8');

if (/<style[\s>]/i.test(appHtml)) throw new Error('App HTML still contains an inline <style> block.');
if (/<script\b(?![^>]*\bsrc=)[^>]*>/i.test(appHtml)) throw new Error('App HTML still contains inline JavaScript.');
if (!appHtml.includes('href="../"') || !appHtml.includes('aria-label="Home"')) throw new Error('App Home control is missing.');
if (!appHtml.includes('../assets/foundation.js') || !appHtml.includes('../assets/app.js') || !appHtml.includes('../assets/router.js') || !appHtml.includes('../assets/diagnostics.js')) throw new Error('External app bundles are missing.');
if (!homeHtml.includes('href="app/"') || !homeHtml.includes('href="versions.html"')) throw new Error('Home page navigation is incomplete.');
if (!appJs.includes('MyHockeyHubFoundation')) throw new Error('App bundle is not using the shared foundation layer.');
if (!appJs.includes('MyHockeyHubLiveService')) throw new Error('App bundle is not exposing the shared live-refresh service.');
if (!appJs.includes('MyHockeyHubDebug')) throw new Error('Preview diagnostics adapter was not emitted.');
if (!foundationJs.includes('MyHockeyHubFoundation') || !foundationJs.includes('addEventListener') || !foundationJs.includes('"online"')) throw new Error('Foundation live reconnect handling was not emitted correctly.');
if (!diagnosticsJs.includes('myhockeyhub.debug')) throw new Error('Diagnostics bundle was not emitted correctly.');

console.log('Build verification passed.');
