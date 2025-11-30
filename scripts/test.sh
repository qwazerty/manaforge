#!/usr/bin/env bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

FAILED=0

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Run Python tests with pytest
run_python_tests() {
    print_header "Running Python Tests (pytest)"
    if pytest tests/ -v; then
        print_success "Python tests passed"
    else
        print_error "Python tests failed"
        FAILED=1
    fi
}

# Run Svelte/TypeScript tests with vitest
run_svelte_tests() {
    print_header "Running Svelte/TypeScript Tests (vitest)"
    if corepack pnpm run test:unit; then
        print_success "Svelte/TypeScript tests passed"
    else
        print_error "Svelte/TypeScript tests failed"
        FAILED=1
    fi
}

# Main execution
main() {
    print_header "ManaForge Test Suite"
    
    run_python_tests
    run_svelte_tests
    
    echo ""
    print_header "Test Summary"
    
    if [[ $FAILED -eq 0 ]]; then
        print_success "All tests passed!"
        exit 0
    else
        print_error "Some tests failed"
        exit 1
    fi
}

main "$@"
