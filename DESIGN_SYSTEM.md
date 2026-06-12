# Pintalent — Design System

> Version 1.0 · Next.js 16 + Tailwind CSS v4

---

## 1. Couleurs

### Palette principale — Vert Pintalent

| Token | Classe Tailwind | Hex | Usage |
|-------|----------------|-----|-------|
| Primary | `emerald-600` | `#059669` | Boutons principaux, liens actifs, badges |
| Primary Dark | `emerald-700` | `#047857` | Hover boutons principaux |
| Primary Light | `emerald-50` | `#ecfdf5` | Fond badges, hover léger |
| Primary Border | `emerald-200` | `#a7f3d0` | Bordures focus, séparateurs |
| Primary Text | `emerald-700` | `#047857` | Texte sur fond clair |

```
#10b981  ████  emerald-500  — Accent, icônes
#059669  ████  emerald-600  — Boutons, CTA
#047857  ████  emerald-700  — Hover, état actif
#ecfdf5  ████  emerald-50   — Fond léger
```

### Couleurs neutres (UI)

| Rôle | Classe | Hex |
|------|--------|-----|
| Texte principal | `gray-900` | `#111827` |
| Texte secondaire | `gray-500` | `#6b7280` |
| Texte désactivé | `gray-400` | `#9ca3af` |
| Fond page | `gray-50` | `#f9fafb` |
| Fond card | `white` | `#ffffff` |
| Bordure card | `gray-100` | `#f3f4f6` |
| Bordure input | `gray-200` | `#e5e7eb` |
| Séparateur | `gray-200` | `#e5e7eb` |

### Couleurs sémantiques

| Rôle | Classe | Hex | Usage |
|------|--------|-----|-------|
| Succès | `green-500` | `#22c55e` | Confirmations |
| Attention | `amber-500` | `#f59e0b` | Warnings, données manquantes |
| Erreur | `red-500` | `#ef4444` | Suppression, erreurs critiques |
| Info | `blue-500` | `#3b82f6` | Informations neutres |

### Pipeline — Statuts candidats

| Statut | Couleur | Classe fond | Classe texte |
|--------|---------|-------------|--------------|
| Présélectionné | Bleu | `bg-blue-100` | `text-blue-700` |
| Entretien RH | Violet | `bg-violet-100` | `text-violet-700` |
| Entretien Tech | Indigo | `bg-indigo-100` | `text-indigo-700` |
| Proposition | Amber | `bg-amber-100` | `text-amber-700` |
| Retenu | Vert | `bg-emerald-100` | `text-emerald-700` |
| Refusé | Rouge | `bg-red-100` | `text-red-700` |

---

## 2. Typographie

```
Font principale :  system-ui / Inter (Tailwind default)
Font monospace  :  font-mono (codes, hex couleurs)
```

| Niveau | Classe | Usage |
|--------|--------|-------|
| H1 | `text-2xl font-bold text-gray-900` | Titre de page |
| H2 | `text-lg font-bold text-gray-900` | Titre de section |
| H3 | `text-base font-semibold text-gray-800` | Titre de card |
| Body | `text-sm text-gray-700` | Texte courant |
| Caption | `text-xs text-gray-500` | Labels, métadonnées |
| Overline | `text-xs font-semibold text-gray-500 uppercase tracking-wide` | Labels de section |
| Mono | `text-xs font-mono text-gray-600` | Codes, hex, IDs |

---

## 3. Espacements

Basés sur une grille de 4px (Tailwind default).

| Token | Valeur | Usage |
|-------|--------|-------|
| `gap-1` | 4px | Espacement micro (icône + texte) |
| `gap-2` | 8px | Espacement interne compact |
| `gap-3` | 12px | Espacement standard |
| `gap-4` | 16px | Espacement moyen |
| `gap-6` | 24px | Entre sections |
| `gap-8` | 32px | Grands espaces |
| `p-4` | 16px | Padding card compact |
| `p-5` | 20px | Padding card standard |
| `p-6` | 24px | Padding card large |
| `px-8 py-4` | 32/16px | Padding top bar |

---

## 4. Composants

### Bouton Primaire
```tsx
<button className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 
  text-white text-sm font-semibold rounded-xl transition-colors shadow-sm
  disabled:opacity-50">
  Action
</button>
```

### Bouton Secondaire
```tsx
<button className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 
  font-medium rounded-xl hover:bg-gray-100 transition-colors border 
  border-gray-200">
  Action
</button>
```

### Bouton Danger
```tsx
<button className="px-4 py-2 text-sm text-red-600 hover:text-red-800 
  font-medium rounded-xl hover:bg-red-50 transition-colors border 
  border-red-200">
  Supprimer
</button>
```

