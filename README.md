# 🏫 Školička

Interaktivní vzdělávací platforma pro děti školního věku, navržená pro provoz na domácím serveru. Školička využívá principy prostorového opakování (spaced repetition) a herní prvky, aby bylo učení zábavné a efektivní.

---

## Co Školička umí

### Cvičení — Vyjmenovaná slova

Aktuálně je implementován modul **Vyjmenovaná slova** — jedno z nejdůležitějších učiva na prvním stupni základní školy. Děti doplňují správné `y/i` do mezer v slovech přímo v kontextu vět.

- Výběr písmen, se kterými chce dítě procvičovat (B, L, M, P, S, V, Z nebo všechna najednou)
- Velká, přehledná tlačítka **Y** a **I** — ovládání bez klávesnice
- Okamžitá zpětná vazba: zelená při správné odpovědi, červená při chybě
- Zobrazení správné odpovědi po chybě po dobu 2,5 vteřiny, aby si dítě stihlo zapamatovat
- Rychlý posun na další větu po správné odpovědi (1,2 s)

### Systém prostorového opakování (SM-2)

Každá věta má svůj vlastní záznam o pokroku. Algoritmus SM-2 rozhoduje, které věty se mají zobrazit znovu — ty, ve kterých dítě dělá chyby, se opakují častěji. Věty zvládnuté na výbornou se zobrazují méně.

### Profily

- Více dětí může mít vlastní profil v jedné aplikaci
- Každý profil má jméno, barvu avataru a volitelnou fotku
- Pokrok, XP a odznaky jsou oddělené pro každý profil

### Gamifikace

- **XP body** — za každou správnou odpověď; +15 XP pokud je odpověď do 3 vteřin, jinak +10 XP
- **Série (streak)** — denní série cvičení zobrazená ohněm; motivuje k pravidelnému učení
- **Odznaky** — odemykatelné za různé úspěchy (např. první cvičení, série 7 dní, 10 odpovědí za sebou pod 3 s)
- **Boss zápas** — speciální kolo dostupné po dosažení 70%+ úspěšnosti ve 4 nebo více písmenech

### Rodičovský panel

Panel dostupný přes PIN (výchozí `1234`), kde mohou rodiče sledovat:

- Přehledné grafy pokroku v čase (počet odpovědí, správnost)
- Statistiky po jednotlivých písmenech
- Nejproblematičtější slova (seřazená podle chybovosti)
- Přehled všech odznaky získaných dítětem
- Export statistik do PDF jedním kliknutím

### Design

Aplikace používá vlastní **claymorphism** design systém:
- Tučné ohraničení karet a tlačítek, výrazné stíny ve stylu hraček
- Živé animace — bounce při správné odpovědi, shake při chybě
- Fonty Baloo 2 (nadpisy) a Quicksand (text) — kulaté, přátelské a dobře čitelné pro děti
- Skeleton loading, plynulé přechody

---

## Architektura

```
skolicka/
├── docker-compose.yml
├── .env.example
├── frontend/                 — React 19 + Vite 6 + Tailwind CSS 4
│   └── src/
│       ├── modules/          — modul registry + frontend moduly
│       │   └── vyjmenovana-slova/
│       │       ├── index.jsx
│       │       └── FillInExercise.jsx
│       ├── pages/            — HomePage, ProfilePage, ParentDashboard
│       └── components/       — ProfileCard, PinModal, Button...
└── backend/                  — Node.js 22 LTS + Express 5
    └── src/
        ├── core/             — spaced-repetition, streaks, badges, XP, auth
        ├── db/               — migrace a seed skripty
        └── modules/          — backend moduly (auto-discovery)
            └── vyjmenovana-slova/
                ├── index.js
                ├── routes.js
                ├── questions.js
                └── seed.json
```

### Tech stack

| Část | Technologie |
|------|------------|
| Frontend | React 19, Vite 6, Tailwind CSS 4, Recharts, jsPDF |
| Backend | Node.js 22, Express 5, bcrypt, jsonwebtoken |
| Databáze | PostgreSQL 17 |
| Deployment | Docker Compose (3 kontejnery) |
| Audio | Web Audio API (bez externích závislostí) |

---

## Přidání nového modulu

Modulový systém je navržen tak, aby přidání nového tématu nevyžadovalo žádný zásah do core kódu.

### Backend

1. Vytvoř adresář `backend/src/modules/<id>/`
2. Vytvoř `index.js` s rozhraním:

```javascript
export default {
  id: 'muj-modul',
  name: 'Můj Modul',
  description: 'Popis modulu',
  icon: 'Star',
  color: '#8B5CF6',
  exerciseTypes: ['fill-in'],
  registerRoutes: (app) => {
    import('./routes.js').then(r => app.use('/api/modules/muj-modul', r.default))
  },
  seed: async (pool) => { /* volitelné seed data */ }
}
```

