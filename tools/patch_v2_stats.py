from pathlib import Path

p = Path('v2.html')
s = p.read_text()
marker = 'function statClock(clock){'

# The one-shot patch briefly ran twice while being wired up. Keep one copy of
# the Firestore stats normalization helpers; functionally harmless duplicates
# are removed before we retire the patch tooling.
while s.count(marker) > 1:
    first = s.find(marker)
    second = s.find(marker, first + len(marker))
    if first < 0 or second < 0:
        break
    s = s[:first] + s[second:]

p.write_text(s)
