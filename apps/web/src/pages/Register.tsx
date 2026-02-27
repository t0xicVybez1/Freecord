import { useState, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function RegisterPage() {
  const [form, setForm] = useState({ username: '', email: '', password: '', dob: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const register = useAuthStore(s => s.register)

  const validate = () => {
    const e: Record<string, string> = {}
    if (form.username.length < 2) e.username = 'Username must be at least 2 characters'
    if (form.username.length > 32) e.username = 'Username cannot exceed 32 characters'
    if (!/^[a-zA-Z0-9_.]+$/.test(form.username)) e.username = 'Username can only contain letters, numbers, underscores, and dots'
    if (!form.email.includes('@')) e.email = 'Please enter a valid email address'
    if (form.password.length < 8) e.password = 'Password must be at least 8 characters'
    return e
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    setErrors({})
    try {
      await register(form.username, form.email, form.password)
    } catch (err: any) {
      const msg = err.message || 'Registration failed'
      if (msg.includes('email')) setErrors({ email: msg })
      else if (msg.includes('username')) setErrors({ username: msg })
      else setErrors({ form: msg })
    } finally {
      setLoading(false)
    }
  }

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  return (
    <div className="bg-bg-primary rounded-lg shadow-2xl p-8 w-full max-w-md">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-brand rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg">💬</div>
        <h1 className="text-2xl font-bold text-white">Create an account</h1>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Email" type="email" value={form.email} onChange={set('email')}
          placeholder="Enter your email" required error={errors.email} />
        <Input label="Username" value={form.username} onChange={set('username')}
          placeholder="Choose a username" required error={errors.username} />
        <Input label="Password" type="password" value={form.password} onChange={set('password')}
          placeholder="Create a password" required error={errors.password} />
        <Input label="Date of Birth" type="date" value={form.dob} onChange={set('dob')}
          helperText="We use this to verify your age." />
        {errors.form && <p className="text-danger text-sm bg-danger/10 rounded p-2">{errors.form}</p>}
        <Button type="submit" fullWidth loading={loading} size="lg">Continue</Button>
      </form>
      <p className="mt-4 text-xs text-text-muted">
        By registering, you agree to FreeCord's Terms of Service and Privacy Policy.
      </p>
      <p className="mt-3 text-text-muted text-sm">
        Already have an account?{' '}
        <Link to="/login" className="text-text-link hover:underline">Log In</Link>
      </p>
    </div>
  )
}
