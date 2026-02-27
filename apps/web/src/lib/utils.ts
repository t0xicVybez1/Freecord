import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns'
import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) { return clsx(inputs) }

export function formatMessageDate(date: string | Date): string {
  const d = new Date(date)
  if (isToday(d)) return `Today at ${format(d, 'h:mm a')}`
  if (isYesterday(d)) return `Yesterday at ${format(d, 'h:mm a')}`
  return format(d, 'MM/dd/yyyy')
}

export function formatTime(date: string | Date): string { return format(new Date(date), 'h:mm a') }
export function formatFullDate(date: string | Date): string { return format(new Date(date), 'MMMM d, yyyy h:mm a') }
export function formatRelative(date: string | Date): string { return formatDistanceToNow(new Date(date), { addSuffix: true }) }

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

export function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return `hsl(${Math.abs(hash) % 360}, 60%, 55%)`
}

export function getInitials(name: string): string {
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = { online: '#23a559', idle: '#f0b232', dnd: '#f23f43', invisible: '#80848e', offline: '#80848e' }
  return map[status] || '#80848e'
}

export function truncate(str: string, n: number): string {
  return str.length <= n ? str : str.slice(0, n) + '…'
}

export function debounce<T extends (...args: unknown[]) => unknown>(fn: T, ms: number): (...args: Parameters<T>) => void {
  let timer: number
  return (...args) => { clearTimeout(timer); timer = window.setTimeout(() => fn(...args), ms) }
}
