# Installation Tests

Automated Docker-based tests that verify Choral can be installed from scratch on clean systems.

## Platforms Tested

- Ubuntu 22.04 (minimal, no pre-installed Node.js)
- Debian 12 (minimal, no pre-installed Node.js)
- WSL2 (Ubuntu-based)

## Running Tests Locally

```bash
cd tests/install
./run-tests.sh
```

**Requirements:**
- Docker installed and running
- Bash shell

## What Gets Tested

For each platform:
1. ✅ Installation completes without errors (`./install.sh`)
2. ✅ Server starts successfully (`npm run dev:server`)
3. ✅ Frontend builds successfully (`npm run build`)

## GitHub Actions

Tests run automatically on pull requests when these files change:
- `package.json`
- `package-lock.json`
- `install.sh`
- `tests/install/**`

Manual trigger also available via workflow_dispatch.

## Adding New Platforms

1. Create new Dockerfile in `tests/install/dockerfiles/`
2. Add platform to `PLATFORMS` array in `run-tests.sh`
3. Tests automatically include new platform
