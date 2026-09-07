#!/bin/bash
cd /Users/mcdinh/Downloads/lockin-ai
export PATH="/Users/mcdinh/Downloads/lockin-ai/.tools/node-v22.23.2-darwin-arm64/bin:$PATH"
exec node server/index.js > /Users/mcdinh/Downloads/lockin-ai/.freebuff/preview-8e0b4e71-75dd-455d-9509-ba05a1b9fb24.log 2>&1
