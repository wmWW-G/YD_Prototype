#!/bin/sh

# 生成可分发的 TokenMind Dify 日志查询扩展 ZIP。
#
# 这个脚本只打包 Chrome 运行时必需文件。测试、项目说明和脚本自身都不进入
# 分发包，避免同事解压后选错目录；manifest.json 会直接位于 ZIP 根目录。

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(dirname "$SCRIPT_DIR")
OUTPUT_PATH="$PROJECT_DIR/dify-log-browser-extension-v0.1.0.zip"
TEMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/tokenmind-dify-extension.XXXXXX")
TEMP_ZIP="$TEMP_DIR/dify-log-browser-extension-v0.1.0.zip"

# TEMP_DIR 由 mktemp 创建且只包含本次打包产物，退出时可以安全清理。
trap 'rm -rf "$TEMP_DIR"' EXIT HUP INT TERM

(
  cd "$SCRIPT_DIR"
  zip -X -q -r "$TEMP_ZIP" manifest.json background.js query-engine.js sidepanel.html sidepanel.css sidepanel.js icons -x "tests/*" "CONTEXT.md" "package-extension.sh" "*.DS_Store"
)

# 先在临时目录生成完整 ZIP，再原子替换版本化交付物，避免留下半成品。
mv -f "$TEMP_ZIP" "$OUTPUT_PATH"
echo "已生成：$OUTPUT_PATH"
