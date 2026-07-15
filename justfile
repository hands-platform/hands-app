# HANDS local command shortcuts.
# These recipes wrap existing npm, docker, and git commands only.

set shell := ["powershell.exe", "-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command"]

default:
    @just --list

# Show available recipes.
list:
    @just --list

# Quick local status across git, compose services, and HANDS local scripts.
status:
    git status --short --branch
    docker compose ps
    npm.cmd run local:status

# Git status with branch and ahead/behind summary.
git-status:
    git status --short --branch
    git branch --show-current
    git rev-list --left-right --count "HEAD...@{upstream}"

# Docker Compose service status.
docker-status:
    docker compose ps

# Start only local dependency services. Does not start app/prod services.
docker-up:
    docker compose up -d postgres redis minio

# Stop Compose services without deleting volumes.
docker-down:
    docker compose down

# Start the HANDS local stack through the existing project script.
local-start:
    npm.cmd run local:start

# Check the HANDS local stack through the existing project script.
local-status:
    npm.cmd run local:status

# Stop the HANDS local stack through the existing project script.
local-stop:
    npm.cmd run local:stop

# Fast API verification.
api:
    npm.cmd run verify:api:fast

# Fast Admin Web verification.
admin:
    npm.cmd run verify:admin:fast

# Static final authority guard.
authority:
    npm.cmd run authority:check

# Safe pre-merge-ish local check without full WithServices smoke.
safe-check:
    git status --short --branch
    npm.cmd run verify:api:fast
    npm.cmd run verify:admin:fast
    npm.cmd run supabase:schema:check
    npm.cmd run supabase:location-exposure-smoke:test
    npm.cmd run supabase:key-validity:test
    npm.cmd run supabase:reachability:test
    npm.cmd run external:check:report:test
    npm.cmd run external:check:release:test
    npm.cmd run authority:check

# Focused API wallet and booking tests.
api-focused-wallet:
    npm.cmd run test --workspace @massage-vn/api -- bookings.service.spec.ts provider-wallet.policy.spec.ts

# Focused Admin shared component tests.
admin-components:
    npm.cmd run test --workspace @massage-vn/admin-web -- action-menu.spec.tsx filter-bar.spec.tsx money-text.spec.tsx status-badge.spec.tsx

# Lightweight smoke readiness check. Does not run full smoke.
smoke-status:
    docker compose ps
    npm.cmd run local:status
