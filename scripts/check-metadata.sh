#!/bin/sh
# Pre-commit (lint-staged): fails when a staged image or PDF carries identifying metadata
# (GPS position, author, artist, owner, or an email in the creator field). Needs exiftool (brew install exiftool);
# skipped with a message when it is missing. Strip a file with: exiftool -all= <file>
command -v exiftool >/dev/null 2>&1 || {
  echo "exiftool not installed (brew install exiftool): image/PDF metadata check skipped"
  exit 0
}
found=$(exiftool -q -if '$GPSLatitude or $Author or $Artist or $OwnerName or $XPAuthor or $Creator =~ /\@/' \
  -p '$FileName: identifying metadata (strip with: exiftool -all= <file>)' "$@")
[ -z "$found" ] && exit 0
echo "$found"
exit 1
