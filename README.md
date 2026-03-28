# Školička

Interaktivní vzdělávací platforma pro děti školního věku, navržená pro provoz na domácím serveru. Školička využívá principy prostorového opakování (spaced repetition) a herní prvky, aby bylo učení zábavné a efektivní.

---

## Co Školička umí

### Cvičení — Vyjmenovaná slova

Aktuálně je implementován modul **Vyjmenovaná slova**. Děti doplňují správné `y/i` do mezer ve větách.

- Výběr písmen B, L, M, P, S, V, Z — každé procvičovat zvlášť nebo všechna najednou
- Dva typy otázek: výběr celého slova (word-choice) nebo výběr písmene (fill-in)
- Okamžitá zpětná vazba: zelená / červená, zvukový feedback
- Zobrazení správné odpovědi po chybě, nápověda po druhé chybě v řadě
- **Boss Level** — speciální kolo s confetti obrazovkou po výhře

### Systém prostorového opakování (SM-2)

Každá věta má vlastní záznam o pokroku. Věty s chybami se opakují častěji, zvládnuté méně.

### Profily dětí

- Více dětí na jednom zařízení, každý s vlastním profilem
- Jméno, barva, emoji avatar nebo fotka
- Třída, denní cíl, poznámka od rodiče
- Možnost pozastavit nebo archivovat profil

### Gamifikace

- **XP body** — za každou správnou odpověď; animace při získání
- **Série (streak)** — denní série s ikonkou ohně
- **Denní cíl** — progress bar přímo na kartě profilu
- **Odznaky** — 17 odemykatelných achievementů (první správná, série, perfektní sezení, boss poražen…)
- **Leaderboard** — přehled XP a streaku všech profilů v rodině

### Rodičovský panel

Panel chráněný PINem:

- Přehledné grafy pokroku v čase (odpovědi, XP, přesnost)
- Statistiky po písmenech, heatmapa aktivity, nejhorší slova
- Správa profilů (vytvoření, editace, pozastavení, archivace)
- Změna PINu přímo v panelu
- Export statistik do PDF

### Design

Vlastní **claymorphism** design systém — tučné ohraničení, výrazné stíny, kulaté rohy. Plná podpora **dark mode** a **PWA** (instalace na plochu, offline banner).

---

## Architektura

```
skolicka/
├── Dockerfile
├── docker-compose.yml
├── .env
├── frontend/                 — React 19 + Vite 6 + Tailwind CSS 4
│   ├── public/
│   │   ├── manifest.json     — PWA manifest
│   │   ├── sw.js             — Service Worker (offline podpora)
│   │   └── icon-*.png
│   └── src/
│       ├── modules/          — modul registry + frontend moduly
│       │   └── vyjmenovana-slova/
│       ├── pages/            — HomePage, ModuleSelectPage, ParentDashboard…
│       └── components/       — ProfileCard, ProfileForm, BadgeGrid…
└── backend/                  — Node.js 22 LTS + Express 5
    └── src/
        ├── core/             — spaced-repetition, streaks, badges, XP, auth, profiles
        ├── db/               — migrace a seed skripty
        └── modules/          — backend moduly (auto-discovery)
            └── vyjmenovana-slova/
```

### Tech stack

| Část | Technologie |
|------|------------|
| Frontend | React 19, Vite 6, Tailwind CSS 4, Recharts, jsPDF |
| Backend | Node.js 22, Express 5, bcrypt, jsonwebtoken |
| Databáze | SQLite (better-sqlite3) |
| Deployment | Docker (single container) |
| Audio | Web Audio API (bez externích závislostí) |

---

## Instalace a spuštění

### Požadavky

- Docker

### Spuštění

**1. Připrav `.env`**

```bash
# Vygeneruj bcrypt hash pro svůj PIN (nahraď 1234 svým PINem)
node -e "require('bcrypt').hash('1234', 10).then(h => console.log(h))"
```

Vytvoř soubor `.env` v kořeni projektu:

```
PARENT_PIN_HASH=$2b$10$...  # sem vlož vygenerovaný hash
JWT_SECRET=dlouhy_nahodny_retezec
```

**2. Spusť**

```bash
docker compose up --build
```

Aplikace bude dostupná na **http://localhost:3000**.

Při prvním spuštění se automaticky inicializuje databáze a nahrají seed data.

**3. Při dalším spuštění**

```bash
docker compose up
```

### Logy a troubleshooting

```bash
# Logy aplikace
docker compose logs -f

# Restart po změně .env
docker compose restart

# Úplný reset včetně databáze
docker compose down -v
docker compose up --build
```

### Změna PINu

PIN lze změnit přímo v rodičovském panelu (záložka → ikona klíče v hlavičce). Není potřeba zasahovat do `.env`.

---

## Přidání nového modulu

### Backend

1. Vytvoř `backend/src/modules/<id>/index.js`:

```javascript
export default {
  id: 'muj-modul',
  name: 'Můj Modul',
  seed: async (pool) => { /* volitelné */ },
  registerRoutes: (app) => {
    import('./routes.js').then(r => app.use('/api/modules/muj-modul', r.default))
  },
}
```

2. Vytvoř `routes.js` s Express routerem.

Modul se automaticky načte při startu serveru.

### Frontend

1. Vytvoř `frontend/src/modules/<id>/index.jsx`
2. Zaregistruj v `frontend/src/modules/registry.js`

---

<details>
<summary>💬 Prompt pro generování vět (seed.json)</summary>

Použij v ChatGPT pro rychlé generování nových vět do `seed.json`:

---

Vytvoř JSON pole vět pro výukovou aplikaci vyjmenovaných slov. Každá věta musí mít přesně jeden výskyt slova s vyjmenovaným kořenem, kde se cvičí psaní **y/i (bez háčků)**.

Formát:

```json
{
  "word": "bydlet",
  "letter": "B",
  "template": "Chci b___dlet ve velkém domě.",
  "correct_answer": "y",
  "display_word": "bydlet",
  "difficulty": 1
}
```

Pravidla:
- `correct_answer` — pouze `"y"` nebo `"i"`, nikdy s háčkem
- `___` — označuje přesně jedno cvičené písmeno, zbytek slova zůstane
- Věty krátké a srozumitelné pro 2.–4. třídu ZŠ
- Každé slovo nejvýše jednou

Vygeneruj 20 vět pro písmeno **[DOPLŇ PÍSMENO]**.

---

Výstup přidej do `backend/src/modules/vyjmenovana-slova/seed.json`.

</details>

---

## Licence

Projekt je určen pro osobní a rodinné použití.
