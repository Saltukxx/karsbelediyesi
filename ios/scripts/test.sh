#!/usr/bin/env bash
# Çekirdek (UI'dan bağımsız) birim testlerini macOS üzerinde gerçekten koşturur.
#
# iOS simulator runtime'ı kurulu olmayan makinelerde `xcodebuild test`
# çalışmadığı için ağ/yapılandırma/rol matrisi gibi Foundation-only mantık
# testleri macOS hedefinde derlenip koşturulur. UI testleri için simulator
# runtime'ı ile `xcodebuild test -scheme KarsPanel` kullanılır.
set -euo pipefail

cd "$(dirname "$0")/.."

SDK="$(xcrun --sdk macosx --show-sdk-path)"
PLATFORM="$(xcrun --sdk macosx --show-sdk-platform-path)"
FRAMEWORKS="$PLATFORM/Developer/Library/Frameworks"
TARGET="arm64-apple-macos13.0"
OUT=".testbuild"
BUNDLE="$OUT/KarsPanelCoreTests.xctest"

rm -rf "$OUT"
mkdir -p "$BUNDLE/Contents/MacOS"

# SwiftUI/UIKit'e bağlı dosyalar macOS hedefinde derlenmez; dışarıda bırakılır.
CORE_SOURCES=()
while IFS= read -r f; do
  if grep -qE '^import (SwiftUI|UIKit|MapKit|CoreLocation)' "$f"; then continue; fi
  CORE_SOURCES+=("$f")
done < <(find KarsPanel/Core -name '*.swift' | sort)

TEST_SOURCES=()
while IFS= read -r f; do TEST_SOURCES+=("$f"); done < <(find KarsPanelTests -name '*.swift' | sort)

echo "Çekirdek: ${#CORE_SOURCES[@]} dosya · Test: ${#TEST_SOURCES[@]} dosya"

# @testable import için modül -enable-testing ile üretilir.
swiftc -emit-module -emit-library -static \
  -sdk "$SDK" -target "$TARGET" -swift-version 5 \
  -module-name KarsPanel -enable-testing \
  -emit-module-path "$OUT/KarsPanel.swiftmodule" \
  -o "$OUT/libKarsPanel.a" \
  "${CORE_SOURCES[@]}"

# XCTest.swiftmodule Developer/usr/lib altında, framework Developer/Library/Frameworks
# altında durur; ikisi de arama yoluna girmeli.
swiftc -emit-library -Xlinker -bundle \
  -sdk "$SDK" -target "$TARGET" -swift-version 5 \
  -module-name KarsPanelTests \
  -I "$OUT" -L "$OUT" -lKarsPanel \
  -I "$PLATFORM/Developer/usr/lib" \
  -L "$PLATFORM/Developer/usr/lib" \
  -F "$FRAMEWORKS" -framework XCTest -lXCTestSwiftSupport \
  -Xlinker -rpath -Xlinker "$FRAMEWORKS" \
  -Xlinker -rpath -Xlinker "$PLATFORM/Developer/usr/lib" \
  -o "$BUNDLE/Contents/MacOS/KarsPanelCoreTests" \
  "${TEST_SOURCES[@]}"

cat > "$BUNDLE/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleExecutable</key>
	<string>KarsPanelCoreTests</string>
	<key>CFBundleIdentifier</key>
	<string>tr.gov.kars.panel.coretests</string>
	<key>CFBundleName</key>
	<string>KarsPanelCoreTests</string>
	<key>CFBundlePackageType</key>
	<string>BNDL</string>
</dict>
</plist>
PLIST

exec xcrun xctest "$BUNDLE"
