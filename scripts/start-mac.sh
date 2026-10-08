#!/usr/bin/env bash
# Mac uses the same Docker workflow as Linux.
exec "$(dirname "$0")/start-linux.sh" "$@"
