# Docker-Based Installation Testing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create automated Docker-based installation tests that verify Choral can be installed from scratch on clean Ubuntu, Debian, and WSL2 systems.

**Architecture:** Bash test orchestrator spawns Docker containers for each platform, executes `install.sh` inside containers, verifies server starts and frontend builds successfully. GitHub Actions runs tests automatically when dependency or installation files change.

**Tech Stack:** Docker, Bash, GitHub Actions

---

## Task 1: Create Test Directory Structure

**Files:**
- Create: `tests/install/dockerfiles/.gitkeep`
- Create: `tests/install/README.md`

**Step 1: Create directory structure**

```bash
mkdir -p tests/install/dockerfiles
touch tests/install/dockerfiles/.gitkeep
```

**Step 2: Create README documentation**

Create `tests/install/README.md`:

```markdown
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
```

**Step 3: Verify files created**

```bash
ls -la tests/install/
ls -la tests/install/dockerfiles/
```

Expected: Directory structure exists with README.md

**Step 4: Commit**

```bash
git add tests/install/
git commit -m "chore: create installation test directory structure"
```

---

## Task 2: Create Ubuntu Dockerfile

**Files:**
- Create: `tests/install/dockerfiles/ubuntu.Dockerfile`

**Step 1: Create Ubuntu Dockerfile**

Create `tests/install/dockerfiles/ubuntu.Dockerfile`:

```dockerfile
# Ubuntu 22.04 minimal installation test environment
FROM ubuntu:22.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install minimal required packages
# Note: install.sh should handle Node.js installation
RUN apt-get update && apt-get install -y \
    curl \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy repository code
COPY . .

# The test script will run ./install.sh
```

**Step 2: Verify Dockerfile syntax**

```bash
docker build -f tests/install/dockerfiles/ubuntu.Dockerfile -t choral-test-ubuntu --no-cache .
```

Expected: Build completes successfully (may take a few minutes)

**Step 3: Clean up test image**

```bash
docker rmi choral-test-ubuntu
```

**Step 4: Commit**

```bash
git add tests/install/dockerfiles/ubuntu.Dockerfile
git commit -m "chore: add Ubuntu Dockerfile for installation tests"
```

---

## Task 3: Create Debian Dockerfile

**Files:**
- Create: `tests/install/dockerfiles/debian.Dockerfile`

**Step 1: Create Debian Dockerfile**

Create `tests/install/dockerfiles/debian.Dockerfile`:

```dockerfile
# Debian 12 minimal installation test environment
FROM debian:12

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install minimal required packages
# Note: install.sh should handle Node.js installation
RUN apt-get update && apt-get install -y \
    curl \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy repository code
COPY . .

# The test script will run ./install.sh
```

**Step 2: Verify Dockerfile syntax**

```bash
docker build -f tests/install/dockerfiles/debian.Dockerfile -t choral-test-debian --no-cache .
```

Expected: Build completes successfully

**Step 3: Clean up test image**

```bash
docker rmi choral-test-debian
```

**Step 4: Commit**

```bash
git add tests/install/dockerfiles/debian.Dockerfile
git commit -m "chore: add Debian Dockerfile for installation tests"
```

---

## Task 4: Create WSL2 Dockerfile

**Files:**
- Create: `tests/install/dockerfiles/wsl2.Dockerfile`

**Step 1: Create WSL2 Dockerfile**

Create `tests/install/dockerfiles/wsl2.Dockerfile`:

```dockerfile
# WSL2 simulation (Ubuntu-based) installation test environment
FROM ubuntu:22.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Simulate WSL2 environment characteristics
# WSL2 typically uses Ubuntu as base
RUN apt-get update && apt-get install -y \
    curl \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy repository code
COPY . .

# The test script will run ./install.sh
```

**Step 2: Verify Dockerfile syntax**

```bash
docker build -f tests/install/dockerfiles/wsl2.Dockerfile -t choral-test-wsl2 --no-cache .
```

Expected: Build completes successfully

**Step 3: Clean up test image**

```bash
docker rmi choral-test-wsl2
```

**Step 4: Commit**

```bash
git add tests/install/dockerfiles/wsl2.Dockerfile
git commit -m "chore: add WSL2 Dockerfile for installation tests"
```

---

## Task 5: Create Test Runner Script (Part 1 - Setup and Functions)

**Files:**
- Create: `tests/install/run-tests.sh`

**Step 1: Create test runner script header and functions**

Create `tests/install/run-tests.sh`:

