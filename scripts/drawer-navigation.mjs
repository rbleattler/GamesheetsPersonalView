import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appPath = join(root, 'dist/assets/app.js');
let code = await readFile(appPath, 'utf8');

function functionBoundsContaining(fragment) {
  const index = code.indexOf(fragment);
  if (index < 0) throw new Error(`Could not find drawer marker: ${fragment}`);
  let functionIndex = code.lastIndexOf('function ', index);
  if (functionIndex < 0) throw new Error(`Could not find function containing drawer marker: ${fragment}`);
  let start = functionIndex;
  if (functionIndex >= 6 && code.slice(functionIndex - 6, functionIndex) === 'async ') start -= 6;
  const signatureEnd = code.indexOf('{', functionIndex);
  const signature = code.slice(functionIndex, signatureEnd);
  const match = signature.match(/^function ([A-Za-z_$][\w$]*)\(([^)]*)\)$/);
  if (!match) throw new Error(`Could not parse drawer function signature for marker: ${fragment}`);
  const tail = code.slice(index + fragment.length);
  const next = tail.match(/(?:async )?function [A-Za-z_$][\w$]*\(/);
  if (!next || next.index == null) throw new Error(`Could not find drawer function boundary after marker: ${fragment}`);
  return { start, end:index + fragment.length + next.index, name:match[1], params:match[2] };
}

function replaceFunctionContaining(fragment, factory) {
  const bounds = functionBoundsContaining(fragment);
  code = code.slice(0, bounds.start) + factory(bounds) + code.slice(bounds.end);
  return bounds.name;
}

const openBounds = functionBoundsContaining('.drawerTitle.textContent=');
const openSource = code.slice(openBounds.start, openBounds.end);
const uiMatch = openSource.match(/([A-Za-z_$][\w$]*)\.drawerTitle\.textContent=/);
if (!uiMatch) throw new Error('Could not identify drawer UI object.');
const ui = uiMatch[1];
const openName = openBounds.name;

code = code.slice(0, openBounds.start) + `let __mhDrawerStack=[];
function __mhSyncDrawerBack(){const button=document.getElementById('backDrawer');if(button)button.hidden=__mhDrawerStack.length===0}
function __mhCaptureDrawer(){const body=document.createDocumentFragment();while(${ui}.drawerBody.firstChild)body.appendChild(${ui}.drawerBody.firstChild);return{title:${ui}.drawerTitle.textContent,sub:${ui}.drawerSub.textContent,body}}
function __mhDrawerBack(){const previous=__mhDrawerStack.pop();if(!previous)return;${ui}.drawerTitle.textContent=previous.title;${ui}.drawerSub.textContent=previous.sub;${ui}.drawerBody.replaceChildren(previous.body);__mhSyncDrawerBack();${ui}.drawer.scrollTo({top:0,behavior:'instant'})}
function ${openName}(e,t,a){if(${ui}.drawer.classList.contains('open'))__mhDrawerStack.push(__mhCaptureDrawer());else __mhDrawerStack=[];${ui}.drawerTitle.textContent=e;${ui}.drawerSub.textContent=t||'';${ui}.drawerBody.innerHTML=a||'';${ui}.backdrop.classList.add('open');${ui}.drawer.classList.add('open');${ui}.drawer.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';__mhSyncDrawerBack();${ui}.drawer.scrollTo({top:0,behavior:'instant'})}
` + code.slice(openBounds.end);

const closeName = replaceFunctionContaining('.drawer.setAttribute("aria-hidden","true")', ({ name }) => `function ${name}(){__mhDrawerStack=[];${ui}.backdrop.classList.remove('open');${ui}.drawer.classList.remove('open');${ui}.drawer.setAttribute('aria-hidden','true');document.body.style.overflow='';__mhSyncDrawerBack()}`);

code += `;(()=>{const button=document.getElementById('backDrawer');if(button)button.onclick=__mhDrawerBack;window.MyHockeyHubDrawerNavigation={back:__mhDrawerBack,depth:()=>__mhDrawerStack.length,close:${closeName}};__mhSyncDrawerBack()})();`;

const { code:minified } = await transform(code,{loader:'js',minify:true,target:'es2022'});
await writeFile(appPath,minified);
console.log('Added nested drawer back-stack navigation.');
