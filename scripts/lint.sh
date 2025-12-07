#!/usr/bin/env bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

FAILED=0
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

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

get_python_cmd() {
    if command -v python3 >/dev/null 2>&1; then
        echo "$(command -v python3)"
    elif command -v python >/dev/null 2>&1; then
        echo "$(command -v python)"
    else
        echo ""
    fi
}

# Run Black in check mode
run_black_check() {
    print_header "Checking Python Formatting (black)"
    local black_cmd=()

    if command -v black >/dev/null 2>&1; then
        black_cmd=(black)
    elif [[ -x "venv/bin/black" ]]; then
        black_cmd=("venv/bin/black")
    else
        local py_cmd
        py_cmd="$(get_python_cmd)"
        if [[ -n "$py_cmd" ]]; then
            black_cmd=("$py_cmd" -m black)
        fi
    fi

    if [[ ${#black_cmd[@]} -eq 0 ]]; then
        print_error "Black not found (install black or activate venv)"
        FAILED=1
        return
    fi

    if "${black_cmd[@]}" --check app tests; then
        print_success "Black formatting clean"
    else
        print_error "Black formatting issues detected"
        FAILED=1
    fi
}

# Run Flake8 linting
run_flake8() {
    print_header "Running Python Linting (flake8)"
    local flake8_cmd=()

    if command -v flake8 >/dev/null 2>&1; then
        flake8_cmd=(flake8)
    elif [[ -x "venv/bin/flake8" ]]; then
        flake8_cmd=("venv/bin/flake8")
    else
        local py_cmd
        py_cmd="$(get_python_cmd)"
        if [[ -n "$py_cmd" ]]; then
            flake8_cmd=("$py_cmd" -m flake8)
        fi
    fi

    if [[ ${#flake8_cmd[@]} -eq 0 ]]; then
        print_error "Flake8 not found (install flake8 or activate venv)"
        FAILED=1
        return
    fi

    if "${flake8_cmd[@]}" app tests; then
        print_success "Flake8 linting passed"
    else
        print_error "Flake8 linting failed"
        FAILED=1
    fi
}

# Run JS/Svelte linting via pnpm
run_js_lint() {
    print_header "Running JS/Svelte Linting (pnpm lint)"
    local pnpm_cmd=()

    if command -v corepack >/dev/null 2>&1; then
        pnpm_cmd=(corepack pnpm)
    elif command -v pnpm >/dev/null 2>&1; then
        pnpm_cmd=(pnpm)
    else
        print_error "pnpm/corepack not found; install Node dependencies"
        FAILED=1
        return
    fi

    if "${pnpm_cmd[@]}" run lint; then
        print_success "JS/Svelte linting passed"
    else
        print_error "JS/Svelte linting failed"
        FAILED=1
    fi
}

main() {
    print_header "ManaForge Lint Suite"

    run_black_check
    run_flake8
    run_js_lint

    echo ""
    print_header "Lint Summary"

    if [[ $FAILED -eq 0 ]]; then
        print_success "All linters passed!"
        exit 0
    else
        print_error "Some linters failed"
        exit 1
    fi
}

main "$@"