```bash
#!/usr/bin/env bash

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Platforms to test
PLATFORMS=("ubuntu" "debian" "wsl2")

# Track results
PASSED=0
FAILED=0
declare -A FAILURES

# Function to print colored output
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to test a single platform
test_platform() {
    local platform=$1
    local dockerfile="tests/install/dockerfiles/${platform}.Dockerfile"
    local image_name="choral-test-${platform}"
    local container_name="choral-test-${platform}-container"

    log_info "Testing ${platform}..."

    # Build Docker image
    log_info "[${platform}] Building Docker image..."
    if ! docker build -f "$dockerfile" -t "$image_name" . &> "/tmp/choral-test-${platform}-build.log"; then
        log_error "[${platform}] ✗ Docker build failed"
        cat "/tmp/choral-test-${platform}-build.log" | tail -50
        FAILURES[$platform]="Docker build failed"
        ((FAILED++))
        return 1
    fi

    # Run installation in container
    log_info "[${platform}] Running installation..."
    if ! docker run --name "$container_name" "$image_name" bash -c "./install.sh" &> "/tmp/choral-test-${platform}-install.log"; then
        log_error "[${platform}] ✗ Installation failed"
        cat "/tmp/choral-test-${platform}-install.log" | tail -50
        docker rm -f "$container_name" 2>/dev/null || true
        docker rmi "$image_name" 2>/dev/null || true
        FAILURES[$platform]="Installation failed"
        ((FAILED++))
        return 1
    fi
    log_info "[${platform}] ✓ Installation completed"

    # Commit the container to preserve installation
    docker commit "$container_name" "${image_name}-installed" > /dev/null
    docker rm -f "$container_name" 2>/dev/null || true

    # Test server startup
    log_info "[${platform}] Testing server startup..."
    if ! docker run --name "$container_name" -d "${image_name}-installed" bash -c "npm run dev:server" &> "/tmp/choral-test-${platform}-server.log"; then
        log_error "[${platform}] ✗ Server start failed"
        cat "/tmp/choral-test-${platform}-server.log" | tail -50
        docker rm -f "$container_name" 2>/dev/null || true
        docker rmi "$image_name" "${image_name}-installed" 2>/dev/null || true
        FAILURES[$platform]="Server start failed"
        ((FAILED++))
        return 1
    fi

    # Wait for server to be ready (check port 3000)
    sleep 5
    if docker exec "$container_name" bash -c "curl -s http://localhost:3000 > /dev/null"; then
        log_info "[${platform}] ✓ Server started"
    else
        log_error "[${platform}] ✗ Server failed to respond"
        docker logs "$container_name" | tail -50
        docker rm -f "$container_name" 2>/dev/null || true
        docker rmi "$image_name" "${image_name}-installed" 2>/dev/null || true
        FAILURES[$platform]="Server not responding"
        ((FAILED++))
        return 1
    fi

    # Stop server container
    docker stop "$container_name" > /dev/null 2>&1 || true
    docker rm -f "$container_name" 2>/dev/null || true

    # Test frontend build
    log_info "[${platform}] Testing frontend build..."
    if ! docker run --name "$container_name" "${image_name}-installed" bash -c "npm run build" &> "/tmp/choral-test-${platform}-build-frontend.log"; then
        log_error "[${platform}] ✗ Build failed"
        cat "/tmp/choral-test-${platform}-build-frontend.log" | tail -50
        docker rm -f "$container_name" 2>/dev/null || true
        docker rmi "$image_name" "${image_name}-installed" 2>/dev/null || true
        FAILURES[$platform]="Frontend build failed"
        ((FAILED++))
        return 1
    fi

    # Verify build artifacts exist
    if docker run --rm "${image_name}-installed" bash -c "test -d dist"; then
        log_info "[${platform}] ✓ Build succeeded"
    else
        log_error "[${platform}] ✗ Build artifacts not found"
        docker rm -f "$container_name" 2>/dev/null || true
        docker rmi "$image_name" "${image_name}-installed" 2>/dev/null || true
        FAILURES[$platform]="Build artifacts missing"
        ((FAILED++))
        return 1
    fi

    # Cleanup
    docker rm -f "$container_name" 2>/dev/null || true
    docker rmi "$image_name" "${image_name}-installed" 2>/dev/null || true

    log_info "[${platform}] ✓ All checks passed"
    ((PASSED++))
    return 0
}

# Main execution
main() {
    log_info "Running installation tests..."
    echo ""

    # Check Docker is available
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi

    # Run tests for each platform
    for platform in "${PLATFORMS[@]}"; do
        test_platform "$platform"
        echo ""
    done

    # Print summary
    echo "=================================="
    log_info "Test Results Summary"
    echo "=================================="
    echo "Passed: ${PASSED}/${#PLATFORMS[@]}"
    echo "Failed: ${FAILED}/${#PLATFORMS[@]}"
    echo ""

    if [ ${FAILED} -gt 0 ]; then
        log_error "Failed platforms:"
        for platform in "${!FAILURES[@]}"; do
            echo "  - ${platform}: ${FAILURES[$platform]}"
        done
        exit 1
    else
        log_info "All platforms passed!"
        exit 0
    fi
}

# Run main function
main
```

