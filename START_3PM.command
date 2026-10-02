#!/bin/bash
# Sole public launcher. Keep this filename unchanged in every Mac release.
HERE="$(cd "$(dirname "$0")" && pwd)"
exec /bin/bash "$HERE/internal/start_services.sh"
