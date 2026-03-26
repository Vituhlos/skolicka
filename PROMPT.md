# CLAUDE CODE PROMPT — Školička (modulární vzdělávací platforma)

## PŘED ZAČÁTKEM KÓDOVÁNÍ — POVINNÉ KROKY

Před tím než napíšeš jediný řádek kódu, proveď tyto dva kroky v tomto pořadí:

**Krok 1:** Spusť design system generátor z ui-ux-pro-max skillu:
```
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "children educational gamified learning app czech language" --design-system -p "Skolnicka"
```
Výstup použij jako základ pro všechna designová rozhodnutí (barvy, fonty, styl, efekty, anti-patterns).

**Krok 2:** Přečti `.claude/skills/frontend-design/SKILL.md` a aplikuj jeho principy — unikátní typografie, výrazná kompozice, žádné generické AI vzory.

Teprve po těchto dvou krocích začni kódovat.

---

## CO STAVÍME

**Školička** — modulární vzdělávací platforma pro děti, běžící jako Docker container na domácím serveru. Platforma je navržena jako rozšiřitelný systém modulů. Každý modul reprezentuje jedno téma (vyjmenovaná slova, násobilka, angličtina...) a může obsahovat více typů cvičení. Sdílená infrastruktura (profily, XP, streak, odznaky) funguje napříč všemi moduly.

**V první verzi implementuj jeden modul:** vyjmenovana-slova s jedním typem cvičení: doplňování i/y do vět.

Architektura musí být od základu připravena na přidávání dalších modulů a typů cvičení bez změny core kódu — pouze přidáním nového adresáře modulu.

---

## TECH STACK

- **Frontend:** React 19 + Vite 8 + Tailwind CSS 4
- **Backend:** Node.js 22 LTS + Express 5
- **Databáze:** PostgreSQL 17
- **Deployment:** Docker Compose (tři kontejnery: frontend, backend, postgres)
- **Porty:** Frontend 3000, Backend 3001, PostgreSQL 5432

Vždy použij nejnovější stabilní verze všech závislostí. V Dockerfiles:
- Frontend + Backend: FROM node:22-alpine
- PostgreSQL: image: postgres:17-alpine

---

## STRUKTURA PROJEKTU

```
skolnicka/
├── docker-compose.yml
├── .env.example
├── README.md
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── components/         — sdílené komponenty (streak, XP, badges...)
│       ├── pages/              — Home, ModuleSelect, ParentDashboard
│       └── modules/            — frontend modul registry
│           └── vyjmenovana-slova/
│               ├── index.jsx   — modul metadata + registrace
│               └── FillInExercise.jsx
└── backend/
    ├── Dockerfile
    ├── package.json
    └── src/
        ├── index.js
        ├── core/               — sdílená logika (profiles, auth, streaks, badges, XP)
        │   ├── profiles.js
        │   ├── auth.js
        │   ├── streaks.js
        │   ├── badges.js
        │   └── spaced-repetition.js
        ├── db/
        │   ├── migrations/
        │   └── seed.js         — spustí seed všech modulů
        └── modules/
            └── vyjmenovana-slova/
                ├── index.js    — definice modulu, registrace routes
                ├── routes.js
                ├── questions.js
                └── seed.json
```

---

## MODULÁRNÍ ARCHITEKTURA — PRAVIDLA

### Definice modulu (backend)

Každý modul musí exportovat tento interface z modules/<id>/index.js:

```javascript
export default {
  id: 'vyjmenovana-slova',
  name: 'Vyjmenovaná slova',
  description: 'Procvičuj i a y ve větách',
  icon: 'BookOpen',
  color: '#F97316',
  exerciseTypes: ['fill-in'],
  registerRoutes: (app) => { /* zaregistruje /api/modules/vyjmenovana-slova/* */ }
}
```

### Auto-discovery modulů (backend)

