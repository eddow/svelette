from pathlib import Path
p = Path('/home/fmdm/dev/svelette/src/lib/palette/types.ts')
text = p.read_text()
start = text.index('/**\n * Shared drag session state')
end = text.index('/**\n * Serialized palette layout')
replacement = '/**\n * Placeholder drag session state (movement restart).\n *\n * Drag & drop, hit-testing, and preview were stripped. The store keeps a\n * `dragging` slot so layout markup does not churn while the next movement\n * design lands; nothing sets it yet.\n */\nexport interface PaletteDragging<TPalette extends Palette = Palette> {\n\t/** The palette instance. */\n\tpalette: TPalette\n}\n\n'
p.write_text(text[:start] + replacement + text[end:])
print('types stripped')
