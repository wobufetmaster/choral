# Docker-Based Installation Testing System

**Date:** 2025-11-16
**Status:** Approved Design

## Overview

Automated installation testing using Docker containers to verify that Choral can be installed from scratch on clean systems. Tests run automatically on pull requests when installation-related files change.

## Goals

1. Detect installation issues before they reach users
2. Test on multiple platforms (Ubuntu, Debian, WSL2)
3. Verify complete installation flow from zero to working application
4. Keep Docker as dev-dependency only (regular users don't need Docker)

## Architecture

### Components

1. **Test Runner Script** (`tests/install/run-tests.sh`)
   - Orchestrates the entire test suite
   - Spawns Docker containers for each platform
   - Executes installation and verification steps
   - Collects and reports results

2. **Platform Dockerfiles** (`tests/install/dockerfiles/`)
   - `ubuntu.Dockerfile` - Ubuntu 22.04 minimal
   - `debian.Dockerfile` - Debian 12 minimal
   - `wsl2.Dockerfile` - Ubuntu-based WSL2 simulation
   - Each starts completely clean (no Node.js pre-installed)

3. **GitHub Actions Workflow** (`.github/workflows/test-install.yml`)
   - Triggers on PR when relevant files change
   - Uses matrix strategy to parallelize platform tests
   - Reports results as PR check status

### Directory Structure

```
tests/
└── install/
    ├── run-tests.sh          # Main test orchestrator
    ├── dockerfiles/
    │   ├── ubuntu.Dockerfile
    │   ├── debian.Dockerfile
    │   └── wsl2.Dockerfile
    └── README.md             # How to run tests locally

.github/
└── workflows/
    └── test-install.yml      # GitHub Actions workflow
```

## Execution Flow

### Trigger Conditions

Tests run automatically on pull requests when these files change:
- `package.json` (dependency changes)
- `package-lock.json` (dependency resolution changes)
- `install.sh` (installation script changes)
- `tests/install/**` (test infrastructure changes)

Manual trigger also available via `workflow_dispatch` for ad-hoc testing.

### Test Execution Steps

For each platform:

1. **Container Spawn**: Create fresh Docker container from platform Dockerfile
2. **Source Injection**: Copy repository code into container at `/app`
3. **Installation**: Run `./install.sh` inside container
4. **Verification**:
   - Start Express server (`npm run dev:server`)
   - Wait for server ready (port 3000 listening)
   - Run Vite build (`npm run build`)
   - Verify build artifacts exist in `dist/`
5. **Cleanup**: Stop server, exit container
6. **Result Collection**: Capture exit codes and logs

### Expected Output

Local testing output:
```
Running installation tests...
[Ubuntu 22.04] ✓ Installation completed
[Ubuntu 22.04] ✓ Server started
[Ubuntu 22.04] ✓ Build succeeded
[Debian 12] ✓ Installation completed
[Debian 12] ✗ Server failed to start
  Error: Port 3000 already in use
[WSL2] ✓ All checks passed

Results: 2/3 platforms passed
```

GitHub Actions: Each platform as separate job, failed jobs show red X with logs.

## Error Handling

### Container Failures
- If container fails to start, log error and mark platform as FAILED
- Other platforms continue testing independently

### Installation Failures
- Capture stderr output from `install.sh`
- Include last 50 lines of output in test report
- Mark platform as FAILED
- Continue with next platform

### Verification Failures
- Collect relevant logs (server output, build errors)
- Mark specific verification step as failed
- Overall platform marked as FAILED

### Reporting
- GitHub Actions: PR check fails if ANY platform fails
- Logs are collapsible with full container output for debugging
- Each matrix job shows individual platform status

## Platform Dockerfiles

### ubuntu.Dockerfile
- Base: `ubuntu:22.04`
- No pre-installed Node.js
- Minimal packages (curl, git, build-essential as needed by install.sh)
- Represents typical Ubuntu server/desktop environment

### debian.Dockerfile
- Base: `debian:12`
- No pre-installed Node.js
- Similar minimal setup
- Tests Debian-based system compatibility

### wsl2.Dockerfile
- Base: `ubuntu:22.04` (WSL2 typically uses Ubuntu)
- Simulates WSL2 environment characteristics
- Tests Windows user installation path

## Maintenance & Extensibility

### Adding New Platforms
1. Create new Dockerfile in `tests/install/dockerfiles/`
2. Add platform name to matrix in `run-tests.sh`
3. GitHub Actions automatically includes it via matrix strategy

### Docker as Dev Dependency
- Docker NOT required in `package.json`
- Docker NOT required for regular users
- Only maintainers and CI runners need Docker
- Test artifacts added to `.gitignore`

## Success Criteria

- [ ] Tests run automatically on PR when relevant files change
- [ ] All three platforms (Ubuntu, Debian, WSL2) test successfully
- [ ] Installation completes without errors on clean systems
- [ ] Server starts successfully after installation
- [ ] Frontend builds successfully after installation
- [ ] Test failures are clearly reported with actionable logs
- [ ] Regular users can install without Docker
- [ ] New platforms can be added easily

## Future Enhancements (Out of Scope)

- API endpoint smoke tests (optional verification step)
- Performance benchmarks during installation
- Additional platforms (Arch, Fedora, macOS)
- Installation time tracking and reporting
