#!/usr/bin/env sh
# Packs behavior_pack/ into CPS-Counter.mcpack (a zip with a different extension).
set -e
cd "$(dirname "$0")/behavior_pack"
rm -f ../CPS-Counter.mcpack
zip -r -X ../CPS-Counter.mcpack manifest.json pack_icon.png scripts
