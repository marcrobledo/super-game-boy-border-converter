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
 



export function convertTiledSNESImage(image){
	convertTiledImage(image, 4, rgb24to15);
}
export function convertTiledGBCImage(image){
	convertTiledImage(image, 2, rgb24to15);
}

function convertTiledImage(image, bpp, colorConverterFunction){
	/* check parameters validity */
	if(!image instanceof Image)
		throw new Error('TiledImageConverter: image is not an instance of Image');
	else if(image.width%8!==0 || image.height%8!==0)
		throw new Error('TiledImageConverter: invalid image dimensions (width and height must be divisible by 8)');
	const nRows=image.height/8;
	const nCols=image.width/8;

	if(typeof bpp=='string')
		bpp=parseInt(bpp);
	if(bpp!==2 && bpp!==4)
		throw new Error('TiledImageConverter: invalid bpp (can only be 2 or 4)');

	if(typeof colorConverterFunction!=='function')
		throw new Error('TiledImageConverter: invalid colorConverterFunction');



	/* create temporary canvas */
	const tempCanvas=document.createElement('canvas');
	tempCanvas.width=image.width;
	tempCanvas.height=image.height;
	const tempCtx=tempCanvas.getContext('2d');
	const blankImageData=tempCtx.getImageData(0,0,8,8);
	tempCtx.drawImage(image, 0, 0);



	/* extract all palettes from tiles */
	const allPalettes=[];
	for(var y=0; y<nRows; y++){
		for(var x=0; x<nCols; x++){
			const imageData=tempCtx.getImageData(x*8,y*8,8,8);
			const tileColors=[];
			for(let i=0; i<8*8*4; i+=4){
				const r=imageData.data[i + 0];
				const g=imageData.data[i + 1];
				const b=imageData.data[i + 2];
				const color=new colorConverterFunction(r, g, b);
				if(tileColors.indexOf(color)!==-1){
					tileColors.push(color);
					if(tileColors.length>Math.pow(2, bpp))
						throw new Error('TiledImageConverter: too many color for tile (row:'+y+', col:'+x+')');
				}
			}
			allPalettes.push(tileColors);
		}
	}

	const uniquePalettes=allPalettes.reduce((uniquePalettes, palette) => {
		const foundPalette=uniquePalettes.some((uniquePalette) => {
			let foundColors=palette.reduce((nFoundColors, palette) => {
				if(uniquePalette.indexOf(color)===-1)
					nFoundColors++;
			}, 0);

			return foundColors===tileInfo.palette.length;
		});
		if(!foundPalette)
			uniquePalettes.push(palette);
		return uniquePalettes;
	}, []);

	const palettesSortedBySize=uniquePalettes.sort((a, b) => a.length < b.length);

	const differentPalettes=tilesSortedByPaletteSize.reduce((acc, tileInfo) => {
		//to-do
		return acc;
	}, []);

	console.log(palettesSortedBySize);
	return palettesSortedBySize;
}





const RESCALE_24TO15BIT=8.22580645161291;
function rgb24to15(r8, g8, b8){
	const r5=Math.round(r8/RESCALE_24TO15BIT) & 0b00011111;
	const g5=Math.round(g8/RESCALE_24TO15BIT) & 0b00011111;
	const b5=Math.round(b8/RESCALE_24TO15BIT) & 0b00011111;

	return (b5 << 10) + (g5 << 5) + r5;
}
