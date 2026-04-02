async function loadRoutes() {
  const { default: router } = await import('./routes.js')
  return router
}

export default {
  id: 'nasobilka',
  name: 'Násobilka',
  description: 'Procvičuj násobilku od 1 do 10',
  icon: 'Hash',
  color: '#8B5CF6',
  exerciseTypes: ['multiply'],
  registerRoutes: async (app) => {
    const router = await loadRoutes()
    app.use('/api/modules/nasobilka', router)
  }
}
