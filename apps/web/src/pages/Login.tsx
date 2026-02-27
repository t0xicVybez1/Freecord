import { useState, FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [mfaRequired, setMfaRequired] = useState(false)
  const [loading, setLoading] = useState(false)
  const login = useAuthStore(s => s.login)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(email, password, mfaRequired ? code : undefined)
      const redirect = searchParams.get('redirect')
      navigate(redirect || '/channels/@me', { replace: true })
    } catch (err: any) {
      if (err.message === 'mfa_required' || err.code === 400) {
        setMfaRequired(true)
        setError('')
      } else {
        setError(err.message || 'Invalid email or password')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-bg-primary rounded-lg shadow-2xl p-8 w-full max-w-md">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-brand rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg">💬</div>
        <h1 className="text-2xl font-bold text-white">Welcome back!</h1>
        <p className="text-text-muted mt-1">We're so excited to see you again!</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {!mfaRequired ? (
          <>
            <Input label="Email or Phone Number" type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Enter your email" required autoFocus />
            <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password" required />
          </>
        ) : (
          <Input label="Two-Factor Code" value={code} onChange={e => setCode(e.target.value)}
            placeholder="6-digit code" required autoFocus maxLength={6}
            helperText="Open your authenticator app and enter the 6-digit code." />
        )}
        {error && <p className="text-danger text-sm bg-danger/10 rounded p-2">{error}</p>}
        <Button type="submit" fullWidth loading={loading} size="lg">
          {mfaRequired ? 'Verify' : 'Log In'}
        </Button>
        {mfaRequired && (
          <Button type="button" variant="ghost" fullWidth onClick={() => setMfaRequired(false)}>
            Back to Login
          </Button>
        )}
      </form>
      <p className="mt-4 text-text-muted text-sm text-center">
        Need an account?{' '}
        <Link to="/register" className="text-text-link hover:underline">Register</Link>
      </p>
    </div>
  )
}
