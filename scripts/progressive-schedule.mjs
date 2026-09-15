import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appPath = join(root, 'dist/assets/app.js');
let code = await readFile(appPath, 'utf8');

const refreshPattern = /function ([A-Za-z_$][\w$]*)\(\)\{const ([A-Za-z_$][\w$]*)=([A-Za-z_$][\w$]*)\(\),([A-Za-z_$][\w$]*)=([A-Za-z_$][\w$]*)\("#scheduleCount"\),([A-Za-z_$][\w$]*)=\5\("#scheduleGames"\);\4&&\(\4\.textContent=`\$\{\2\.length\} games`\),\6&&\(\6\.innerHTML=\2\.map\(([A-Za-z_$][\w$]*)\)\.join\(""\)\|\|'<div class="panel empty">No games match these filters\.<\/div>',([A-Za-z_$][\w$]*)\(\6\)\),([A-Za-z_$][\w$]*)\(\)\}/;
const match = code.match(refreshPattern);
if (!match) {
  const marker = code.indexOf('"#scheduleCount"');
  throw new Error(`Could not find the minified schedule refresh function near offset ${marker}.`);
}

const [
  original,
  refreshFn,
  _gamesVar,
  scheduleGamesFn,
  _countVar,
  selectorFn,
  _rootVar,
  gameCardFn,
  bindGameActionsFn,
  pollLiveFn
] = match;

const replacement = `const __mhScheduleBatchSize=30;
let __mhSchedulePage={games:[],rendered:0,observer:null,loading:false};
function __mhScheduleGameKey(g){return String(g?.gameId??(String(g?.timeStampZulu||"")+"|"+String(g?.home?.id||"")+"|"+String(g?.visitor?.id||"")))}
function __mhSameScheduleGames(a,b){return a.length===b.length&&a.every((g,i)=>__mhScheduleGameKey(g)===__mhScheduleGameKey(b[i]))}
function __mhStopScheduleObserver(){if(__mhSchedulePage.observer){__mhSchedulePage.observer.disconnect();__mhSchedulePage.observer=null}}
function __mhAppendScheduleBatch(){
  if(__mhSchedulePage.loading)return;
  const root=${selectorFn}("#scheduleGames");
  if(!root)return;
  __mhSchedulePage.loading=true;
  try{
    __mhStopScheduleObserver();
    root.querySelector("#scheduleLoadMore")?.remove();
    const total=__mhSchedulePage.games.length;
    if(!total&&__mhSchedulePage.rendered===0){
      root.innerHTML='<div class="panel empty">No games match these filters.</div>';
      return;
    }
    const start=__mhSchedulePage.rendered;
    const end=Math.min(total,start+__mhScheduleBatchSize);
    if(end>start){
      const holder=document.createElement("div");
      holder.innerHTML=__mhSchedulePage.games.slice(start,end).map(${gameCardFn}).join("");
      ${bindGameActionsFn}(holder);
      while(holder.firstChild)root.appendChild(holder.firstChild);
      __mhSchedulePage.rendered=end;
    }
    if(__mhSchedulePage.rendered<total){
      const sentinel=document.createElement("div");
      sentinel.id="scheduleLoadMore";
      sentinel.className="panel empty";
      sentinel.style.padding="12px";
      sentinel.innerHTML='<button type="button" class="soft" data-schedule-more>Load more</button><div class="muted" style="margin-top:6px">Showing '+__mhSchedulePage.rendered.toLocaleString()+' of '+total.toLocaleString()+' games</div>';
      root.appendChild(sentinel);
      sentinel.querySelector("[data-schedule-more]").onclick=__mhAppendScheduleBatch;
      if("IntersectionObserver" in window){
        __mhSchedulePage.observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))__mhAppendScheduleBatch()},{rootMargin:"700px 0px"});
        __mhSchedulePage.observer.observe(sentinel);
      }
    }
  }finally{
    __mhSchedulePage.loading=false;
  }
}
function ${refreshFn}(){
  const games=${scheduleGamesFn}(),count=${selectorFn}("#scheduleCount"),root=${selectorFn}("#scheduleGames");
  if(count)count.textContent=games.length+" games";
  const preserveCount=__mhSameScheduleGames(__mhSchedulePage.games,games)?__mhSchedulePage.rendered:0;
  __mhStopScheduleObserver();
  __mhSchedulePage={games,rendered:0,observer:null,loading:false};
  if(root){
    root.innerHTML="";
    const target=Math.max(__mhScheduleBatchSize,preserveCount);
    do{__mhAppendScheduleBatch()}while(__mhSchedulePage.rendered<Math.min(target,games.length));
  }
  ${pollLiveFn}();
}`;

code = code.replace(original, replacement);

const completedResultsPattern = /\.filter\(([A-Za-z_$][\w$]*)=>([A-Za-z_$][\w$]*)\(\1\)==="final"\)\.sort\(/g;
const completedMatches = [...code.matchAll(completedResultsPattern)];
if (completedMatches.length !== 1) {
  throw new Error(`Expected exactly one literal-final Recent Results filter, found ${completedMatches.length}.`);
}
code = code.replace(completedResultsPattern, (_whole, gameVar) => `.filter(${gameVar}=>window.MyHockeyHubTeamNormalization.isCompletedGame(${gameVar})).sort(`);

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const cardName = escapeRegExp(gameCardFn);
const initialListPattern = new RegExp(`<div id="scheduleGames" class="list">\\$\\{[A-Za-z_$][\\w$]*\\.map\\(${cardName}\\)\\.join\\(""\\)\\|\\|'<div class="panel empty">No games match these filters\\.<\\/div>'\\}<\\/div>`);
if (!initialListPattern.test(code)) throw new Error('Could not find the initial full schedule-card render.');
code = code.replace(initialListPattern, '<div id="scheduleGames" class="list"></div>');

const bindName = escapeRegExp(bindGameActionsFn);
const selectorName = escapeRegExp(selectorFn);
const initialBindPattern = new RegExp(`${bindName}\\(([A-Za-z_$][\\w$]*\\.scheduleView)\\),${selectorName}\\("#fDiv"\\)`);
const bindMatch = code.match(initialBindPattern);
if (!bindMatch) throw new Error('Could not find the schedule-view initial bind point.');
code = code.replace(initialBindPattern, `${bindGameActionsFn}(${bindMatch[1]}),${refreshFn}(),${selectorFn}("#fDiv")`);

const { code: minified } = await transform(code, {
  loader: 'js',
  minify: true,
  target: 'es2022'
});
await writeFile(appPath, minified);

console.log(`Applied progressive schedule rendering in batches of 30 using ${refreshFn}().`);
