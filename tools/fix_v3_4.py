from pathlib import Path

p=Path('v3.4.html')
s=p.read_text(encoding='utf-8')

s=s.replace("function teamPickerOptions(divisionId){return scheduleTeamGroups(divisionId).map(x=>`<option value=\"${escAttr(x.ids[0])}\">${esc(x.title)}</option>`).join('')}", "function teamPickerOptions(divisionId){if(!divisionId)return'';return scheduleTeamGroups(divisionId).map(x=>`<option value=\"${escAttr(x.ids[0])}\">${esc(x.title)}</option>`).join('')}", 1)

old="""const legacyMyTeamBySeason=readJson('gsv3.myTeamBySeason',readJson('gsv2.myTeamBySeason',{}));
for(const [season,id] of Object.entries(legacyMyTeamBySeason)){if(id&&!(state.myTeamsBySeason[season]||[]).length)state.myTeamsBySeason[season]=[String(id)]}
if(!(state.myTeamsBySeason['15111']||[]).length&&localStorage.getItem('dvhl.myTeamId'))state.myTeamsBySeason['15111']=[String(localStorage.getItem('dvhl.myTeamId'))];
for(const [season,ids] of Object.entries(state.myTeamsBySeason)){state.myTeamsBySeason[season]=[...new Set((Array.isArray(ids)?ids:[ids]).map(String).filter(Boolean))];if(!state.activeMyTeamBySeason[season]||!state.myTeamsBySeason[season].includes(String(state.activeMyTeamBySeason[season])))state.activeMyTeamBySeason[season]=state.myTeamsBySeason[season][0]||''}"""
new="""if(!localStorage.getItem('gsv3.myTeamsMigrated')){const legacyMyTeamBySeason=readJson('gsv3.myTeamBySeason',readJson('gsv2.myTeamBySeason',{}));for(const [season,id] of Object.entries(legacyMyTeamBySeason)){if(id&&!(state.myTeamsBySeason[season]||[]).length)state.myTeamsBySeason[season]=[String(id)]}if(!(state.myTeamsBySeason['15111']||[]).length&&localStorage.getItem('dvhl.myTeamId'))state.myTeamsBySeason['15111']=[String(localStorage.getItem('dvhl.myTeamId'))];localStorage.setItem('gsv3.myTeamsMigrated','1')}
for(const [season,ids] of Object.entries(state.myTeamsBySeason)){state.myTeamsBySeason[season]=[...new Set((Array.isArray(ids)?ids:[ids]).map(String).filter(Boolean))];if(!state.activeMyTeamBySeason[season]||!state.myTeamsBySeason[season].includes(String(state.activeMyTeamBySeason[season])))state.activeMyTeamBySeason[season]=state.myTeamsBySeason[season][0]||''}"""
if old not in s:
    raise SystemExit('migration source not found')
s=s.replace(old,new,1)

p.write_text(s,encoding='utf-8')
