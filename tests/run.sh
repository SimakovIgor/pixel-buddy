#!/bin/sh
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cp -R "$root/pixel-buddy/." "$work/"
cp "$root"/tests/*.test.tsx "$work/hooks/"
claude plugin test "$work"
