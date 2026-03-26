import vyjmenovanaSlova from './vyjmenovana-slova/index.jsx'

const modules = [vyjmenovanaSlova]

export default modules
export const getModule = (id) => modules.find(m => m.id === id)
