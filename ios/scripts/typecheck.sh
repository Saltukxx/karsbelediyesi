#!/usr/bin/env bash
# Tüm Swift kaynaklarını iOS Simulator SDK'sına karşı tip kontrolü yapar.
#
# Neden xcodebuild değil: asset katalogu derlemesi (actool) yüklü bir simulator
# runtime'ı ister. Bu betik yalnızca kod doğruluğunu kontrol eder, runtime
# indirmeye gerek kalmadan çalışır. Testleri gerçekten koşturmak için
# scripts/test.sh kullanılır (simulator runtime gerekir).
set -euo pipefail

cd "$(dirname "$0")/.."

SDK="$(xcrun --sdk iphonesimulator --show-sdk-path)"
PLATFORM="$(xcrun --sdk iphonesimulator --show-sdk-platform-path)"
TARGET="arm64-apple-ios17.0-simulator"
OUT=".typecheck"
mkdir -p "$OUT"

# bash 3.2 (macOS varsayılanı) mapfile desteklemez
APP_SOURCES=()
while IFS= read -r f; do APP_SOURCES+=("$f"); done < <(find KarsPanel -name '*.swift' | sort)

echo "Uygulama: ${#APP_SOURCES[@]} dosya"
# Test hedefi @testable import kullandığı için modül -enable-testing ile üretilir.
swiftc -emit-module -sdk "$SDK" -target "$TARGET" -swift-version 5 \
  -module-name KarsPanel -enable-testing \
  -emit-module-path "$OUT/KarsPanel.swiftmodule" \
  "${APP_SOURCES[@]}"

TEST_SOURCES=()
if [ -d KarsPanelTests ]; then
  while IFS= read -r f; do TEST_SOURCES+=("$f"); done < <(find KarsPanelTests -name '*.swift' | sort)
fi

if [ "${#TEST_SOURCES[@]}" -gt 0 ]; then
  echo "Testler: ${#TEST_SOURCES[@]} dosya"
  # XCTest.swiftmodule Developer/usr/lib altında, framework'ün kendisi
  # Developer/Library/Frameworks altında durur; ikisi de gerekir.
  swiftc -typecheck -sdk "$SDK" -target "$TARGET" -swift-version 5 \
    -module-name KarsPanelTests \
    -I "$OUT" \
    -I "$PLATFORM/Developer/usr/lib" \
    -F "$PLATFORM/Developer/Library/Frameworks" \
    "${TEST_SOURCES[@]}"
fi

echo "Tip kontrolü başarılı."
