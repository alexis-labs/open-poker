# AGENTS.md — Índice para agentes de IA

> Guia rápido para qualquer agente (Copilot, Claude, Cursor, etc.) perceber a estrutura do código, as fronteiras de arquitetura e onde mexer com segurança.

## 1. O que é este projeto

**Open Poker** — clone open-source do *Balatro* a correr 100% no browser.
Stack: **TypeScript + Vite + Three.js + GSAP + Howler**, com testes em **Vitest** (unit) e **Playwright** (smoke).

O objetivo é manter a **simulação determinística** (regras de poker, scoring, estado da run) totalmente separada da **camada de rendering 3D**, áudio e input. Ver [docs/adr/0001-architecture-boundaries.md](docs/adr/0001-architecture-boundaries.md).

## 2. Mapa do repositório

```
open-poker/
├── index.html              # Entry HTML (Vite)
├── src/
│   ├── main.ts             # Bootstrap: liga GameState ↔ Three.js ↔ Input ↔ HUD
│   ├── style.css           # Estilos globais + HUD DOM
│   ├── game/               # ⚙️  SIMULAÇÃO PURA (sem DOM, sem Three.js)
│   │   ├── types.ts        #     Tipos partilhados (PlayingCard, ScoreBreakdown, RunSnapshot, InputAction…)
│   │   ├── cards.ts        #     Baralho, shuffle determinístico (seed)
│   │   ├── pokerEngine.ts  #     evaluateHand(): deteção e scoring das 12 mãos Balatro
│   │   ├── gameState.ts    #     Máquina de estado da run (deal, select, play, discard, ante)
│   │   ├── combat/         #     (reservado — futuros sistemas de combate/jokers)
│   │   └── run/            #     (reservado — meta-progressão, shop, runs)
│   ├── render/             # 🎨 ADAPTADORES VISUAIS (Three.js + GSAP)
│   │   ├── ThreeScene.ts   #     Cena, câmara, luzes, layout da mão/play
│   │   ├── CardObject.ts   #     Mesh 3D de uma carta + animações
│   │   ├── cardTextures.ts #     Geração/cache de texturas das cartas
│   │   ├── Interaction.ts  #     Raycasting, hover, drag, seleção
│   │   └── Particles.ts    #     Efeitos de partículas (score pops, etc.)
│   ├── input/
│   │   └── actions.ts      # 🎮 Ações semânticas + bindings de teclado
│   ├── audio/              # 🔊 ORQUESTRAÇÃO DE ÁUDIO (Howler + WebAudio)
│   │   ├── AudioManager.ts #     Singleton `audio`, sfx + música
│   │   ├── musicEngine.ts  #     Loop musical adaptativo
│   │   └── synth.ts        #     Síntese procedural de sfx
│   └── assets/             # Assets estáticos importados via Vite
├── public/
│   ├── art/                # Arte (cards/, back/, jokers/, blinds/, ui/, consumables/)
│   └── examples/           # Screenshots para o README
├── scripts/
│   └── generate-dummy-art.mjs  # Gera arte placeholder para dev
├── tests/
│   ├── unit/               # Vitest — pokerEngine, gameState
│   ├── smoke/              # Playwright — gameplay smoke
│   └── helpers/            # Fixtures (cards, etc.)
├── docs/
│   ├── adr/                # Architecture Decision Records
│   ├── good-first-issues.md
│   └── performance-budget.md
├── package.json
├── vite.config.* / tsconfig.json / vitest.config.ts / playwright.config.ts
└── README.md
```

## 3. Fronteiras de arquitetura (regras invioláveis)

Definidas no ADR-0001. **NÃO** as cruzar sem discussão:

| Camada | Pasta | Pode importar de | NÃO pode |
|---|---|---|---|
| Simulação | `src/game/**` | só de `src/game/**` | `three`, `gsap`, `howler`, DOM, `window` |
| Render | `src/render/**` | `src/game` (tipos/estado), `three`, `gsap` | mutar `GameState` diretamente |
| Input | `src/input/**` | tipos de `src/game` | tocar em meshes Three.js |
| Audio | `src/audio/**` | `howler`, WebAudio | depender de `GameState` |
| HUD/DOM | `src/main.ts` + `style.css` | tudo | viver dentro do scene graph |