**Step 2: Make script executable**

```bash
chmod +x tests/install/run-tests.sh
```

**Step 3: Verify script syntax**

```bash
bash -n tests/install/run-tests.sh
```

Expected: No syntax errors

**Step 4: Commit**

```bash
git add tests/install/run-tests.sh
git commit -m "chore: add installation test runner script"
```

---

## Task 6: Create GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/test-install.yml`

**Step 1: Ensure .github/workflows directory exists**

```bash
mkdir -p .github/workflows
```

**Step 2: Create GitHub Actions workflow**

Create `.github/workflows/test-install.yml`:

```yaml
name: Installation Tests

on:
  pull_request:
    paths:
      - 'package.json'
      - 'package-lock.json'
      - 'install.sh'
      - 'tests/install/**'
  workflow_dispatch:

jobs:
  test-installation:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        platform: [ubuntu, debian, wsl2]
      fail-fast: false

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build Docker image
        run: |
          docker build -f tests/install/dockerfiles/${{ matrix.platform }}.Dockerfile \
            -t choral-test-${{ matrix.platform }} .

      - name: Run installation
        run: |
          docker run --name test-container choral-test-${{ matrix.platform }} \
            bash -c "./install.sh"

      - name: Commit installed state
        run: |
          docker commit test-container choral-test-${{ matrix.platform }}-installed
          docker rm -f test-container

      - name: Test server startup
        run: |
          docker run --name test-container -d choral-test-${{ matrix.platform }}-installed \
            bash -c "npm run dev:server"
          sleep 5
          docker exec test-container bash -c "curl -s http://localhost:3000 > /dev/null"
          docker stop test-container
          docker rm -f test-container

      - name: Test frontend build
        run: |
          docker run --name test-container choral-test-${{ matrix.platform }}-installed \
            bash -c "npm run build"
          docker run --rm choral-test-${{ matrix.platform }}-installed \
            bash -c "test -d dist"
          docker rm -f test-container

      - name: Cleanup
        if: always()
        run: |
          docker rm -f test-container 2>/dev/null || true
          docker rmi choral-test-${{ matrix.platform }} 2>/dev/null || true
          docker rmi choral-test-${{ matrix.platform }}-installed 2>/dev/null || true
```

**Step 3: Validate YAML syntax**

```bash
# Check if yq is available for validation (optional)
if command -v yq &> /dev/null; then
    yq eval .github/workflows/test-install.yml > /dev/null
    echo "YAML syntax valid"
else
    echo "yq not available, skipping validation (will be validated by GitHub)"
fi
```

Expected: YAML syntax valid or skipped

**Step 4: Commit**

```bash
git add .github/workflows/test-install.yml
git commit -m "ci: add GitHub Actions workflow for installation tests"
```

---

## Task 7: Local Testing and Verification

**Files:**
- None (verification only)

**Step 1: Check if Docker is running**

```bash
docker info
```

Expected: Docker info output (if Docker is available)

**Step 2: Run tests locally (optional - only if Docker available)**

**Note:** This step is optional and may take 10-15 minutes to complete. Skip if Docker is not available or if you prefer to verify in CI.

```bash
cd tests/install
./run-tests.sh
```

Expected output:
```
[INFO] Running installation tests...

[INFO] Testing ubuntu...
[INFO] [ubuntu] Building Docker image...
[INFO] [ubuntu] Running installation...
[INFO] [ubuntu] ✓ Installation completed
[INFO] [ubuntu] Testing server startup...
[INFO] [ubuntu] ✓ Server started
[INFO] [ubuntu] Testing frontend build...
[INFO] [ubuntu] ✓ Build succeeded
[INFO] [ubuntu] ✓ All checks passed

[INFO] Testing debian...
...

==================================
[INFO] Test Results Summary
==================================
Passed: 3/3
Failed: 0/3

[INFO] All platforms passed!
```

**If tests fail:** Review error output, check Dockerfiles and test script logic, fix issues before proceeding.

**If Docker not available:** Skip this step, tests will run in CI.

**Step 3: Verify all files are committed**

```bash
git status
```

Expected: Working tree clean