src/index.js při startu automaticky načte všechny moduly z src/modules/*/index.js:

```javascript
const moduleFiles = glob.sync('./modules/*/index.js', { cwd: __dirname });
for (const file of moduleFiles) {
  const mod = await import(path.resolve(__dirname, file));
  mod.default.registerRoutes(app);
  console.log(`Modul načten: ${mod.default.name}`);
}
```

Přidání nového modulu = přidání adresáře. Žádná změna v core kódu.

### Definice modulu (frontend)

Každý frontend modul exportuje z modules/<id>/index.jsx:

```javascript
export default {
  id: 'vyjmenovana-slova',
  name: 'Vyjmenovaná slova',
  description: 'Procvičuj i a y ve větách',
  icon: 'BookOpen',
  color: '#F97316',
  ExerciseComponent: FillInExercise,
}
```

Frontend načítá moduly z centrálního registry souboru src/modules/registry.js.

---

## DATABÁZOVÝ MODEL

### Core tabulky (sdílené)

**child_profiles**
```sql
id, name (varchar 50), avatar_url (nullable), color (varchar 7), created_at, is_active (boolean default true)
```

**sessions**
```sql
id, profile_id (FK), module_id (varchar), exercise_type (varchar), started_at, ended_at, total_answers, correct_answers, metadata (JSONB)
```

**answers**
```sql
id, session_id (FK), item_id (integer), given_answer (text), is_correct, response_time_ms, answered_at
```

**item_progress** — generická spaced repetition pro všechny moduly
```sql
id, profile_id (FK), module_id (varchar), item_id (integer), times_seen, times_correct, interval_days (integer default 1), ease_factor (float default 2.5), last_seen_at, next_due_at
```
Unikátní constraint: (profile_id, module_id, item_id)

**streaks**
```sql
id, profile_id (FK), date (date), xp_earned, modules_practiced (JSONB)
```
Unikátní constraint: (profile_id, date)

**badges**
```sql
id, profile_id (FK), badge_key (varchar), module_id (varchar nullable), name, description, icon, earned_at
```
Unikátní constraint: (profile_id, badge_key)

**xp_log**
```sql
id, profile_id (FK), amount, reason (varchar), module_id (varchar nullable), created_at
```

### Modul-specifické tabulky — vyjmenovaná slova

**vslov_words**
```sql
id, letter (varchar 1), word (text), created_at
```

**vslov_sentences**
```sql
id, word_id (FK vslov_words.id), template (text s ___), correct_answer (varchar 1), display_word (text), difficulty (1-3), created_at
```

---

## SPACED REPETITION (core — sdílená)

SM-2 algoritmus v src/core/spaced-repetition.js:

```javascript
export function updateItemProgress(progress, isCorrect, responseTimeMs) {
  const quality = isCorrect ? (responseTimeMs < 3000 ? 5 : 4) : 1;
  if (quality >= 3) {
    if (progress.times_seen === 0) progress.interval_days = 1;
    else if (progress.times_seen === 1) progress.interval_days = 6;
    else progress.interval_days = Math.round(progress.interval_days * progress.ease_factor);
  } else {
    progress.interval_days = 1;
  }
  progress.ease_factor = Math.max(1.3,
    progress.ease_factor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
  );
  progress.next_due_at = new Date(Date.now() + progress.interval_days * 86400000);
  progress.times_seen += 1;
  if (isCorrect) progress.times_correct += 1;
  return progress;
}
```

Výběr položek pro sezení — priority:
1. Položky po splatnosti (next_due_at <= now)
2. Nikdy neviděné
3. Nejvyšší chybovost
4. Náhodný fill

Sezení: 15 položek, boss level: 20 položek.

---

## GAMIFIKACE (core — sdílená)

### XP
- Správná odpověď: +10 XP
- Rychlá správná (<3s): +15 XP
- Sezení bez chyby: +50 XP bonus
- Boss level: +100 XP

### Streak
- Min. 10 odpovědí v libovolném modulu za den = +1 den
- Reset při vynechání dne

### Denní cíl: 15 odpovědí napříč moduly

### Boss Level (modul vyjmenovaná slova)
- Podmínka odemčení: >70% na min. 4 písmenech
- 20 smíšených vět, časový limit 60s/věta

### Globální odznaky

| badge_key | podmínka |
|---|---|
| first_correct | 1. správná odpověď |
| streak_3 / streak_7 / streak_30 | streak >= N |
| answers_100 / answers_500 | celkem >= N |
| perfect_session | sezení bez chyby |
| speed_demon | 10 správných pod 3s za sebou |
| multi_module | aktivita ve 2+ modulech |

### Modul-specifické odznaky — vyjmenovaná slova

| badge_key | podmínka |
|---|---|
| vslov_master_b/l/m/p/s/v/z | >80% na písmenu, min. 20 odpovědí |
| vslov_boss_defeated | dokončení boss levelu |

---

## ZVUKY (Web Audio API)

```javascript
// src/core/sounds.js
export function playCorrect() {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.frequency.setValueAtTime(523, ctx.currentTime);
  osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
  osc.start(); osc.stop(ctx.currentTime + 0.4);
}
export function playWrong() {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.connect(gain); gain.connect(ctx.destination);
  osc.frequency.setValueAtTime(200, ctx.currentTime);
  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
  osc.start(); osc.stop(ctx.currentTime + 0.3);
}
```

Volitelně vypnutelné — stav v localStorage.

---

## UŽIVATELSKÉ PROFILY

### Homepage — výběr profilu
- Karty: avatar, jméno, streak, celkové XP
- Tlačítko "+ Přidat dítě" (chráněno PINem)
- Editace / soft-delete na kartě (chráněno PINem)
- Tlačítko "Rodičovský přehled" vpravo nahoře

### Výběr modulu (po kliknutí na profil)
- Karty modulů (ikona, název, popis, barva modulu)
- Globální denní progress bar (X/15 odpovědí dnes)
- Streak badge

### Správa profilů
- Jméno, avatar (jpg/png max 2MB), barva ze sady 8 barev
- Avatary: backend/uploads/avatars/{profile_id}.jpg
- Soft delete (is_active = false)

### Rodič
- 4místný PIN (bcrypt hash v .env, výchozí 1234)
- JWT session 30 minut
- Dashboard: přepínač profilů + přepínač modulů

---

## FRONTEND — OBRAZOVKY

### 1. Homepage
Karty profilů + přidat + rodičovský přehled.

### 2. Výběr modulu
Karty modulů, denní progress, streak. V první verzi: 1 karta.

### 3. Cvičení Fill-in (vyjmenovaná slova)

Hlavička: streak + flame, XP, zvuk toggle, progress bar (3/15)

Věta: velký font (min 22px), výrazné ___

Tlačítka i / y:
- Min výška 80px
- box-shadow: 0 4px 0 {darker_color}
- Při stisku: translateY(4px) + shadow 0
- Po odpovědi: zelené/červené + správné slovo s barevnou i/y

Po sezení: skóre, XP, nové odznaky, tlačítko znovu / hotovo.

### 4. Odznaky
Globální + modul-specifické. Zamčené šedé, odemčené barevné, datum odemčení.

### 5. Rodičovský dashboard

Globální pohled:
- Celkem XP, streak, dnů cvičení, celkem odpovědí
- Časová osa 30 dní
- Přehled aktivity podle modulů

Pohled modul — vyjmenovaná slova:
- Sloupcový graf B/L/M/P/S/V/Z (červená <60% / žlutá 60-79% / zelená >=80%)
- Nejproblematičtější slova — top 20, min. 5 zobrazení
- Čas cvičení — celkem + graf 14 dní

PDF Export: jsPDF + html2canvas, report za měsíc.

---

## DESIGN BRIEF

Inspirace: Duolingo — mačkací tlačítka, syté barvy, čistý layout, gamifikace jako součást UI.

Vlastní identita:
- Barevná paleta z výstupu ui-ux-pro-max — NE Duolingo zelená (#58CC02)
- Font: NE Nunito. Charakterní bold display font z Google Fonts
- Každý modul má vlastní barvu (color pole v definici modulu)

Technické požadavky:
- Tlačítka odpovědi: min 80px, fyzický stisknutý efekt
- Správná odpověď: zelené pozadí + checkmark animace
- Špatná odpověď: červené pozadí + shake
- Streak flame: pulzující animace
- Přechody: 150–300ms ease
- Responsive: 375px – 1280px
- Pouze light mode
- Ikony: Lucide React, žádné emoji jako ikony

Anti-patterns — NIKDY:
- Inter / Roboto jako hlavní font
- Fialové / šedé gradienty
- shadcn/ui defaultní vzhled bez úprav
- Bílé pozadí s modrými akcenty
- Malá tlačítka

---

## API ENDPOINTS

### Core
```
GET    /api/health
GET    /api/modules                              — seznam modulů (id, name, icon, color)

