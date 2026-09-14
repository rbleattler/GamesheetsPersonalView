from pathlib import Path

src = Path('v3.4.html').read_text(encoding='utf-8')
s = src.replace('MyHockeyHub — V3.4', 'MyHockeyHub — V3.4.1', 1)
s = s.replace('V3.2.1 preview', 'V3.4.1', 1)

marker = "function abbr(t){return(t?.abbr||String(t?.title||'').split(/\\s+/).filter(Boolean).slice(0,3).map(x=>x[0]).join('')).slice(0,4).toUpperCase()||'TEAM'}"
helper = r'''function divisionSortParts(d){const title=String(d?.title||'').trim(),age=Number(title.match(/(\d{1,2})U\b/i)?.[1]??999),rest=title.replace(/^\s*\d{1,2}U\s*/i,'').trim();let tier=99;if(/\bAAA\b/i.test(rest))tier=0;else if(/\bAA\b/i.test(rest))tier=1;else if(/\bA\b/i.test(rest))tier=2;else if(/\bB\b/i.test(rest))tier=3;else if(/\bC\b/i.test(rest))tier=4;const conference=/\bAmerican\b/i.test(rest)?0:/\bNational\b/i.test(rest)?1:2;return{age,tier,conference,title}}
function sortedDivisions(){return[...state.divisions].sort((a,b)=>{const x=divisionSortParts(a),y=divisionSortParts(b);return x.age-y.age||x.tier-y.tier||x.conference-y.conference||x.title.localeCompare(y.title,undefined,{numeric:true})})}
'''
if marker not in s:
    raise SystemExit('abbr marker not found')
s = s.replace(marker, helper + marker, 1)
s = s.replace('state.divisions.map(d=>', 'sortedDivisions().map(d=>')
Path('v3.4.1.html').write_text(s, encoding='utf-8')

stable = Path('gamesheets_plus.html').read_text(encoding='utf-8')
stable = stable.replace('V3.4','V3.4.1').replace("'3.4'","'3.4.1'").replace("'v3.4.html'","'v3.4.1.html'")
start = stable.index('  <div class="items">')
end = stable.index('  <div id="originalNote"', start)
items = '''  <div class="items">\n    <div class="item"><div class="check">✓</div><div><b>Natural division ordering</b><span>Division pickers are now grouped youngest to oldest, then strongest tier to lower tier within each age (AA → A → B), with conference names used as the final tie-breaker.</span></div></div>\n  </div>\n'''
stable = stable[:start] + items + stable[end:]
Path('gamesheets_plus.html').write_text(stable, encoding='utf-8')

index = Path('index.html').read_text(encoding='utf-8')
index = index.replace('<div class="version"><div class="tag current">V3.4</div>', '<div class="version"><div class="tag">V3.4</div>', 1)
marker2 = '<section class="versions">\n'
card = '<div class="version"><div class="tag current">V3.4.1</div><div class="desc"><b>Natural division ordering</b><span>Minor UX refinement: division pickers now sort by age, then competitive tier, then conference so team selection reads naturally on mobile.</span></div><a class="open" href="v3.4.1.html">Open V3.4.1</a></div>\n'
if marker2 not in index:
    raise SystemExit('index versions marker not found')
index = index.replace(marker2, marker2 + card, 1)
Path('index.html').write_text(index, encoding='utf-8')
