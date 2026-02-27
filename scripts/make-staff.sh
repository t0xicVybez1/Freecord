#!/usr/bin/env bash
# Usage: ./scripts/make-staff.sh <username>
# Makes a user a Freecord staff member (gives access to the admin portal).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

USERNAME="${1:-}"
if [[ -z "$USERNAME" ]]; then
  echo "Usage: $0 <username>"
  exit 1
fi

# Load .env
set -a
[[ -f "$PROJECT_ROOT/.env" ]] && source "$PROJECT_ROOT/.env"
set +a

cd "$PROJECT_ROOT/apps/api"

# Use prisma to update the user
node --input-type=module <<EOF
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const user = await prisma.user.findUnique({ where: { username: '${USERNAME}' } })
if (!user) { console.error('User not found: ${USERNAME}'); process.exit(1) }
await prisma.user.update({ where: { id: user.id }, data: { isStaff: true } })
console.log('✅ @${USERNAME} is now a staff member (admin portal access granted)')
await prisma.\$disconnect()
EOF
