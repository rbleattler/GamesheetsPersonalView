from pathlib import Path
import base64
import json
import lzma
import re

ROOT = Path('.')

# Reconstruct the user-provided catalog from the temporary compressed chunks.
parts = [ROOT / f'tools/season_chunks/catalog.xz.b64.part{i}' for i in (1, 2, 3)]
encoded = ''.join(p.read_text(encoding='utf-8').strip() for p in parts)
catalog_bytes = lzma.decompress(base64.b64decode(encoded))
catalog = json.loads(catalog_bytes.decode('utf-8'))
assert len(catalog) == 909, f'Expected 909 catalog rows, got {len(catalog)}'
assert any(int(x.get('SeasonID', -1)) == 15111 and x.get('LeagueName') == 'Delaware Valley Hockey League' for x in catalog)
(ROOT / 'data').mkdir(exist_ok=True)
(ROOT / 'data/seasons.json').write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

src = (ROOT / 'v3.4.2.html').read_text(encoding='utf-8')
s = src.replace('MyHockeyHub — V3.4.2', 'MyHockeyHub — V3.5', 1)
s = re.sub(r'(<span class="version">)V[^<]+(</span>)', r'\1V3.5\2', s, count=1)

css = r'''
/* V3.5: searchable season catalog */
.season-finder{display:grid;gap:12px}.season-search-row{display:grid;grid-template-columns:minmax(0,1fr) 155px;gap:8px}.season-search-results{display:grid;gap:7px}.season-result{width:100%;border:1px solid var(--line);border-radius:13px;background:#102033;color:var(--text);padding:11px;text-align:left;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}.season-result:hover,.season-result:focus{border-color:var(--blue);outline:none;background:#122943}.season-result-main{min-width:0}.season-result-title{font-weight:860;line-height:1.25}.season-result-sub{color:var(--muted);font-size:.78rem;line-height:1.3;margin-top:3px}.season-result-meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}.season-result-meta .pill{font-size:.65rem}.season-result-action{align-self:center;color:var(--blue);font-weight:800;white-space:nowrap;font-size:.78rem}.season-match{display:inline-flex;align-items:center;border:1px solid rgba(85,167,255,.38);background:rgba(85,167,255,.08);color:#9dceff;border-radius:999px;padding:3px 7px;font-size:.62rem;font-weight:800;margin-left:5px;vertical-align:middle}.season-finder-status{color:var(--muted);font-size:.78rem;line-height:1.4}.manual-season{border-top:1px solid var(--line);padding-top:12px;margin-top:3px}.manual-season-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}.catalog-note{font-size:.72rem;color:var(--muted);line-height:1.45}.season-no-results{padding:18px 10px;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:12px}.season-result.junk{opacity:.72}
html[data-theme="light"] .season-result{background:#fff;color:var(--text)}html[data-theme="light"] .season-result:hover,html[data-theme="light"] .season-result:focus{background:#f5f9fd}
@media(max-width:560px){.season-search-row{grid-template-columns:1fr}.season-result{grid-template-columns:minmax(0,1fr)}.season-result-action{justify-self:start}.manual-season-row{grid-template-columns:1fr}.manual-season-row button{width:100%}}
'''
s = s.replace('</style>', css + '\n</style>', 1)

