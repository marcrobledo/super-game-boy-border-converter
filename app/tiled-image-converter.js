/**
	@file converts a JS Image object into valid retro consoles graphics data
	@author Marc Robledo
	@version 0.1
	@copyright 2023-2024 Marc Robledo
	@license
	This file is released under MIT License
	Copyright (c) 2024 Marc Robledo

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.

 */




export function getTileValidPalettesSNES(tileData, palettes) {
	return extractPalettes(image, 4, rgb24to15, firstColor);
}
export function extractPalettesSNES(imageData, firstColor) {
	return extractPalettes(imageData, 4, rgb24to15, firstColor);
}
export function extractPalettesGBC(imageData, firstColor) {
	return extractPalettes(imageData, 2, rgb24to15, firstColor);
}
export default {
	extractPalettesSNES,
	extractPalettesGBC
};

function getTileValidPalettes(imageData, palettes, colorConverterFunction) {
	const tileColors = [];
	for (let i = 0; i < 8 * 8 * 4; i += 4) {
		const r = imageData.data[i + 0];
		const g = imageData.data[i + 1];
		const b = imageData.data[i + 2];
		const color = colorConverterFunction(r, g, b);
		if (tileColors.indexOf(color) === -1) {
			tileColors.push(color);
		}
	}

	return validPalettes = palettes.reduce((validPalettes, palette) => {
		const foundColors = tileColors.reduce((nFoundColors, color) => {
			if (palette.indexOf(color) !== -1)
				nFoundColors++;
			return nFoundColors;
		}, 0);
		if (foundColors === tileColors.length)
			validPalettes.push(palette);
		return validPalettes;
	}, []);

}

function extractPalettes(imageData, bpp, colorConverterFunction, firstColor) {
	/* check parameters validity */
	if (!(imageData instanceof ImageData))
		throw new Error('TiledImageConverter: imageData is not an instance of ImageData');
	else if (imageData.width % 8 !== 0 || imageData.height % 8 !== 0)
		throw new Error('TiledImageConverter: invalid image dimensions (width and height must be divisible by 8)');
	const nRows = imageData.height / 8;
	const nCols = imageData.width / 8;

	if (typeof bpp == 'string')
		bpp = parseInt(bpp);
	if (bpp !== 2 && bpp !== 4)
		throw new Error('TiledImageConverter: invalid bpp (can only be 2 or 4)');

	if (typeof colorConverterFunction !== 'function')
		throw new Error('TiledImageConverter: invalid colorConverterFunction');

	if (firstColor && (!Array.isArray(firstColor) || firstColor.length !== 3 || firstColor.some((c) => typeof c !== 'number') || firstColor.some((c) => c < 0 || c > 255)))
		throw new Error('TiledImageConverter: provided firstColor is invalid (should be an array [r8,g8,b8])');
	if (firstColor)
		firstColor = colorConverterFunction(firstColor[0], firstColor[1], firstColor[2]);




	/* extract all palettes from tiles */
	const allPalettes = [];
	for (var y = 0; y < nRows; y++) {
		for (var x = 0; x < nCols; x++) {
			const startX=x*8;
			const startY=y*8;
			const endX = startX+8;
			const endY = startY+8;
		
			const tileColors = firstColor? [firstColor] : [];
		
			for (let y = startY; y < endY; y++) {
				for (let x = startX; x < endX; x++) {
					const index = 4 * (x + imageData.width * y);

					if(imageData.data[index + 3] < 192) /* skip if pixel transparent */
						continue;

					const r8 = imageData.data[index + 0];
					const g8 = imageData.data[index + 1];
					const b8 = imageData.data[index + 2];
					const color = colorConverterFunction(r8, g8, b8);
					if (tileColors.indexOf(color) === -1) {
						tileColors.push(color);
						if (tileColors.length > Math.pow(2, bpp))
							throw new Error('TiledImageConverter: too many colors for tile (row:' + y + ', col:' + x + ')');
					}
				}
			}

			allPalettes.push(tileColors);
		}
	}

	const uniquePalettes = allPalettes.reduce((uniquePalettes, palette) => {
		const foundPalette = uniquePalettes.some((uniquePalette) => {
			let foundColors = palette.reduce((nFoundColors, color) => {
				if (uniquePalette.indexOf(color) !== -1)
					nFoundColors++;
				return nFoundColors;
			}, 0);
			return foundColors === palette.length;
		});
		if (!foundPalette)
			uniquePalettes.push(palette);
		return uniquePalettes;
	}, []);

	const palettesSortedBySize = uniquePalettes.sort((a, b) => a.length < b.length);
	//return palettesSortedBySize;


	const differentPalettes = palettesSortedBySize.reduce((acc, palette) => {
		/* find which palettes in acc can the current palette fit */
		const fittingPalettes = acc.reduce((fittingPalettes, accPalette) => {
			let missingColors = palette.reduce((missingColors, color) => {
				if (accPalette.indexOf(color) === -1)
					missingColors.push(color);
				return missingColors;
			}, []);
			if (missingColors.length <= (Math.pow(2, bpp) - accPalette.length))
				fittingPalettes.push(accPalette);
			return fittingPalettes;
		}, []).sort((a, b) => a.length < b.length);

		if (fittingPalettes.length) {
			/* insert in the most empty palette */
			//const mostEmptyPalette=fittingPalettes[0];
			/* get a random palette */
			const mostEmptyPalette = fittingPalettes[Math.floor(Math.random() * fittingPalettes.length)];
			const missingColors = palette.reduce((missingColors, color) => {
				if (mostEmptyPalette.indexOf(color) === -1)
					missingColors.push(color);
				return missingColors;
			}, []);
			/* merge most empty palette with missing colors with no repeats */
			const newPalette = mostEmptyPalette.concat(missingColors).reduce((unique, color) => {
				if (unique.indexOf(color) === -1)
					unique.push(color);
				return unique;
			}, []);
			acc[acc.indexOf(mostEmptyPalette)] = newPalette;
		} else {
			/* insert unfittable palette */
			acc.push(palette);
		}

		return acc;
	}, []);
	return differentPalettes;
}















const RESCALE_24TO15BIT = 8.22580645161291;
function rgb24to15(r8, g8, b8) {
	const r5 = Math.round(r8 / RESCALE_24TO15BIT) & 0b00011111;
	const g5 = Math.round(g8 / RESCALE_24TO15BIT) & 0b00011111;
	const b5 = Math.round(b8 / RESCALE_24TO15BIT) & 0b00011111;

	return (b5 << 10) + (g5 << 5) + r5;
}