**Step 4: Push branch (preparation for PR)**

```bash
git push -u origin feature/docker-install-tests
```

Expected: Branch pushed successfully

---

## Task 8: Update .gitignore (if needed)

**Files:**
- Modify: `.gitignore`

**Step 1: Check if test logs should be ignored**

```bash
grep -q "^/tmp/choral-test-" .gitignore || echo "Missing test log ignore pattern"
```

**Step 2: Add test artifacts to .gitignore if not present**

Add these lines to `.gitignore` if not already present:

```
# Installation test artifacts
/tmp/choral-test-*.log
```

**Note:** Since test logs are written to `/tmp`, they're already outside the repository. This step is optional for documentation purposes.

**Step 3: Commit if changes made**

```bash
if ! git diff-index --quiet HEAD .gitignore 2>/dev/null; then
    git add .gitignore
    git commit -m "chore: add installation test artifacts to .gitignore"
else
    echo "No .gitignore changes needed"
fi
```

---

## Task 9: Final Verification and Documentation Update

**Files:**
- Modify: `CLAUDE.md` (optional, for documentation)

**Step 1: Verify all test components exist**

```bash
# Check all required files exist
test -f tests/install/README.md && echo "✓ README exists"
test -f tests/install/run-tests.sh && echo "✓ Test runner exists"
test -f tests/install/dockerfiles/ubuntu.Dockerfile && echo "✓ Ubuntu Dockerfile exists"
test -f tests/install/dockerfiles/debian.Dockerfile && echo "✓ Debian Dockerfile exists"
test -f tests/install/dockerfiles/wsl2.Dockerfile && echo "✓ WSL2 Dockerfile exists"
test -f .github/workflows/test-install.yml && echo "✓ GitHub Actions workflow exists"
test -x tests/install/run-tests.sh && echo "✓ Test runner is executable"
```

Expected: All checks pass with ✓

**Step 2: Run final git status check**

```bash
git status
```

Expected: On branch feature/docker-install-tests, working tree clean

**Step 3: View commit history**

```bash
git log --oneline origin/main..HEAD
```

Expected: See all commits from this implementation (approximately 6-8 commits)

**Step 4: Document completion**

Create a summary of what was implemented:

```bash
cat << 'EOF'
✅ Implementation Complete

Created:
- tests/install/dockerfiles/ubuntu.Dockerfile
- tests/install/dockerfiles/debian.Dockerfile
- tests/install/dockerfiles/wsl2.Dockerfile
- tests/install/run-tests.sh
- tests/install/README.md
- .github/workflows/test-install.yml

Verification:
- All Dockerfiles build successfully
- Test runner script is executable and syntax-valid
- GitHub Actions workflow is properly configured
- Tests run only when relevant files change (package.json, install.sh, etc.)

Next Steps:
1. Create pull request
2. Verify GitHub Actions runs successfully
3. Address any platform-specific issues that arise in CI
EOF
```

---

## Success Criteria

- [ ] All three Dockerfiles created (ubuntu, debian, wsl2)
- [ ] Test runner script created and executable
- [ ] GitHub Actions workflow created with path filters
- [ ] README documentation created
- [ ] All files committed to feature branch
- [ ] Tests verify: installation completes, server starts, frontend builds
- [ ] Docker remains dev-dependency only (not in package.json)

## Testing the Implementation

After implementation, verify by:

1. **Local Testing** (if Docker available):
   ```bash
   cd tests/install
   ./run-tests.sh
   ```
   Expected: All 3 platforms pass

2. **CI Testing**:
   - Create PR with a small change to `package.json` (e.g., bump version)
   - Verify GitHub Actions runs installation tests
   - Check all 3 platform jobs pass in matrix

3. **Trigger Testing**:
   - Verify tests DON'T run when changing unrelated files (e.g., README.md)
   - Verify tests DO run when changing install.sh

## Troubleshooting

**Docker build fails:**
- Check Dockerfile syntax
- Verify base image is available (ubuntu:22.04, debian:12)
- Check network connectivity for package downloads

**Installation fails in container:**
- Check install.sh exists and is executable
- Review install.sh for any platform-specific assumptions
- Check error logs in /tmp/choral-test-*-install.log

**Server start fails:**
- Verify npm install completed successfully
- Check port 3000 is not already in use
- Review server startup logs

**Build fails:**
- Ensure all dependencies installed
- Check for any missing build tools
- Verify dist/ directory is created

**GitHub Actions fails:**
- Check workflow YAML syntax
- Verify Docker is available in ubuntu-latest runners (it is)
- Review Actions logs for specific errors