start = s.index('async function addSeason(){')
end = s.index('async function loadSeason(){', start)
finder_js = r'''let seasonSearchCatalogCache=null;
const SEASON_ACRONYM_STOP=new Set(['the','of','and','for','at','in','on','a','an','to','by','with']);
const SEASON_JUNK=/\b(test|testing|copy|sandbox|template|merge|mess\s+around|archived\s+seasons?|demo)\b/i;
function seasonExplicitAcronyms(v){const s=String(v||''),out=[];for(const m of s.matchAll(/\(([A-Z0-9]{2,10})\)/g))out.push(m[1].toLowerCase());for(const m of s.match(/\b[A-Z][A-Z0-9]{2,9}\b/g)||[])out.push(m.toLowerCase());return[...new Set(out)]}
function seasonInferredAcronym(v){const words=normalize(v).split(' ').filter(Boolean).filter(w=>!SEASON_ACRONYM_STOP.has(w)&&!/^(?:19|20)\d{2}$/.test(w)&&!/^[0-9]+$/.test(w));if(words.length<2||words.length>10)return'';return words.map(w=>w[0]).join('').slice(0,12)}
function seasonPrepared(r){const league=String(r.LeagueName||''),season=String(r.SeasonName||league),search=`${league} ${season} ${r.SeasonID||''}`;return{...r,_league:normalize(league),_season:normalize(season),_search:normalize(search),_explicit:seasonExplicitAcronyms(`${league} ${season}`),_inferred:seasonInferredAcronym(league),_junk:SEASON_JUNK.test(`${league} ${season}`)}}
async function loadSeasonSearchCatalog(){if(seasonSearchCatalogCache)return seasonSearchCatalogCache;const r=await fetch('data/seasons.json',{cache:'no-store',credentials:'omit'});if(!r.ok)throw new Error(`Catalog load failed: ${r.status}`);const rows=await r.json();seasonSearchCatalogCache=(Array.isArray(rows)?rows:[]).map(seasonPrepared);return seasonSearchCatalogCache}
function seasonRecencyScore(r){const now=Date.now(),start=Date.parse(r.StartDate||''),end=Date.parse(r.EndDate||'');if(Number.isFinite(start)&&Number.isFinite(end)&&start<=now&&end>=now)return 35;if(Number.isFinite(start)&&start>now&&start-now<1000*60*60*24*240)return 18;if(Number.isFinite(end)&&end<now&&now-end<1000*60*60*24*365)return 8;return 0}
function seasonDirectScore(r,nq,raw){let score=-1,type='';if(/^\d+$/.test(raw)&&String(r.SeasonID)===raw)return{score:1200,type:'Season ID'};if(r._league===nq||r._season===nq){score=1000;type='Exact match'}else if(r._league.startsWith(nq)||r._season.startsWith(nq)){score=850;type='Starts with'}else{const toks=nq.split(' ').filter(Boolean);if(toks.length&&toks.every(t=>r._search.includes(t))){score=710;type='Words match'}else if(r._search.includes(nq)){score=620;type='Contains'}}if(score<0)return null;const qWantsJunk=SEASON_JUNK.test(raw);if(r._junk&&!qWantsJunk)score-=250;score+=seasonRecencyScore(r);return{score,type}}
function searchSeasonCatalog(rows,query,sport){const raw=String(query||'').trim().toLowerCase(),nq=normalize(raw);if(!nq)return[];const direct=[];for(const r of rows){if(sport&&String(r.Sport)!==sport)continue;const hit=seasonDirectScore(r,nq,raw);if(hit)direct.push({...r,_score:hit.score,_matchType:hit.type})}const compact=raw.replace(/[^a-z0-9]/g,''),acronymish=/^[a-z0-9]{3,8}$/.test(compact);if(acronymish&&direct.length<3){const seen=new Set(direct.map(x=>String(x.SeasonID)));for(const r of rows){if(seen.has(String(r.SeasonID))||(sport&&String(r.Sport)!==sport))continue;let score=-1,type='';if(r._explicit.includes(compact)){score=540;type='Acronym match'}else if(r._inferred===compact){score=390;type='Possible acronym'}if(score<0)continue;if(r._junk&&!SEASON_JUNK.test(raw))score-=250;score+=seasonRecencyScore(r);direct.push({...r,_score:score,_matchType:type})}}
return direct.sort((a,b)=>b._score-a._score||String(b.EndDate||'').localeCompare(String(a.EndDate||''))||String(a.LeagueName||'').localeCompare(String(b.LeagueName||''),undefined,{numeric:true})).slice(0,30)}
function finderDate(v){if(!v)return'';const d=new Date(`${v}T12:00:00`);return Number.isNaN(d.getTime())?String(v):new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(d)}
function seasonResultHtml(r){const league=r.LeagueName||r.SeasonName||`Season ${r.SeasonID}`,season=r.SeasonName||'',different=normalize(season)!==normalize(league),dates=[finderDate(r.StartDate),finderDate(r.EndDate)].filter(Boolean).join(' – '),match=(r._matchType==='Acronym match'||r._matchType==='Possible acronym')?`<span class="season-match">${esc(r._matchType)}</span>`:'';return`<button class="season-result${r._junk?' junk':''}" data-season-result="${escAttr(r.SeasonID)}"><div class="season-result-main"><div class="season-result-title">${esc(league)}${match}</div>${different?`<div class="season-result-sub">${esc(season)}</div>`:''}<div class="season-result-meta"><span class="pill">${esc(pretty(r.Sport||'unknown'))}</span>${dates?`<span class="pill">${esc(dates)}</span>`:''}<span class="pill">ID ${esc(r.SeasonID)}</span></div></div><span class="season-result-action">Use this season ›</span></button>`}
async function useCatalogSeason(id){const rows=await loadSeasonSearchCatalog(),r=rows.find(x=>String(x.SeasonID)===String(id));if(!r)return;const item={id:String(r.SeasonID),title:r.SeasonName||r.LeagueName||`Season ${r.SeasonID}`};saveSeason(item);state.seasonId=item.id;savePrefs();fillSeason();closeDrawer();await loadSeason()}
async function addSeasonFromRaw(raw,statusEl){const m=String(raw||'').match(/(?:seasons\/)?(\d{3,})/);if(!m){if(statusEl)statusEl.textContent='Enter a GameSheet season URL or numeric season ID.';return}try{if(statusEl)statusEl.textContent='Checking season…';const info=firstData(await fetchJson(`${API}/season-info/${m[1]}`));if(!info)throw new Error('Season not found');const item={id:String(info.id||m[1]),title:info.title||`Season ${m[1]}`};saveSeason(item);state.seasonId=item.id;savePrefs();fillSeason();closeDrawer();await loadSeason()}catch(e){if(statusEl)statusEl.textContent=`Could not add season: ${e.message}`;else alert(e.message)}}
async function openSeasonFinder(){openDrawer('Find a league / season','Search the periodically refreshed public season catalog',`<div class="season-finder"><div><label class="label">Search league or season</label><div class="season-search-row"><input id="seasonCatalogSearch" type="search" autocomplete="off" placeholder="DVHL, Delaware Valley, 15111…"><select id="seasonSportFilter"><option value="hockey">Hockey</option><option value="">All sports</option></select></div></div><div id="seasonFinderStatus" class="season-finder-status">Loading season catalog…</div><div id="seasonFinderResults" class="season-search-results"></div><div class="catalog-note">This catalog is a periodically refreshed snapshot of publicly discoverable GameSheet seasons. If a new league or season is missing, you can still add it directly below.</div><section class="manual-season"><label class="label">Add by GameSheet URL or season ID</label><div class="manual-season-row"><input id="manualSeasonInput" type="search" inputmode="numeric" placeholder="https://gamesheetstats.com/seasons/15111 or 15111"><button id="manualSeasonAdd" class="soft">Add season</button></div><div id="manualSeasonStatus" class="season-finder-status"></div></section></div>`);const input=$('#seasonCatalogSearch'),sport=$('#seasonSportFilter'),status=$('#seasonFinderStatus'),results=$('#seasonFinderResults'),manual=$('#manualSeasonInput'),manualBtn=$('#manualSeasonAdd'),manualStatus=$('#manualSeasonStatus');let rows=[];const renderResults=()=>{const q=input.value.trim();if(!q){results.innerHTML='';status.textContent=rows.length?`Search ${rows.length.toLocaleString()} known seasons. Start typing a league name, acronym, or season ID.`:'No catalog entries loaded.';return}if(q.length<2&&!/^\d+$/.test(q)){results.innerHTML='';status.textContent='Type at least 2 characters to search.';return}const hits=searchSeasonCatalog(rows,q,sport.value);status.textContent=hits.length?`${hits.length}${hits.length===30?'+':''} match${hits.length===1?'':'es'} · exact and text matches rank ahead of inferred acronyms`:'No catalog matches. Try more of the league name or add the season by URL/ID below.';results.innerHTML=hits.length?hits.map(seasonResultHtml).join(''):'<div class="season-no-results">No matching seasons found in the saved catalog.</div>';results.querySelectorAll('[data-season-result]').forEach(b=>b.onclick=()=>useCatalogSeason(b.dataset.seasonResult))};try{rows=await loadSeasonSearchCatalog();const sports=[...new Set(rows.map(x=>String(x.Sport||'')).filter(Boolean))].sort();sport.innerHTML='<option value="hockey">Hockey</option><option value="">All sports</option>'+sports.filter(x=>x!=='hockey').map(x=>`<option value="${escAttr(x)}">${esc(pretty(x))}</option>`).join('');input.oninput=renderResults;sport.onchange=renderResults;renderResults();input.focus()}catch(e){status.textContent=`Season catalog unavailable: ${e.message}. You can still add a season directly below.`}manualBtn.onclick=()=>addSeasonFromRaw(manual.value,manualStatus);manual.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();manualBtn.click()}}}
async function addSeason(){return openSeasonFinder()}
'''
s = s[:start] + finder_js + '\n' + s[end:]
s = s.replace('＋ Add season</button>', 'Find / add league</button>')
(ROOT / 'v3.5.html').write_text(s, encoding='utf-8')

