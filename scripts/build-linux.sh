#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$PROJECT_DIR/frontend"
RELEASE_DIR="$FRONTEND_DIR/src-tauri/target/release"
BUNDLE_DIR="$RELEASE_DIR/bundle/appimage"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"

echo "╔══════════════════════════════════════╗"
echo "║   Khoji Linux AppImage Builder      ║"
echo "╚══════════════════════════════════════╝"

# Step 1: Ensure backend verify passes
echo ""
echo "── (1/4) Verifying backend..."
cd "$PROJECT_DIR/backend/python"
./verify.sh
echo "  ✅ Backend verified"

# Step 2: Tauri build (frontend + Rust compile + bundle)
echo ""
echo "── (2/4) Building Tauri AppImage..."
cd "$FRONTEND_DIR"
NO_STRIP=1 APPIMAGE_EXTRACT_AND_RUN=1 npx tauri build --bundles appimage 2>&1
echo "  ✅ Tauri build complete"

# Step 3: Generate SHA256 checksums
echo ""
echo "── (3/4) Generating checksums..."
APPIMAGE="$BUNDLE_DIR/Khoji_1.0.0_amd64.AppImage"
BINARY="$RELEASE_DIR/khoji"
CHECKSUMS_FILE="$BUNDLE_DIR/khoji-linux-$TIMESTAMP.sha256"

{
    sha256sum "$APPIMAGE"
    sha256sum "$BINARY"
} | tee "$CHECKSUMS_FILE"

# Step 4: Report
echo ""
echo "── (4/4) Build artifacts:"
echo "  AppImage: $APPIMAGE"
echo "  Binary:   $BINARY"
echo "  Checksum: $CHECKSUMS_FILE"
echo ""
echo "  AppImage: $(ls -lh "$APPIMAGE" | awk '{print $5}')"
echo "  Binary:   $(ls -lh "$BINARY" | awk '{print $5}')"
echo ""
echo "╔══════════════════════════════════════╗"
echo "║   Build complete                     ║"
echo "╚══════════════════════════════════════╝"
