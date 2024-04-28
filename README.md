# Super Game Boy Border Converter
This tool can easily convert a 256&times;224 PNG image into SNES tile data for Super Game Boy.

It uses [Tiled Palette Quantization](https://rilden.github.io/tiledpalettequant/) by rilden to reduce and optimize palettes for SGB limitations.
Can be used with:

- **<a href="https://github.com/marcrobledo/super-game-boy-border-injector" target="_blank">Super Game Boy Border Injector</a>**<br/>
  Turn your favorite Game Boy game into a Super Game Boy compatible game, including your own border and palette!
- **<a href="https://github.com/MiSTer-devel/Gameboy_MiSTer?tab=readme-ov-file#custom-borders" target="_blank">MiSTer FPGA Game Boy Core</a>**<br/>
  MiSTer FPGA Game Boy Core allows you to load SGB borders (in .sgb format) at any time
- **Game Boy homebrew development**<br/>
  Include SGB border data generated by this tool into your Game Boy homebrew game


## Improving conversion results
Although you can attach any image (as long as its dimensions are 256&times;224), the Super Game Boy had some tile and color limitations so, in most cases, your image will probably suffer from a loss of quality in order to make it compatible with the original hardware.

Super Game Boy limitations:
- 3 palettes of 15 colors (+1 transparent color which is needed for the GB game window)
- a tile (8x8 pixels) can only use one of the three palettes
- a maximum of 256 unique tiles (horizontal and/or vertical flipped do not count!)

If your image goes over the 256 tiles limit, you will need to manually edit it, cloning some tiles here and there and removing the most negligible ones until you reduce the number of unique tiles.

As of palettes and colors, you don't need to worry, since the SGB Converter will reduce them for you.
However, the algorithm isn't perfect and the border might lose quality if it's too complex.

## Advanced: attach your own palette
You can force the converter to use your own palettes and skip the palette reduction process, which will allow you to achieve a lossless result (no colors will be lost) if done correctly.
This process is a little laborious. I recommend it only if you really understand how retro videogame consoles graphics work and want to get the best result.

Take a look at this image:

![SGB converter advanced example](https://github.com/marcrobledo/super-game-boy-border-converter/blob/main/assets/example_advanced.png?raw=true)

- it's a 256&times;**232** image
- first row has three extra tiles
   - each extra tile includes the 16 colors that make up each palette
- the rest of the image is the border itself

By attaching an image like this to the SGB Converter, you are providing information on how exactly the three palettes will be, so the Converter does not need to run the random algorithm. If all your border tiles match any of those three palettes, your border won't lose any color information.
