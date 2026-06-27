import { AuthLayout } from "@/components/auth/auth-layout"
import { LoginForm } from "@/components/auth/login-form"

export default function LoginPage() {
  return (
    <AuthLayout title="Log in">
      <LoginForm />
    </AuthLayout>
  )
}