# Stable launcher.
stable_path = ROOT / 'gamesheets_plus.html'
stable = stable_path.read_text(encoding='utf-8')
stable = stable.replace('V3.4.2', 'V3.5').replace("'3.4.2'", "'3.5'").replace("'v3.4.2.html'", "'v3.5.html'")
start_items = stable.index('  <div class="items">')
end_items = stable.index('  <div id="originalNote"', start_items)
items = '''  <div class="items">\n    <div class="item"><div class="check">✓</div><div><b>League / season search</b><span>Find known GameSheet seasons by typing a league name, season name, or numeric season ID instead of needing the exact URL.</span></div></div>\n    <div class="item"><div class="check">✓</div><div><b>Conservative acronym matching</b><span>Common-style abbreviations such as DVHL can match inferred league initials, but only as a lower-priority fallback behind real text matches.</span></div></div>\n    <div class="item"><div class="check">✓</div><div><b>Manual fallback stays available</b><span>The catalog is refreshed periodically, so a brand-new season can still be added immediately by pasting its GameSheet URL or season ID.</span></div></div>\n  </div>\n'''
stable = stable[:start_items] + items + stable[end_items:]
stable_path.write_text(stable, encoding='utf-8')

# Version history.
index_path = ROOT / 'index.html'
index = index_path.read_text(encoding='utf-8')
index = index.replace('<div class="version"><div class="tag current">V3.4.2</div>', '<div class="version"><div class="tag">V3.4.2</div>', 1)
marker = '<section class="versions">\n'
card = '<div class="version"><div class="tag current">V3.5</div><div class="desc"><b>Searchable league and season discovery</b><span>Added a locally cached public-season catalog with type-ahead search, conservative acronym inference, sport filtering, and a direct URL/ID fallback for seasons newer than the catalog.</span></div><a class="open" href="v3.5.html">Open V3.5</a></div>\n'
assert marker in index
index = index.replace(marker, marker + card, 1)
index_path.write_text(index, encoding='utf-8')

