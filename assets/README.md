# Application Icons

For Windows exe building, you need to add:

- `icon.ico` - Windows icon file (256x256 recommended)
- `icon.icns` - macOS icon file (if building for Mac)

## Converting from PNG

If you have a PNG icon, you can convert it:

### For Windows (.ico):
```bash
# Using ImageMagick
convert icon.png -resize 256x256 icon.ico

# Or use online tools like:
# https://www.icoconverter.com/
# https://convertio.co/png-ico/
```

### For macOS (.icns):
```bash
# Using iconutil (macOS only)
mkdir icon.iconset
sips -z 16 16 icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32 icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32 icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64 icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128 icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256 icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256 icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512 icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512 icon.png --out icon.iconset/icon_512x512.png
iconutil -c icns icon.iconset
``` 