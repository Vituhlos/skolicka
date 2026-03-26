const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

async function request(path, options = {}) {
  const { headers: optHeaders, ...restOptions } = options
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...optHeaders },
    ...restOptions
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

function toQuery(params) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value))
    }
  })
  return query.toString()
}

export const api = {
  getProfiles: () => request('/api/profiles'),
  createProfile: (data, token) => request('/api/profiles', { method: 'POST', body: JSON.stringify(data), headers: { Authorization: `Bearer ${token}` } }),
  updateProfile: (id, data, token) => request(`/api/profiles/${id}`, { method: 'PUT', body: JSON.stringify(data), headers: { Authorization: `Bearer ${token}` } }),
  deleteProfile: (id, token) => request(`/api/profiles/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }),
  uploadAvatar: (id, formData, token) => fetch(`${BASE_URL}/api/profiles/${id}/avatar`, { method: 'POST', body: formData, headers: { Authorization: `Bearer ${token}` } }).then(async (r) => {
    if (!r.ok) {
      const err = await r.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${r.status}`)
    }
    return r.json()
  }),

  verifyPin: (pin) => request('/api/auth/verify-pin', { method: 'POST', body: JSON.stringify({ pin }) }),

  getModules: () => request('/api/modules'),

  getSession: (moduleId, profileId) => request(`/api/modules/${moduleId}/session?profile_id=${profileId}`),
  startSession: (moduleId, profileId, letters) => request(`/api/modules/${moduleId}/session/start`, { method: 'POST', body: JSON.stringify({ profile_id: profileId, letters: letters || null }) }),
  submitAnswer: (moduleId, sessionId, data) => request(`/api/modules/${moduleId}/session/${sessionId}/answer`, { method: 'POST', body: JSON.stringify(data) }),
  endSession: (moduleId, sessionId, profileId) => request(`/api/modules/${moduleId}/session/${sessionId}/end`, { method: 'POST', body: JSON.stringify({ profile_id: profileId }) }),

  getStats: (profileId) => request(`/api/stats/overview?profile_id=${profileId}`),
  getTimeline: (profileId, days = 30) => request(`/api/stats/timeline?profile_id=${profileId}&days=${days}`),
  getModuleStats: (moduleId, profileId) => request(`/api/modules/${moduleId}/stats?profile_id=${profileId}`),
  getBossStatus: (moduleId, profileId) => request(`/api/modules/${moduleId}/boss/status?profile_id=${profileId}`),
  getLetterProgress: (profileId) => request(`/api/modules/vyjmenovana-slova/letter-progress?profile_id=${profileId}`),

  getBadges: (profileId) => request(`/api/badges?profile_id=${profileId}`),
  getStreak: (profileId) => request(`/api/streak?profile_id=${profileId}`),
  getXP: (profileId) => request(`/api/xp?profile_id=${profileId}`),

  getStatsTimeline: (profileId, days = 30) => request(`/api/stats/timeline?profile_id=${profileId}&days=${days}`),
  getStatsByModule: (profileId) => request(`/api/stats/by-module?profile_id=${profileId}`),
  getRecentSessions: (profileId, options = {}) => request(`/api/sessions/recent?${toQuery({ profile_id: profileId, limit: options.limit, module_id: options.moduleId })}`),
  getSessionDetail: (profileId, sessionId) => request(`/api/sessions/${sessionId}?${toQuery({ profile_id: profileId })}`),

  adminGetSentences: (token) => request('/api/modules/vyjmenovana-slova/admin/sentences', { headers: { Authorization: `Bearer ${token}` } }),
  adminAddSentence: (data, token) => request('/api/modules/vyjmenovana-slova/admin/sentences', { method: 'POST', body: JSON.stringify(data), headers: { Authorization: `Bearer ${token}` } }),
  adminBulkImport: (sentences, token) => request('/api/modules/vyjmenovana-slova/admin/sentences/bulk', { method: 'POST', body: JSON.stringify({ sentences }), headers: { Authorization: `Bearer ${token}` } }),
  adminDeleteSentence: (id, token) => request(`/api/modules/vyjmenovana-slova/admin/sentences/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }),
}

export { BASE_URL as BASE_API_URL }