GET    /api/profiles
POST   /api/profiles                             (PIN)
PUT    /api/profiles/:id                         (PIN)
DELETE /api/profiles/:id                         (PIN)
POST   /api/profiles/:id/avatar
GET    /api/profiles/:id/avatar

GET    /api/stats/overview?profile_id=X
GET    /api/stats/timeline?profile_id=X&days=30
GET    /api/stats/by-module?profile_id=X

GET    /api/badges?profile_id=X
GET    /api/streak?profile_id=X
GET    /api/xp?profile_id=X

POST   /api/auth/verify-pin
POST   /api/auth/change-pin
```

### Modul: vyjmenovaná slova
```
GET    /api/modules/vyjmenovana-slova/session?profile_id=X
POST   /api/modules/vyjmenovana-slova/session/start
POST   /api/modules/vyjmenovana-slova/session/:id/answer
POST   /api/modules/vyjmenovana-slova/session/:id/end
GET    /api/modules/vyjmenovana-slova/stats?profile_id=X
GET    /api/modules/vyjmenovana-slova/boss/status?profile_id=X
GET    /api/modules/vyjmenovana-slova/boss/session?profile_id=X
```

Každý budoucí modul přidá /api/modules/<slug>/* bez úpravy core.

---

## SEED DATA

3 věty na písmeno (B, L, M, P, S, V, Z) = 21 vět celkem.
Soubor: backend/src/modules/vyjmenovana-slova/seed.json

```json
[
  {
    "letter": "B",
    "word": "být",
    "template": "Dnes ráno jsem ___ nemocný.",
    "correct_answer": "y",
    "display_word": "byl",
    "difficulty": 1
  },
  {
    "letter": "B",
    "word": "bydlet",
    "template": "Babička ___dlí na vesnici.",
    "correct_answer": "y",
    "display_word": "bydlí",
    "difficulty": 1
  },
  {
    "letter": "B",
    "word": "být",
    "template": "Venku ___lo velké vedro.",
    "correct_answer": "y",
    "display_word": "bylo",
    "difficulty": 1
  }
]
```

Přidání dalších vět = pouze restart containeru, žádná změna v kódu.

---

## DOCKER COMPOSE

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: ${DB_NAME:-skolnicka}
      POSTGRES_USER: ${DB_USER:-skolnicka}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://${DB_USER:-skolnicka}:${DB_PASSWORD}@postgres:5432/${DB_NAME:-skolnicka}
      PARENT_PIN_HASH: ${PARENT_PIN_HASH}
      JWT_SECRET: ${JWT_SECRET}
      NODE_ENV: production
    volumes:
      - avatars_data:/app/uploads/avatars
    depends_on:
      - postgres
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    environment:
      VITE_API_URL: ${API_URL:-http://localhost:3001}
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
  avatars_data:
```

