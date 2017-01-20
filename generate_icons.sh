#!/bin/bash

# このシェルスクリプトは ./icons/source.png から
# ./icons/16.png, ./icons/46.png, ./icons/128.png
# の3つのアイコンを生成します。
# このスクリプトを実行するには imagemagick が必要です。

for size in 16 48 128
do
  convert icons/source.png -resize ${size}x  -unsharp 1.5x1+0.7+0.02 icons/${size}.png
done
