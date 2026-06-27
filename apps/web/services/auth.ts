import { api } from "../lib/api"

export type AuthUser = {
  id: string
  username: string
  email: string
}

export type AuthResponse = {
  token: string
  user: AuthUser
}

export async function signInApi(email: string, password: string) {
  const { data } = await api.post<AuthResponse>("/auth/signin", {
    email,
    password,
  })
  return data
}

export async function signUpApi(
  username: string,
  email: string,
  password: string
) {
  const { data } = await api.post<AuthResponse>("/auth/signup", {
    username,
    email,
    password,
  })
  return data
}