### .env.example
```
DB_PASSWORD=changeme
DB_USER=skolnicka
DB_NAME=skolnicka
PARENT_PIN_HASH=$2b$10$...
JWT_SECRET=change-this-to-random-string
API_URL=http://localhost:3001
```

---

## BACKEND STARTUP

1. Čekat na PostgreSQL (retry s exponential backoff)
2. Spustit migrace (core + modul-specifické tabulky)
3. Auto-discovery modulů — načíst seed každého modulu pokud jsou tabulky prázdné
4. Spustit Express server

---

## CHECKLIST

- [ ] docker-compose up funguje od nuly
- [ ] Auto-discovery modulů funguje (log "Modul načten: ...")
- [ ] Seed se načte automaticky per modul
- [ ] Profily: přidání / editace / mazání / avatary fungují
- [ ] Každý profil má oddělené statistiky, XP, streak, odznaky
- [ ] Výběr modulu po výběru profilu funguje
- [ ] Cvičení fill-in funguje end-to-end
- [ ] Spaced repetition ovlivňuje výběr
- [ ] Streak + XP se počítají správně
- [ ] Alespoň 3 odznaky se odemykají
- [ ] Boss level funguje
- [ ] Dashboard: globální + modul-specifický pohled, přepínač profilů
- [ ] PDF export funguje
- [ ] PIN ochrana, JWT session 30 min
- [ ] Responsive 375px – 1280px
- [ ] Vše česky, žádný anglický text pro uživatele
- [ ] README: spuštění, přidání modulu, změna PINu

---

## PRIORITA IMPLEMENTACE

1. Core infrastruktura (DB migrace, profily, auth)
2. Modulový systém (auto-discovery, routes)
3. Modul vyjmenovaná slova (seed, session API, spaced repetition)
4. Frontend (homepage → výběr modulu → cvičení → shrnutí)
5. Gamifikace (XP, streak, odznaky)
6. Rodičovský dashboard + PDF export

Kóduj vše kompletně — žádné TODO komentáře ani placeholder funkce.
