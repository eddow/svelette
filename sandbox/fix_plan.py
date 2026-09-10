from pathlib import Path
root = Path('/home/fmdm/dev/svelette')
(root / 'plans/movement.md').write_text((root / 'sandbox/new_plan.md').read_text())
print('plan replaced')