# README.
readme_path = ROOT / 'README.md'
readme = readme_path.read_text(encoding='utf-8')
readme = re.sub(r'\*\*Current numbered version:\*\* `v[^`]+`', '**Current numbered version:** `v3.5.html`', readme)
readme = readme.replace('- Full-season schedule browsing and search\n', '- Full-season schedule browsing and search\n- Type-ahead league / season discovery from a periodically refreshed local catalog\n')
readme = readme.replace('- **V3.4.1** — natural age/tier ordering for division selectors\n', '- **V3.4.1** — natural age/tier ordering for division selectors\n- **V3.4.2** — clearer multi-player selection flow\n- **V3.5** — searchable league/season catalog with conservative acronym matching\n')
insert_after = 'The application reads public GameSheet/`gamesheetstats.com` data in the browser and renders it into a more personalized mobile experience.\n'
if '## Season catalog' not in readme:
    readme = readme.replace(insert_after, insert_after + '''\n## Season catalog\n\n`data/seasons.json` is a manually refreshed snapshot of publicly discoverable GameSheet seasons. It powers the in-app league/season finder without requiring GameSheet's partner-only season-search API.\n\nThe catalog is intentionally treated as a convenience index rather than an authoritative live directory. New seasons can appear after the snapshot is generated, so the app keeps the direct GameSheet season URL / season-ID entry path as a fallback. Search favors exact and normal text matches first; inferred acronyms are used only as a lower-confidence fallback.\n''')
readme_path.write_text(readme, encoding='utf-8')

# FAQ.
faq_path = ROOT / 'FAQ.md'
faq = faq_path.read_text(encoding='utf-8') if faq_path.exists() else '# MyHockeyHub FAQ\n'
if 'How do I find or add a league / season?' not in faq:
    faq += '''\n## How do I find or add a league / season?\n\nOpen **Settings → Find / add league**. Start typing the league or season name and MyHockeyHub filters the saved public-season catalog immediately. You can also search by numeric GameSheet season ID.\n\nFor common abbreviations, MyHockeyHub may infer an acronym from the full league name—for example, **DVHL** can find **Delaware Valley Hockey League**. These inferred matches are deliberately ranked below exact and ordinary text matches to reduce unrelated suggestions.\n\nThe catalog is refreshed manually, so a brand-new season may not be present yet. In that case, paste the GameSheet season URL or season ID into the manual field at the bottom of the finder.\n'''
faq_path.write_text(faq, encoding='utf-8')