A "cola" entre subsistemas vive em [src/main.ts](src/main.ts).

## 4. Conceitos-chave

- **`GameState`** ([src/game/gameState.ts](src/game/gameState.ts)) — máquina de estado da run. Emite snapshots serializáveis (`RunSnapshot`) para debug/save.
- **`evaluateHand`** ([src/game/pokerEngine.ts](src/game/pokerEngine.ts)) — recebe `PlayingCard[]`, devolve `ScoreBreakdown` com `(baseChips + Σ scoringChips) × mult`. Só *scoring cards* contribuem chips (regra Balatro).
- **`InputAction`** ([src/input/actions.ts](src/input/actions.ts)) — ações semânticas (`SELECT_CARD`, `PLAY_HAND`, `DISCARD`…) desacopladas das teclas físicas.
- **`CardObject`** ([src/render/CardObject.ts](src/render/CardObject.ts)) — wrapper de Mesh com API de animação (`moveTo`, `flip`, `highlight`).
- **Determinismo** — toda a aleatoriedade passa por seeds em `cards.ts`. Bugs devem ser reproduzíveis com seed + snapshot.

## 5. Loop de jogo (resumo)

`Deal 8` → `Select ≤5` → `Play` → `evaluateHand → score` → `bater target da blind` → `Small → Big → Boss` → `próximo ante` (8 antes: 300 → 50 000).

12 hand types implementados, incluindo os exclusivos Balatro: **Five of a Kind**, **Flush House**, **Flush Five**.

## 6. Comandos úteis

```powershell
npm run dev              # Vite dev server
npm run typecheck        # tsc --noEmit
npm test                 # Vitest (unit)
npm run test:coverage    # cobertura
npm run test:smoke       # Playwright
npm run build            # typecheck + build de produção
npm run check            # typecheck + coverage + build (CI local)
npm run gen-art          # gera arte placeholder em public/art
```

> Nota Windows: ver [/memories/repo/vite-windows-notes.md](#) (memória interna do agente) para particularidades do dev server.

## 7. Onde mexer para tarefas comuns

| Tarefa | Editar primeiro |
|---|---|
| Nova regra de scoring / novo hand type | [src/game/pokerEngine.ts](src/game/pokerEngine.ts) + testes em [tests/unit/pokerEngine.test.ts](tests/unit/pokerEngine.test.ts) |
| Mudar fluxo da run (antes, blinds, discards) | [src/game/gameState.ts](src/game/gameState.ts) + [tests/unit/gameState.test.ts](tests/unit/gameState.test.ts) |
| Animações / aspeto das cartas | [src/render/CardObject.ts](src/render/CardObject.ts), [src/render/ThreeScene.ts](src/render/ThreeScene.ts) |
| Texturas das cartas | [src/render/cardTextures.ts](src/render/cardTextures.ts), `public/art/cards/` |
| Seleção / drag / hover | [src/render/Interaction.ts](src/render/Interaction.ts) |
| Novo atalho de teclado | [src/input/actions.ts](src/input/actions.ts) |
| Som / música | [src/audio/AudioManager.ts](src/audio/AudioManager.ts) |
| HUD / overlays | [src/main.ts](src/main.ts) + [src/style.css](src/style.css) |
| Jokers / consumables / shop (futuro) | `src/game/combat/`, `src/game/run/` (a criar) |

## 8. Checklist antes de propor alterações

1. `npm run typecheck` passa.
2. `npm test` verde (e adicionar testes se mexeu em `src/game`).
3. Não introduziu imports de `three`/`gsap`/`howler`/DOM dentro de `src/game`.
4. Mudanças visuais com screenshot ou smoke test atualizado.
5. Se alterou regras: confirma com o README §Scoring e a ante curve.

## 9. Ficheiros que NÃO deves editar

- `coverage/`, `playwright-report/`, `test-results/` — artefactos gerados.
- `public/examples/*.png` — assets do README.
- `LICENSE`, `CODE_OF_CONDUCT.md` — só com decisão explícita.
