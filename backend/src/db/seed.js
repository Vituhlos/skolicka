export async function runSeed(pool, modules) {
  for (const mod of modules) {
    if (typeof mod.default.seed === 'function') {
      try {
        await mod.default.seed(pool);
        console.log(`Seed spuštěn pro modul: ${mod.default.id}`);
      } catch (err) {
        console.error(`Chyba seeding modulu ${mod.default.id}:`, err.message);
      }
    }
  }
}