3. Vytvoř `routes.js` s Express routerem
4. Vytvoř `seed.json` se seed daty (volitelné)

Modul se automaticky načte při startu serveru.

### Frontend

1. Vytvoř adresář `frontend/src/modules/<id>/`
2. Vytvoř `index.jsx`
3. Zaregistruj modul v `frontend/src/modules/registry.js`

---

## Změna rodičovského PINu

```bash
# Vygeneruj nový hash (nahraď 'novypin' svým PINem)
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('novypin', 10).then(h => console.log(h))"
# Aktualizuj PARENT_PIN_HASH v .env a restartuj backend
docker-compose restart backend
```

---

<details>
<summary>🔧 Technické informace pro správce</summary>

### Požadavky

- Docker a Docker Compose (testováno na Docker Desktop pro Windows/Mac i Docker Engine na Linuxu)
- Porty 3000 a 3001 musí být volné

### Instalace

**1. Připrav prostředí**

```bash
cp .env.example .env
```

Uprav `.env` — vyplň tyto hodnoty:

```
DB_PASSWORD=nejaky_silny_heslo
JWT_SECRET=dlouhy_nahodny_retezec_minimalne_32_znaku
PARENT_PIN_HASH=   # viz níže
```

**2. Vygeneruj hash rodičovského PINu**

Z adresáře projektu (po instalaci závislostí backendu nebo ve chvíli kdy máš Node.js):

```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('1234', 10).then(h => console.log(h))"
```

Výstup (dlouhý řetězec začínající `$2b$10$...`) vlož do `PARENT_PIN_HASH` v `.env`.

Pokud nemáš bcrypt lokálně, použij spuštěný backend kontejner:

```bash
docker-compose run --rm backend node -e "const bcrypt = require('bcrypt'); bcrypt.hash('1234', 10).then(h => console.log(h))"
```

**3. Spusť aplikaci**

```bash
docker-compose up --build
```

Při prvním spuštění se automaticky:
- inicializuje databáze (migrace)
- nahrají seed data (věty pro Vyjmenovaná slova)

**Aplikace bude dostupná na:**
- 🌐 http://localhost:3000

**4. Při dalším spuštění**

```bash
docker-compose up
```

### Logy a troubleshooting

```bash
# Logy všech kontejnerů
docker-compose logs -f

# Pouze backend
docker-compose logs -f backend

# Restart pouze backendu (po změně .env)
docker-compose restart backend

# Úplný reset včetně databáze
docker-compose down -v
docker-compose up --build
```

</details>

---

<details>
<summary>💬 ChatGPT prompt — generování vět pro seed.json</summary>

Pokud chceš rozšířit databázi vět pro modul Vyjmenovaná slova, použij tento prompt v ChatGPT. Ušetříš tím tokeny a získáš rovnou správně naformátovaná data.

---

**Prompt:**

Vytvoř JSON pole vět pro výukovou aplikaci vyjmenovaných slov. Každá věta musí mít přesně jeden výskyt slova s vyjmenovaným kořenem, kde se cvičí psaní **y/i (bez háčků)**.

Požadovaný formát každého objektu:

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
- `word` — základní tvar slova (slovník)
- `letter` — jedno velké písmeno (B / L / M / P / S / V / Z) podle vyjmenovaného kořene
- `template` — věta, kde je slovo zapsáno s `___` místo **jediného písmene y nebo i** (zbytek slova musí být viditelný), příklad: `"b___dlet"`, `"m___t"`, `"p___sat"`
- `correct_answer` — buď `"y"` nebo `"i"` (bez háčků, bez diakritiky, pouze tato dvě písmena)
- `display_word` — kompletní slovo s háčky, jak se zobrazí po odpovědi
- `difficulty` — 1 (snadné), 2 (střední), 3 (těžké)

Pozor:
- `correct_answer` smí být POUZE `"y"` nebo `"i"`, nikdy `"ý"`, `"í"`, `"ú"` ani jiné
- `___` v template označuje přesně to jedno písmeno, které se cvičí; zbytek slova musí zůstat napsaný
- Věty musí být krátké, srozumitelné pro dítě 2.–4. třídy základní školy
- Každé slovo použij nejvýše jednou

Vygeneruj 20 vět pro písmeno **[DOPLŇ PÍSMENO]**.

---

Výstup zkopíruj a přidej do pole v `backend/src/modules/vyjmenovana-slova/seed.json`. Po přidání restartuj backend nebo proveď `docker-compose up --build`.

</details>

---

## Licence

Projekt je určen pro osobní a rodinné použití.
