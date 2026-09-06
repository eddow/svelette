Take care that the instructions have to be double-checked as the specifications come from a non-expert.
Also, we can let other "system" ones, like theme
All the variables will just be displayed in the "work-zone" as icons/texts
The idea is: let's have it quite realistic (avoid twice the same command/enum in the toolbars, ...)
**Stellar Outpost (Space Colony Management Sim)**

This theme provides a rich mix of states, continuous sliders, discrete modes, and instant actions to thoroughly stress-test every editor variant (`toggle`, `select`, `slider`, `stepper`, `stars`, `button`, `splitButton`, `commandBox`, and `drawer`).

### Tool Definitions

```ts
export const demoTools = {
  // --- RUN TOOLS ---
  emergencyProtocol: {
    label: 'Emergency Lockdown',
    icon: '🚨',
    categories: ['System', 'Action'],
    keywords: ['lockdown', 'evacuate', 'alert', 'crisis'],
    run: () => console.warn('Colony lockdown initiated! All personnel to shelters.'),
    can: () => demoState.alertLevel !== 'green'
  },
  saveGame: {
    label: 'Save Colony State',
    icon: '💾',
    categories: ['System'],
    keywords: ['save', 'serialize', 'export', 'backup'],
    run: () => localStorage.setItem('stellar-outpost-save', JSON.stringify(demoState))
  },
  resetSimulation: {
    label: 'Reset Colony',
    icon: '🔄',
    categories: ['System'],
    keywords: ['reset', 'wipe', 'restart', 'default'],
    run: () => { demoState.taxRate = 15; demoState.alertLevel = 'green'; }
  },
  terminal: {
    label: 'Developer Terminal',
    icon: '💻',
    categories: ['System', 'Debug'],
    keywords: ['console', 'cli', 'debug', 'shell'],
    run: () => console.openOverlay?.()
  },

  // --- BOOLEAN TOOLS ---
  autoOxygen: {
    type: 'boolean',
    label: 'Automated Life Support',
    icon: '💨',
    categories: ['Systems', 'Automation'],
    keywords: ['oxygen', 'air', 'breathing', 'recycling', 'auto'],
    value: true,
    default: true
  },
  shieldGenerator: {
    type: 'boolean',
    label: 'Deflector Shields',
    icon: '🛡️',
    categories: ['Defense'],
    keywords: ['shields', 'defense', 'protection', 'barrier'],
    value: false,
    default: false
  },
  fastMode: {
    type: 'boolean',
    label: 'Hyper-Tick Mode',
    icon: '⚡',
    categories: ['Simulation'],
    keywords: ['fast', 'speed', 'turbo', 'tick'],
    value: false,
    default: false
  },

  // --- ENUM TOOLS ---
  colonyTheme: {
    type: 'enum',
    label: 'Outpost Atmosphere',
    icon: '🎨',
    categories: ['Appearance', 'UI'],
    keywords: ['theme', 'style', 'mars', 'void', 'skin', 'color'],
    value: 'mars',
    default: 'mars',
    values: ['mars', 'neptune', 'void', 'matrix']
  },
  alertLevel: {
    type: 'enum',
    label: 'Threat Level',
    icon: '⚠️',
    categories: ['Security'],
    keywords: ['alert', 'threat', 'status', 'defcon', 'green', 'yellow', 'red', 'black'],
    value: 'green',
    default: 'green',
    values: ['green', 'yellow', 'red', 'black']
  },
  powerPriority: {
    type: 'enum',
    label: 'Power Grid Focus',
    icon: '⚡',
    categories: ['Economy', 'Power'],
    keywords: ['power', 'energy', 'grid', 'priority', 'research', 'defense', 'economy'],
    value: 'balanced',
    default: 'balanced',
    values: ['research', 'defense', 'economy', 'balanced']
  },

  // --- NUMBER TOOLS ---
  gameSpeed: {
    type: 'number',
    label: 'Simulation Speed',
    icon: '⏱️',
    categories: ['Simulation'],
    keywords: ['speed', 'time', 'rate', 'clock', 'multiplier'],
    value: 1.0,
    default: 1.0,
    min: 0.5,
    max: 5.0,
    step: 0.5
  },
  taxRate: {
    type: 'number',
    label: 'Colony Tax Rate',
    icon: '🪙',
    categories: ['Economy'],
    keywords: ['tax', 'credits', 'economy', 'money', 'revenue'],
    value: 15,
    default: 15,
    min: 0,
    max: 50,
    step: 5
  },
  solarEfficiency: {
    type: 'number',
    label: 'Solar Array Multiplier',
    icon: '☀️',
    categories: ['Power'],
    keywords: ['solar', 'energy', 'efficiency', 'multiplier', 'panels'],
    value: 1.2,
    default: 1.0,
    min: 0.8,
    max: 3.0,
    step: 0.1
  }
};

```

### Key Bindings Map

```ts
export const demoKeys = {
  '`': 'terminal',
  'N': 'autoOxygen=toggle',
  'S': 'shieldGenerator=toggle',
  'E': 'emergencyProtocol',
  'Ctrl+S': 'saveGame',
  '+': 'gameSpeed:inc',
  '-': 'gameSpeed:dec',
  '1': 'alertLevel=green',
  '2': 'alertLevel=yellow',
  '3': 'alertLevel=red'
};

```

### Initial Layout Strategy (`PaletteBorders`)

* **Top Bar:** Houses instant actions and high-priority states (`emergencyProtocol`, `autoOxygen`, `shieldGenerator`, `alertLevel`).
* **Left Border:** Manages simulation pacing and environmental settings (`gameSpeed`, `colonyTheme`, `powerPriority`).
* **Right Border:** Controls economic and hardware performance parameters (`taxRate`, `solarEfficiency`).
* **Bottom Bar:** Dedicated developer utilities, save triggers, and secondary command triggers (`terminal`, `saveGame`, `resetSimulation`, `fastMode`) + a custom "time since demo launched as mm:ss"

Would you like to explore how to wire custom editor variants like a star-rating picker for colony satisfaction or a split-button for power grid toggles into this specific theme?

### Demo1
With a command button preceded on the top-bar (like vs-code) a boolean "edit toolbars" (icon only)

### Demo2

With a quake-like shortcut that opens a command+edit perhaps even in the middle, modal toward the working zone (disabeling+graying the working zone) 