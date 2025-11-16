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
        tail -50 "/tmp/choral-test-${platform}-build.log"
        FAILURES[$platform]="Docker build failed"
        ((FAILED++))
        return 1
    fi

    # Run installation in container
    log_info "[${platform}] Running installation..."
    if ! docker run --name "$container_name" "$image_name" bash -c "./install.sh" &> "/tmp/choral-test-${platform}-install.log"; then
        log_error "[${platform}] ✗ Installation failed"
        tail -50 "/tmp/choral-test-${platform}-install.log"
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
        tail -50 "/tmp/choral-test-${platform}-server.log"
        docker rm -f "$container_name" 2>/dev/null || true
        docker rmi "$image_name" "${image_name}-installed" 2>/dev/null || true
        FAILURES[$platform]="Server start failed"
        ((FAILED++))
        return 1
    fi

    # Wait for server to be ready (check port 3000 with retry)
    local max_retries=30
    local retry_count=0
    local server_ready=false

    while [ $retry_count -lt $max_retries ]; do
        if docker exec "$container_name" bash -c "curl -s http://localhost:3000 > /dev/null" 2>/dev/null; then
            server_ready=true
            break
        fi
        sleep 1
        ((retry_count++))
    done

    if [ "$server_ready" = true ]; then
        log_info "[${platform}] ✓ Server started"
    else
        log_error "[${platform}] ✗ Server failed to respond after ${max_retries} seconds"
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
        tail -50 "/tmp/choral-test-${platform}-build-frontend.log"
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
    # Clean up old log files
    rm -f /tmp/choral-test-*.log 2>/dev/null || true

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
