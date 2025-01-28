#!/bin/sh

set -e

typedoc

# We need to fix the links in the generated markdown files.
# Typedoc generates anchors for properties in tables which can collide with anchors for types.
# For example we can have property `logger` and type `Logger` which will both have anchor `logger`.
# typedoc-plugin-markdown will generate links trying to deduplicate the anchors by adding a number at the end.
# Example: `globals.md#logger-1` and `globals.md#logger-2`.
#
# We don't need the anchors for properties in the markdown files 
# and they won't even work in Gitbook because they are generated as html <a> anchors.
# We can fix this by removing the number at the end of the anchor.
SEDCOMMAND='s/globals.md#(.*)-[0-9]+/globals.md#\1/g'

FILES=$(find dist/docs/@bucketco -name "globals.md")

for file in $FILES
do
  sed -r $SEDCOMMAND $file > $file.fixed
  rm $file
  mv $file.fixed $file
done
