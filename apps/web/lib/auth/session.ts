const TOKEN_KEY = "token"
const USER_ID_KEY = "userId"

export function getToken() {
  if (typeof window === "undefined") return null
  return localStorage.getItem(TOKEN_KEY)
}

export function getUserId() {
  if (typeof window === "undefined") return null
  return localStorage.getItem(USER_ID_KEY)
}

export function saveSession(token: string, userId: string) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_ID_KEY, userId)
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_ID_KEY)
}

export function hasSession() {
  return Boolean(getToken() && getUserId())
}