### Input
```tsx
<input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 
  text-sm bg-gray-50 hover:bg-white focus:outline-none 
  focus:ring-2 focus:ring-emerald-500 focus:border-transparent 
  transition-colors" />
```

### Select
```tsx
<select className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm 
  focus:outline-none focus:ring-2 focus:ring-emerald-500" />
```

### Card
```tsx
<div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
  {/* contenu */}
</div>
```

### Card interactive (hover)
```tsx
<div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5
  hover:shadow-md hover:border-gray-200 transition-all cursor-pointer">
  {/* contenu */}
</div>
```

### Badge statut
```tsx
// Actif / positif
<span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs 
  font-semibold rounded-full">
  Actif
</span>

// Neutre
<span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs 
  font-semibold rounded-full">
  Brouillon
</span>
```

### Badge score IA
```tsx
// Vert — À retenir
<span className="text-emerald-600 font-bold">92</span>

// Jaune — À évaluer
<span className="text-yellow-600 font-bold">67</span>

// Rouge — À écarter
<span className="text-red-500 font-bold">34</span>
```

### Section header (formulaire)
```tsx
<div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2.5">
  <span className="w-6 h-6 bg-emerald-600 text-white rounded-lg 
    flex items-center justify-center text-xs font-bold">
    1
  </span>
  <h2 className="text-sm font-bold text-gray-900">Titre de section</h2>
</div>
```

### Toggle
```tsx
<div className={`relative rounded-full transition-colors cursor-pointer
  ${active ? 'bg-emerald-500' : 'bg-gray-300'}`}
  style={{ height: 22, width: 40 }}
  onClick={toggle}>
  <div className={`absolute top-[3px] w-4 h-4 bg-white rounded-full 
    shadow transition-transform
    ${active ? 'translate-x-[22px]' : 'translate-x-[3px]'}`} />
</div>
```

### Top bar (sticky)
```tsx
<div className="sticky top-0 z-40 bg-white border-b border-gray-200 
  px-8 py-4 flex items-center justify-between shadow-sm">
```

### Spinner
```tsx
<div className="animate-spin w-5 h-5 border-2 border-emerald-600 
  border-t-transparent rounded-full" />
```

---

## 5. Layout

### Page standard
```
bg-gray-50 min-h-screen
└── sticky top bar (bg-white, border-b, shadow-sm, z-40)
└── main content (px-8 py-6 max-w-[1400px] mx-auto)
    └── page header (titre + actions)
    └── content area
```

### Page formulaire (2 colonnes)
```
flex flex-1 overflow-hidden
├── LEFT panel  — w-[560px] flex-shrink-0 overflow-y-auto
│   └── sections (bg-white rounded-2xl border shadow-sm)
└── RIGHT panel — flex-1 bg-slate-100 sticky preview
```

### Page liste (pleine largeur)
```
px-8 py-6
├── header row (titre + bouton créer)
├── filtres / recherche
└── grid ou table
```

---

## 6. Icônes & Emojis

Emojis utilisés comme icônes légères dans les badges et boutons :

| Usage | Emoji |
|-------|-------|
| Candidat | 👤 |
| Expérience | 💼 |
| Compétences | ⚡ |
| Formation | 🎓 |
| Langues | 🌐 |
| Analyse IA | 🤖 |
| Export | 📤 |
| PDF | 📕 |
| Word | 📘 |
| Suppression | 🗑 |
| Succès | ✓ |
| Attention | ⚠️ |
| Téléphone | 📞 |
| Email | ✉️ |
| Logo/Image | 🖼️ |
| Anonymisation | 🔒 |

---

## 7. Nom du produit

**Pintalent** — toujours avec P majuscule.

- UI & labels : `Pintalent`
- Messages système (ex: analyse IA) : `Pintalent analyse…`
- Ne jamais afficher `Claude` dans l'interface utilisateur

---

## 8. Règles générales

- **Coins** : `rounded-xl` (12px) pour inputs/boutons, `rounded-2xl` (16px) pour cards
- **Ombres** : `shadow-sm` par défaut, `shadow-md` au hover sur cards
- **Transitions** : toujours `transition-colors` ou `transition-all` sur éléments interactifs
- **Focus** : `focus:ring-2 focus:ring-emerald-500 focus:border-transparent focus:outline-none`
- **Disabled** : `disabled:opacity-50 disabled:cursor-not-allowed`
- **Z-index** : top bar = `z-40`, modals = `z-50`, dropdowns = `z-30`
