function PaletteSNES(){
	this.colors=new Array(16);
	for(var i=0; i<this.colors.length; i++)
		this.colors[i]=new ColorRGB15(0, 0, 0);
}

PaletteSNES.prototype.getColorIndex=function(color){	
	for(var i=0; i<this.colors.length; i++){
		if(this.colors[i].equals(color))
			return i;
	}
	return -1;
}
PaletteSNES.prototype.hasColor=function(color){
	return this.getColorIndex(color)!==-1;
}
PaletteSNES.prototype.hasColors=function(colors){
	for(var i=0; i<colors.length; i++){
		if(!this.hasColor(colors[i]))
			return false;
	}
	return true;
}
PaletteSNES.prototype.export=function(){
	return this.colors.map((color) => {
		return color.data;
	});
}


function ColorRGB15(r8, g8, b8){
	this.r8=r8;
	this.g8=g8;
	this.b8=b8;
	this.r=ColorRGB15.to5bit(r8);
	this.g=ColorRGB15.to5bit(g8);
	this.b=ColorRGB15.to5bit(b8);

	this.data=(this.b << 10) + (this.g << 5) + this.r;
}
ColorRGB15.prototype.equals=function(color2){
	return this.data===color2.data;
}


ColorRGB15.RESCALE_24TO15BIT=8.22580645161291;
ColorRGB15.BIT5_MASK=0x1f;

ColorRGB15.to5bit=function(color){return Math.round(color/ColorRGB15.RESCALE_24TO15BIT) & ColorRGB15.BIT5_MASK}
ColorRGB15.to8bit=function(color){return Math.round(color*ColorRGB15.RESCALE_24TO15BIT)}
ColorRGB15.toRGB24=function(rgb15){
	const r8=ColorRGB15.to8bit(rgb15 & ColorRGB15.BIT5_MASK);
	const g8=ColorRGB15.to8bit((rgb15 >>> 5) & ColorRGB15.BIT5_MASK);
	const b8=ColorRGB15.to8bit((rgb15 >>> 10) & ColorRGB15.BIT5_MASK);
	return [r8, g8, b8];
}








