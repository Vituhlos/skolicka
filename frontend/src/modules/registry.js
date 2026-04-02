import vyjmenovanaSlova from './vyjmenovana-slova/index.jsx'
import nasobilka from './nasobilka/index.jsx'

const modules = [vyjmenovanaSlova, nasobilka]

export default modules
export const getModule = (id) => modules.find(m => m.id === id)
