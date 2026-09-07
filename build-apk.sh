#!/bin/bash
# ============================================================
# LOCKIN.AI – Android-APK bauen (ohne Gradle, rein CLI)
# ------------------------------------------------------------
# Voraussetzungen (werden beim ersten Lauf automatisch geprüft):
#   ./build-apk.sh setup   -> installiert JDK 17 + Android SDK in ../.tools/android
# Danach einfach: ./build-apk.sh
#
# Ausgabe: ../client/dist/LOCKIN.AI.apk  (signiert, installierbar)
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"

ROOT="$(cd .. && pwd)"                       # lockin-ai/
ANDROID_DIR="$ROOT/.tools/android"
JAVA_HOME_DIR="$ANDROID_DIR/jdk/Contents/Home"
SDK="$ANDROID_DIR/sdk"
BUILD_TOOLS="$SDK/build-tools/34.0.0"
PLATFORM="$SDK/platforms/android-34/android.jar"
KEYSTORE="$ANDROID_DIR/lockin.keystore"
KEYSTORE_PASS="lockin2026"
KEY_ALIAS="lockin"
OUT_APK="$ROOT/client/dist/LOCKIN.AI.apk"
PKG="ai.lockin.app"

export JAVA_HOME="$JAVA_HOME_DIR"
export PATH="$JAVA_HOME/bin:$ANDROID_DIR/cmdline-tools/bin:$PATH"

step() { echo; echo "── $1"; }

if [[ "${1:-}" == "setup" ]]; then
  step "JDK 17 herunterladen"
  mkdir -p "$ANDROID_DIR"
  cd "$ANDROID_DIR"
  if [ ! -f jdk.tar.gz ]; then
    curl -sL -o jdk.tar.gz "https://api.adoptium.net/v3/binary/latest/17/ga/mac/aarch64/jdk/hotspot/normal/eclipse"
  fi
  [ -d jdk ] || { tar -xzf jdk.tar.gz && mv jdk-* jdk; }

  step "Android cmdline-tools herunterladen"
  if [ ! -f cmdtools.zip ]; then
    curl -sL -o cmdtools.zip "https://dl.google.com/android/repository/commandlinetools-mac-11076708_latest.zip"
  fi
  [ -d cmdline-tools ] || unzip -q cmdtools.zip

  step "SDK-Komponenten (platform-tools, android-34, build-tools 34)"
  yes | sdkmanager --sdk_root="$SDK" "platform-tools" "platforms;android-34" "build-tools;34.0.0" > /tmp/lockin-sdk.log 2>&1 || true
  echo "SDK bereit unter $SDK"
  exit 0
fi

[ -f "$PLATFORM" ] || { echo "SDK fehlt – bitte zuerst: ./build-apk.sh setup"; exit 1; }

rm -rf gen build && mkdir -p gen build/classes build/dex

step "1/6 Ressourcen kompilieren (aapt2)"
"$BUILD_TOOLS/aapt2" compile --dir res -o build/res.zip

step "2/6 APK-Gerüst linken (aapt2 link)"
"$BUILD_TOOLS/aapt2" link \
  -o build/app.unsigned.apk \
  -I "$PLATFORM" \
  --manifest AndroidManifest.xml \
  -R build/res.zip \
  --auto-add-overlay \
  --java gen

step "3/6 Java kompilieren (javac)"
find src -name '*.java' > build/sources.txt
"$JAVA_HOME/bin/javac" -source 11 -target 11 \
  -classpath "$PLATFORM" \
  -d build/classes \
  @build/sources.txt \
  $(find gen -name '*.java')

step "4/6 Dexen (d8)"
find build/classes -name '*.class' > build/classes.txt
"$BUILD_TOOLS/d8" --release --lib "$PLATFORM" --output build/dex $(cat build/classes.txt)
cp build/dex/classes.dex build/

step "5/6 APK packen + zipalign"
cd build
zip -q app.unsigned.apk classes.dex
"$BUILD_TOOLS/zipalign" -f 4 app.unsigned.apk app.aligned.apk
cd ..

step "6/6 Signieren (apksigner)"
if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -v \
    -keystore "$KEYSTORE" -storepass "$KEYSTORE_PASS" \
    -alias "$KEY_ALIAS" -keypass "$KEYSTORE_PASS" \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=LOCKIN.AI, OU=Mobile, O=LOCKIN.AI, L=Berlin, C=DE" > /dev/null 2>&1
fi
"$BUILD_TOOLS/apksigner" sign \
  --ks "$KEYSTORE" --ks-pass "pass:$KEYSTORE_PASS" \
  --ks-key-alias "$KEY_ALIAS" --key-pass "pass:$KEYSTORE_PASS" \
  --out "$OUT_APK" \
  build/app.aligned.apk

"$BUILD_TOOLS/apksigner" verify "$OUT_APK" > /dev/null && echo "✔ Signatur OK"
echo
echo "✅ Fertig: $OUT_APK ($(du -h "$OUT_APK" | cut -f1))"
echo "   Installieren: adb install -r \"$OUT_APK\"   (oder Datei aufs Handy kopieren)"
