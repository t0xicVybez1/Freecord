# Contributing to FreeCord

Thank you for your interest in contributing to FreeCord! This document outlines how to get started and our contribution guidelines.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork**
   ```bash
   git clone https://github.com/yourusername/freecord.git
   cd freecord
   ```
3. **Set up the development environment**
   ```bash
   ./scripts/setup.sh
   ./scripts/start-dev.sh
   ```

## Project Structure

```
freecord/
├── apps/
│   ├── api/         # Fastify REST API + Prisma ORM
│   ├── gateway/     # WebSocket gateway (real-time events)
│   ├── voice/       # MediaSoup WebRTC voice/video server
│   ├── cdn/         # File upload/serving with MinIO
│   └── web/         # React 18 web application
├── packages/
│   ├── types/       # Shared TypeScript types
│   ├── permissions/ # Permission system (BigInt bitfields)
│   ├── snowflake/   # Snowflake ID generation
│   ├── logger/      # Pino logger wrapper
│   └── markdown/    # Discord-flavored markdown renderer
├── infra/           # Docker Compose + Nginx configuration
├── scripts/         # Setup and utility scripts
└── docs/            # Technical documentation
```

## Development Workflow

### Branches

- `main` — stable, production-ready code
- `develop` — integration branch for new features
- `feature/your-feature` — your feature branches
- `fix/issue-description` — bug fix branches

### Making Changes

1. Create a feature branch from `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. Make your changes, commit often:
   ```bash
   git add -p  # stage hunks interactively
   git commit -m "feat: add voice channel member list"
   ```

3. Push and open a Pull Request against `develop`:
   ```bash
   git push origin feature/your-feature-name
   ```

### Commit Message Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]
[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
- `feat(api): add message search endpoint`
- `fix(gateway): handle reconnection race condition`
- `docs: update self-hosting guide`

## Code Style

- **TypeScript strict mode** — no `any` unless unavoidable
- **ESLint + Prettier** — run `pnpm lint` before committing
- **No default exports** from components (named exports only)
- **Zod validation** on all API request bodies

### API Development

When adding a new API endpoint:
1. Add the route in `apps/api/src/routes/`
2. Add Zod schema validation for request body/params
3. Update Prisma schema if adding new models (`pnpm db:migrate`)
4. Publish relevant gateway events via `publishEvent()`
5. Update `docs/API.md`

### Gateway Event Development

When adding a new gateway event:
1. Add the event name to `GatewayDispatchEventName` in `packages/types/src/gateway.ts`
2. Handle publishing in the API (usually in the route handler)
3. Handle receiving in `apps/gateway/src/subscriber.ts`
4. Handle the event in `apps/web/src/hooks/useGateway.ts`
5. Update `docs/GATEWAY_EVENTS.md`

### Frontend Development

- **Zustand** for global state — co-locate store logic
- **React Query** for async data (if needed, currently using direct `api.*` calls)
- **TailwindCSS** — use the custom Discord color palette (see `tailwind.config.js`)
- **Lucide React** for icons

## Testing

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @freecord/api test

# Run tests in watch mode
pnpm --filter @freecord/web test --watch
```

## Pull Request Guidelines

- **Small, focused PRs** are preferred over large ones
- Include a description of what changed and why
- Link any related GitHub issues
- Ensure CI passes before requesting review
- Request review from at least one maintainer

## Reporting Issues

Use [GitHub Issues](https://github.com/yourorg/freecord/issues) to report bugs or request features.

When reporting a bug, include:
- FreeCord version / commit hash
- Operating system and version
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs (from `docker compose logs`)

## Security Issues

**Please do not report security vulnerabilities in public GitHub issues.**

Instead, email `security@freecord.app` with:
- Description of the vulnerability
- Steps to reproduce
- Potential impact

We will respond within 48 hours and coordinate a fix and disclosure timeline with you.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
