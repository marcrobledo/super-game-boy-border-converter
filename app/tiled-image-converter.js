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
	convertTiledImage(image, 4, ColorRGB15);
}
export function convertTiledGBCImage(image){
	convertTiledImage(image, 2, ColorRGB15);
}

function convertTiledImage(image, bpp, colorClass){
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

	if(typeof colorClass?.prototype?.equals!=='function')
		throw new Error('TiledImageConverter: invalid colorClass');



	/* create temporary canvas */
	const tempCanvas=document.createElement('canvas');
	tempCanvas.width=8;
	tempCanvas.height=8;
	const tempCtx=tempCanvas.getContext('2d');
	const blankImageData=tempCtx.getImageData(0,0,8,8);



	/* extract tiles information */
	const tiles=[];
	for(var y=0; y<nRows; y++){
		for(var x=0; x<nCols; x++){
			tempCtx.putImageData(blankImageData, 0, 0);
			tempCtx.drawImage(image, -x*8, -y*8);
			const imageData=tempCtx.getImageData(0,0,8,8);
			const tileInfo={
				palette:[],
				pixels:{
					indexes:[],
					colors:[]
				}
			};
			for(let i=0; i<8*8*4; i+=4){
				const r=imageData.data[i + 0];
				const g=imageData.data[i + 1];
				const b=imageData.data[i + 2];
				const color=new colorClass(r, g, b);
				const colorExists=tileInfo.palette.find((existingColor) => existingColor.equals(color));
				if(colorExists){
					tileInfo.pixels.indexes=tileInfo.palette.indexOf(colorExists);
					tileInfo.pixels.colors=colorExists;
				}else{
					tileInfo.palette.push(color);
					tileInfo.pixels.indexes=tileInfo.palette.indexOf(color);
					tileInfo.pixels.colors=color;
				}
			}
			tiles.push(tileInfo);

			if(tileInfo.palette.size>Math.pow(2, bpp))
				throw new Error('TiledImageConverter: too many color for tile (row:'+y+', col:'+x+')');
		}
	}

	const tilesSortedByPaletteSize=tiles.sort((a, b) => a.palette.length < b.palette.length);

	const differentPalettes=tilesSortedByPaletteSize.reduce((acc, tileInfo) => {
		//to-do
		return acc;
	}, []);

	console.log(tilesSortedByPaletteSize);
	return tilesSortedByPaletteSize;
}





class ColorRGB15{
	constructor(r8, g8, b8){
		this.r8=r8;
		this.g8=g8;
		this.b8=b8;
		this.r=ColorRGB15.to5bit(r8);
		this.g=ColorRGB15.to5bit(g8);
		this.b=ColorRGB15.to5bit(b8);

		this.data=(this.b << 10) + (this.g << 5) + this.r;
	}
	equals(color2){
		return this.data===color2.data;
	}
	static RESCALE_24TO15BIT=8.22580645161291;
	static BIT5_MASK=0x1f;
	static to5bit(color){
		return Math.round(color/ColorRGB15.RESCALE_24TO15BIT) & ColorRGB15.BIT5_MASK;
	}
}