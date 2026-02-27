import { marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'

// Configure marked with syntax highlighting
marked.use(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext'
      return hljs.highlight(code, { language }).value
    },
  })
)

marked.setOptions({
  gfm: true,
  breaks: true,
})

// Custom renderer for Discord-style markdown
const renderer = new marked.Renderer()

// Spoiler tags: ||text||
renderer.text = (token) => {
  if (typeof token === 'string') {
    return token.replace(/\|\|(.+?)\|\|/g, '<span class="spoiler">$1</span>')
  }
  const text = typeof token === 'object' ? token.text : token
  return text.replace(/\|\|(.+?)\|\|/g, '<span class="spoiler">$1</span>')
}

marked.use({ renderer })

export function renderMarkdown(content: string, options?: { inline?: boolean }): string {
  if (!content) return ''

  // Handle Discord-specific syntax
  let processed = content
    // Escape HTML entities first
    .replace(/&/g, '&amp;')
    // User mentions: <@userId>
    .replace(/<@!?(\d+)>/g, '<span class="mention mention-user" data-user-id="$1">@User</span>')
    // Channel mentions: <#channelId>
    .replace(
      /<#(\d+)>/g,
      '<span class="mention mention-channel" data-channel-id="$1">#channel</span>'
    )
    // Role mentions: <@&roleId>
    .replace(/<@&(\d+)>/g, '<span class="mention mention-role" data-role-id="$1">@Role</span>')
    // Custom emojis: <:name:id> or <a:name:id>
    .replace(
      /<(a?):(\w+):(\d+)>/g,
      '<img class="emoji custom-emoji" data-animated="$1" data-name="$2" data-id="$3" alt=":$2:" />'
    )

  if (options?.inline) {
    return marked.parseInline(processed) as string
  }

  return marked.parse(processed) as string
}

export function stripMarkdown(content: string): string {
  return content
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\|\|(.+?)\|\|/g, '$1')
    .replace(/<@!?(\d+)>/g, '@user')
    .replace(/<#(\d+)>/g, '#channel')
    .replace(/<@&(\d+)>/g, '@role')
    .replace(/<a?:\w+:\d+>/g, ':emoji:')
}