function Tile4BPP(){
	this.data=[
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
	];

	this.palette=new PaletteSNES();
}
Tile4BPP.prototype.toJSON=function(){
	return this.data.concat([currentProject.palettes.indexOf(this.palette)]);
}
Tile4BPP.prototype.getPixel=function(row, col){
	return(
		((this.data[Math.floor(row*2) + 16 + 1] & Tile4BPP.COL_MASK[col]) << 3) +
		((this.data[Math.floor(row*2) + 16] & Tile4BPP.COL_MASK[col]) << 2) +
		((this.data[Math.floor(row*2) + 1] & Tile4BPP.COL_MASK[col]) << 1) +
		((this.data[Math.floor(row*2)] & Tile4BPP.COL_MASK[col]))
	) >> 7-col;
}
Tile4BPP.prototype.setPixel=function(row, col, colorIndex){
	this.data[(row*2)]=(this.data[(row*2)] & Tile4BPP.COL_MASK_NEG[col]) | ((colorIndex & 0x01) << (7-col));
	this.data[(row*2) + 1]=(this.data[(row*2) + 1] & Tile4BPP.COL_MASK_NEG[col]) | (((colorIndex >>> 1) & 0x01) << (7-col));

	this.data[(row*2) + 16]=(this.data[(row*2) + 16] & Tile4BPP.COL_MASK_NEG[col]) | (((colorIndex >>> 2) & 0x01) << (7-col));
	this.data[(row*2) + 17]=(this.data[(row*2) + 16 + 1] & Tile4BPP.COL_MASK_NEG[col]) | (((colorIndex >>> 3) & 0x01) << (7-col));
}
Tile4BPP.prototype.toImageData=function(palette, flipX, flipY){
	const imageData=new ImageData(8, 8);
	var k=0;
	for(var i=0; i<8; i++){
		for(var j=0; j<8; j++){
			imageData.data[k++]=palette.colors[this.getPixel(flipY? 7-i : i, flipX? 7-j : j)].r8;
			imageData.data[k++]=palette.colors[this.getPixel(flipY? 7-i : i, flipX? 7-j : j)].g8;
			imageData.data[k++]=palette.colors[this.getPixel(flipY? 7-i : i, flipX? 7-j : j)].b8;
			imageData.data[k++]=255;
		}
	}
	return imageData;
}
Tile4BPP.prototype.buildFlippedData=function(){
	this._flippedTiles=new Array(4);
	this._flippedTiles[Tile4BPP.FLIP_NONE]=this.data;

	this._flippedTiles[Tile4BPP.FLIP_X]=new Tile4BPP();
	this._flippedTiles[Tile4BPP.FLIP_Y]=new Tile4BPP();
	this._flippedTiles[Tile4BPP.FLIP_XY]=new Tile4BPP();

	for(var y=0; y<8; y++){
		for(var x=0; x<8; x++){
			this._flippedTiles[Tile4BPP.FLIP_X].setPixel(y, x, this.getPixel(y, 7-x));
			this._flippedTiles[Tile4BPP.FLIP_Y].setPixel(y, x, this.getPixel(7-y, x));
			this._flippedTiles[Tile4BPP.FLIP_XY].setPixel(y, x, this.getPixel(7-y, 7-x));
		}
	}

	this._flippedTiles[Tile4BPP.FLIP_X]=this._flippedTiles[Tile4BPP.FLIP_X].data;
	this._flippedTiles[Tile4BPP.FLIP_Y]=this._flippedTiles[Tile4BPP.FLIP_Y].data;
	this._flippedTiles[Tile4BPP.FLIP_XY]=this._flippedTiles[Tile4BPP.FLIP_XY].data;
}
Tile4BPP.prototype.equals=function(tile){
	if(!this._flippedTiles)
		this.buildFlippedData();

	for(var i=0; i<this._flippedTiles.length; i++){
		var found=true;
		for(var j=0; j<32 && found; j++){
			if(this._flippedTiles[i][j]!==tile.data[j])
				found=false;
		}
		if(found){
			return{
				tile:this,
				palette:tile.palette,
				flipValue:i
			}
		}
	}
	return false;
}
Tile4BPP.FLIP_NONE=0b00000000;
Tile4BPP.FLIP_X=0b00000001;
Tile4BPP.FLIP_Y=0b00000010;
Tile4BPP.FLIP_XY=Tile4BPP.FLIP_X | Tile4BPP.FLIP_Y;
Tile4BPP.COL_MASK=[0x80, 0x40, 0x20, 0x10, 0x08, 0x04, 0x02, 0x01];
Tile4BPP.COL_MASK_NEG=[0x7f, 0xbf, 0xdf, 0xef, 0xf7, 0xfb, 0xfd, 0xfe];


Tile4BPP.fromImageData=function(imageData, possiblePalettes){
	var allColors=new Array(64);
	for(var i=0; i<64; i++){
		allColors[i]=new ColorRGB15(imageData[i*4 + 0], imageData[i*4 + 1], imageData[i*4 + 2]);
	}

	var uniqueColors=allColors.reduce(function(acc, current){
		let foundColor=false;
		for(let i=0; i<acc.length; i++){
			if(acc[i].equals(current))
				return acc;
		}
		
		if(!acc.includes(current))
			acc.push(current);
		return acc;
	}, []);

	var foundPalette=null;
	for(var i=0; i<possiblePalettes.length && !foundPalette; i++){
		if(possiblePalettes[i].hasColors(uniqueColors)){
			foundPalette=possiblePalettes[i];
		}
	}
	
	if(!foundPalette)
		throw new Error('no valid palettes for this tile');

	var tile=new Tile4BPP();
	for(var i=0; i<64; i++){
		tile.setPixel(Math.floor(i/8), i%8, foundPalette.getColorIndex(allColors[i]));
	}
	tile.palette=foundPalette;
	return tile;
}





function Map(w, h){
	this.width=w;
	this.height=h;
	this.tiles=new Array(w * h);
	this.attributes=new Array(w * h);
}
Map.prototype.getTile=function(x, y){
	return this.tiles[y * this.width + x];
}
Map.prototype.getAttributes=function(x, y, tileset){
	if(x<0 || x>=this.width || y<0 || y>=this.height)
		return null;

	const tile=this.getTile(x, y);
	const attributes=this.attributes[y * this.width + x];
	return {
		tile: tile,
		tileIndex: tileset? tileset.indexOf(tile) : 0,
		paletteIndex: (attributes >> 2) & 0b00000011,
		flipX: !!(attributes & 0b01000000),
		flipY: !!(attributes & 0b10000000)
	};
}






















export {PaletteSNES, ColorRGB15, Tile4BPP, Map };