#!/bin/sh
# agentsmesh installer — downloads the correct binary for your platform.
# Usage: curl -fsSL https://github.com/sampleXbro/agentsmesh/releases/latest/download/install.sh | sh
# Options: --version <version>  Install a specific version
set -eu

AGENTSMESH_INSTALL="${AGENTSMESH_INSTALL:-$HOME/.agentsmesh}"
BIN_DIR="$AGENTSMESH_INSTALL/bin"
BASE_URL="https://github.com/sampleXbro/agentsmesh/releases"

main() {
  parse_args "$@"
  validate_install_dir
  detect_platform
  create_dirs
  download_binary
  verify_checksum
  install_binary
  setup_path
  print_success
}

# CWE-77: AGENTSMESH_INSTALL is interpolated into the line we write to the user's shell rc.
# A wrapping process controlling it could otherwise inject shell code on next shell start.
validate_install_dir() {
  case "$AGENTSMESH_INSTALL" in
    *[!a-zA-Z0-9./_~\ -]*) error "AGENTSMESH_INSTALL contains characters outside the safe allowlist: $AGENTSMESH_INSTALL" ;;
  esac
}

parse_args() {
  VERSION="latest"
  while [ $# -gt 0 ]; do
    case "$1" in
      --version) VERSION="$2"; shift 2 ;;
      --help) usage; exit 0 ;;
      *) error "Unknown option: $1. Run with --help for usage." ;;
    esac
  done
  if [ "$VERSION" = "latest" ]; then
    RELEASE_URL="$BASE_URL/latest/download"
  else
    RELEASE_URL="$BASE_URL/download/v$VERSION"
  fi
}

usage() {
  cat <<EOF
agentsmesh installer

USAGE:
    curl -fsSL .../install.sh | sh
    curl -fsSL .../install.sh | sh -s -- --version 0.13.0

OPTIONS:
    --version <version>  Install a specific version (default: latest)
    --help               Show this help message

ENVIRONMENT:
    AGENTSMESH_INSTALL   Install directory (default: \$HOME/.agentsmesh)
EOF
}

detect_platform() {
  os=$(uname -s)
  arch=$(uname -m)

  # Rosetta 2: uname -m reports x86_64 under Rosetta on Apple Silicon
  if [ "$os" = "Darwin" ] && [ "$arch" = "x86_64" ]; then
    if [ "$(sysctl -in sysctl.proc_translated 2>/dev/null)" = "1" ]; then
      arch="arm64"
    fi
  fi

  case "$arch" in
    aarch64) arch="arm64" ;;
    x86_64)  arch="x64" ;;
    arm64)   ;; # already correct
    *) error "Unsupported architecture: $arch. Install via npm: npm install -g agentsmesh" ;;
  esac

  case "$os" in
    Darwin) platform="darwin" ;;
    Linux)  platform="linux" ;;
    *) error "Unsupported OS: $os. Install via npm: npm install -g agentsmesh" ;;
  esac

  TARGET="agentsmesh-${platform}-${arch}"
}

create_dirs() {
  mkdir -p "$BIN_DIR"
}

download() {
  url="$1"; output="$2"
  if command -v curl >/dev/null 2>&1; then
    curl --fail --location --silent --show-error --retry 3 --output "$output" "$url"
  elif command -v wget >/dev/null 2>&1; then
    wget --quiet --output-document="$output" "$url"
  else
    error "curl or wget is required to download agentsmesh"
  fi
}

download_binary() {
  TMPFILE=$(mktemp)
  trap 'rm -f "$TMPFILE" "$TMPFILE.checksums"' EXIT
  info "Downloading $TARGET..."
  download "$RELEASE_URL/$TARGET" "$TMPFILE"
  download "$RELEASE_URL/SHA256SUMS" "$TMPFILE.checksums"
}

verify_checksum() {
  expected=$(awk -v t="$TARGET" '$2==t {print $1}' "$TMPFILE.checksums")
  # Fail closed (CWE-345): never install an unverified binary, even if the checksum source is incomplete.
  if [ -z "$expected" ]; then
    error "No checksum found for $TARGET in SHA256SUMS — refusing to install unverified binary."
  fi

  if command -v sha256sum >/dev/null 2>&1; then
    actual=$(sha256sum "$TMPFILE" | awk '{print $1}')
  elif command -v shasum >/dev/null 2>&1; then
    actual=$(shasum -a 256 "$TMPFILE" | awk '{print $1}')
  elif command -v openssl >/dev/null 2>&1; then
    actual=$(openssl dgst -sha256 "$TMPFILE" | awk '{print $NF}')
  else
    error "No checksum tool found (sha256sum, shasum, or openssl required) — refusing to install unverified binary."
  fi

  if [ "$actual" != "$expected" ]; then
    error "Checksum mismatch for $TARGET (expected $expected, got $actual)"
  fi
  info "Checksum verified."
}

install_binary() {
  EXISTED=false
  [ -f "$BIN_DIR/agentsmesh" ] && EXISTED=true

  mv "$TMPFILE" "$BIN_DIR/agentsmesh"
  chmod +x "$BIN_DIR/agentsmesh"

  # Create amsh alias
  ln -sf "$BIN_DIR/agentsmesh" "$BIN_DIR/amsh"
}

setup_path() {
  # Already in PATH — nothing to do
  case ":$PATH:" in
    *":$BIN_DIR:"*) return 0 ;;
  esac

  shell_name=$(basename "$SHELL" 2>/dev/null || echo "")
  config=""
  path_line=""
  # `export PATH=...` is bash syntax and a parse error in fish — fish needs fish_add_path.
  case "$shell_name" in
    zsh)  config="$HOME/.zshrc"; path_line="export PATH=\"$BIN_DIR:\$PATH\"" ;;
    bash) config="$HOME/.bashrc"; path_line="export PATH=\"$BIN_DIR:\$PATH\"" ;;
    fish) config="$HOME/.config/fish/config.fish"; path_line="fish_add_path -gP \"$BIN_DIR\"" ;;
  esac

  if [ -n "$config" ] && { [ -w "$config" ] || [ ! -e "$config" ]; }; then
    mkdir -p "$(dirname "$config")"
    if ! grep -q "agentsmesh" "$config" 2>/dev/null; then
      printf '\n# agentsmesh\n%s\n' "$path_line" >> "$config"
      info "Added $BIN_DIR to PATH in $config"
    fi
  else
    info "Manually add to your shell config:"
    info "  ${path_line:-export PATH=\"$BIN_DIR:\$PATH\"}"
  fi
}

print_success() {
  installed_version=$("$BIN_DIR/agentsmesh" --version 2>/dev/null || echo "unknown")
  if [ "$EXISTED" = "true" ]; then
    info "Upgraded agentsmesh to $installed_version"
  else
    info "Installed agentsmesh $installed_version to $BIN_DIR/agentsmesh"
  fi
  info "Run 'agentsmesh --help' to get started."
  # Remind about PATH if not yet active
  case ":$PATH:" in
    *":$BIN_DIR:"*) ;;
    *) info "Restart your shell or run: export PATH=\"$BIN_DIR:\$PATH\"" ;;
  esac
}

error() {
  printf '\033[0;31merror\033[0m: %s\n' "$*" >&2
  exit 1
}

info() {
  printf '\033[0;2m%s\033[0m\n' "$*"
}

main "$@"
