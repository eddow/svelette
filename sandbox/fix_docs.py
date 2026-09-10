from pathlib import Path
root = Path('/home/fmdm/dev/svelette')
(Path(root / 'docs/movements.md')).write_text((root / 'sandbox/new_movements.md').read_text())
print('movements doc replaced')
plan = (root / 'plans/movement.md').read_text()
cut_at = plan.index('## The target behaviour')
cut = plan[cut_at:]
head = '# Movement — restart from scratch\n\n> Status: **stripped (2026-09-10).** Drag & drop, hit-testing, preview, and the catalogue-insert session were removed; `palettes.dragging` is an empty placeholder and item guards only inspect. The next movement design starts here.\n\n'
(root / 'plans/movement.md').write_text(head + cut)
print('plan trimmed')
