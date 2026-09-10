from pathlib import Path
p = Path('/home/fmdm/dev/svelette/src/lib/palette/layout.svelte.ts')
text = p.read_text()
marker = "// \u2500\u2500 Svelte actions \u2500\u2500\n"
idx = text.index(marker)
head = text[:idx]
actions = Path('/home/fmdm/dev/svelette/sandbox/new_actions.txt').read_text()
p.write_text(head + actions)
print("rewrote", len((head + actions).splitlines()))
