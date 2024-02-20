import { Action, ColorZeroBehaviour, Dither, DitherPattern } from './tiledpalettequant/enums.js';
import { PaletteSNES, ColorRGB15, Tile4BPP, Map } from './snes.js'


/* app loading */
$(document).ready((evt) => {
	/* UI events */
	$('#img-source').on('load', function(evt) {
		var valid=(this.width===256 && this.height===224);
		$('#btn-quantize').prop('disabled', !valid);
		if(valid)
			UI.notifications.empty()
		else
			UI.notifications.error('Invalid image dimensions (must be 256x224)');


		var canvas=document.createElement('canvas');
		var ctx=canvas.getContext('2d');
		ctx.drawImage(this, 0, 0);
		var pixels=[
			ctx.getImageData(80, 80, 1, 1),
			ctx.getImageData(176, 80, 1, 1),
			ctx.getImageData(80, 134, 1, 1),
			ctx.getImageData(176, 134, 1, 1)
		]
		var foundColor=true;
		for(var i=1; i<4 && foundColor; i++){
			if(
				pixels[0].data[0]!==pixels[i].data[0] ||
				pixels[0].data[1]!==pixels[i].data[1] ||
				pixels[0].data[2]!==pixels[i].data[2] ||
				pixels[0].data[3]!==pixels[i].data[3] ||
				pixels[i].data[4]<255
			){
				foundColor=false;
			}
		}
		
		if(foundColor){
			$('#input-color').val('#'+[pixels[0].data[0], pixels[0].data[1], pixels[0].data[2]].map(c => c.toString(16).padStart(2, '0')).join(''));
		}
	});
	$('#img-source').on('error', function(evt) {
		UI.notifications.error('Invalid image file');
	});
	$('#input-file').on('change', function(evt) {
		if(!this.files || !this.files.length)
			UI.notifications.error('Invalid file');

		if (this.files.length > 0) {
			document.getElementById('img-source').src=URL.createObjectURL(this.files[0]);
		}
	});
	$('#btn-import').on('click', (evt) => {
		$('#input-file').trigger('click');
	});
	$('#btn-quantize').on('click', function(){
		$('main button').prop('disabled', true);


		UI.notifications.empty();

		try{
			const props={
				numPalettes: 3,
				fractionOfPixels: parseFloat(document.getElementById('fraction-pixels').value),
				colorZero: [255, 0, 255],
				dithering: DITHER_VALUES[parseInt(document.getElementById('select-dither').value)],
				ditheringWeight: parseFloat(document.getElementById('input-dithering-weight').value),
				ditheringMethod: DITHER_PATTERN_VALUES[parseInt(document.getElementById('select-dither-method').value)]
			};

			if(/^#[0-9a-f]{6}$/i.test(document.getElementById('input-color').value)){
				const colorStr = document.getElementById('input-color').value;
				props.colorZero = [
					parseInt(colorStr.slice(1, 3), 16),
					parseInt(colorStr.slice(3, 5), 16),
					parseInt(colorStr.slice(5, 7), 16),
				];
			}else{
				//throw new Error('Invalid color value');
			}

			if (isNaN(props.ditheringWeight)) {
				//fix invalid dithering weight
				props.ditheringWeight = 0.5;
				document.getElementById('input-dithering-weight').value = props.ditheringWeight.toString();
			}

			quantizeSNESMap(document.getElementById('img-source'), props);
		}catch(err){
			UI.notifications.error(err.message);
		}

	});

	$('#btn-export-map').on('click', exportMap);
	$('#btn-export-tiles').on('click', exportTiles);
	$('#btn-export-palettes').on('click', exportPalettes);
	$('#btn-export-sgb').on('click', exportSGB);

	$('#select-dither').on('change', UI.toggleDitheringOptions);


	UI.toggleDitheringOptions();
});



const UI={
	notifications:{
		empty:function(){
			$('#alerts').empty();
		},
		add:function(message, className){
			$('#alerts').append(
				$('<div></<div>')
					.addClass('alert'+(className? ' alert-'+className : ''))
					.html(message)
			)
		},
		error:function(message){
			this.empty();
			this.add(message, 'danger');
		},
		warning:function(message){
			this.empty();
			this.add(message, 'warning');
		}
	},
	
	toggleDitheringOptions:function(){
		if(parseInt($('#select-dither').val())){
			$('#container-dithering-options').show();
		}else{
			$('#container-dithering-options').hide();
		}
	}
}






/* tiledpalettequant web worker by rilden (https://rilden.github.io/tiledpalettequant/) that does the whole magic! */

const DITHER_VALUES = [Dither.Off, Dither.Fast, Dither.Slow];
const DITHER_PATTERN_VALUES = [
	DitherPattern.Diagonal4,
	DitherPattern.Horizontal4,
	DitherPattern.Vertical4,
	DitherPattern.Diagonal2,
	DitherPattern.Horizontal2,
	DitherPattern.Vertical2,
];

let worker = null;
function quantizeSNESMap(sourceImage, props) {
	if (worker)
		worker.terminate();


	worker = new Worker('./app/tiledpalettequant/worker.js');
	worker.onmessage = function (event) {
		const data = event.data;
		if (data.action === Action.UpdateProgress) {
			document.getElementById('progress-bar').value = data.progress;
		}
		else if (data.action === Action.DoneQuantization) {
			secondStep();
		}
		else if (data.action === Action.UpdateQuantizedImage) {
			const imageData = data.imageData;
			const quantizedImageData = new window.ImageData(imageData.width, imageData.height);
			for (let i = 0; i < imageData.data.length; i++) {
				quantizedImageData.data[i] = imageData.data[i];
			} 
			const canvas=document.getElementById('canvas-map');
			canvas.getContext('2d').putImageData(quantizedImageData, 0, 0);
		}
		else if (data.action === Action.UpdatePalettes) {
			const palettes = data.palettes;
			const PALETTE_TILE_SIZE = 16;
			const canvas=document.getElementById('canvas-palettes');
			//canvas.width = data.numColors * PALETTE_TILE_SIZE;
			canvas.height = data.numPalettes * PALETTE_TILE_SIZE;
			const palCtx = canvas.getContext('2d');
			for (let j = 0; j < palettes.length; j += 1) {
				for (let i = 0; i < palettes[j].length; i += 1) {
					let colorString=`rgb(
						${Math.round(palettes[j][i][0])},
						${Math.round(palettes[j][i][1])},
						${Math.round(palettes[j][i][2])})`;
					palCtx.fillStyle = colorString;
					palCtx.fillRect(i * PALETTE_TILE_SIZE, j * PALETTE_TILE_SIZE, PALETTE_TILE_SIZE, PALETTE_TILE_SIZE);
					
				}
			}
		}
	};
	
	const canvas = document.createElement('canvas');
	canvas.width = sourceImage.width;
	canvas.height = sourceImage.height;
	const ctx = canvas.getContext('2d');
	ctx.drawImage(sourceImage, 0, 0);
	const imageData=ctx.getImageData(0, 0, sourceImage.width, sourceImage.height);


	$('#app').show();
	$('#intro').hide();

	worker.postMessage({
		action: Action.StartQuantization,
		imageData: imageData,
		quantizationOptions: {
			tileWidth: 8,
			tileHeight: 8,
			numPalettes: 3,
			colorsPerPalette: 16,
			bitsPerChannel: 5,
			fractionOfPixels: props.fractionOfPixels,
			colorZeroBehaviour: ColorZeroBehaviour.Shared,
			colorZeroValue: props.colorZero,
			dither: props.dithering,
			ditherWeight: props.ditheringWeight,
			ditherPattern: props.ditheringMethod
		},
	});
};






/* prepare SNES data from quantized images */
var currentPalettes, currentTiles, currentMap;

function findInTileset(tileset, tile){
	for(var i=0; i<tileset.length; i++){
		if(tileset[i]){
			var tileMatch=tileset[i].equals(tile);
			if(tileMatch)
				return tileMatch;
		}
	}
	return null;
}

function secondStep(){
	var currentCanvas=document.getElementById('canvas-palettes');
	var currentCtx=currentCanvas.getContext('2d');

	/* parse palettes */
	let numPalettes = 3;
	currentPalettes=new Array(numPalettes);
	for(var y=0; y<numPalettes; y++){
		currentPalettes[y]=new PaletteSNES();
		for(var x=0; x<16; x++){
			var imageData=currentCtx.getImageData(x*16, y*16, 1, 1).data;
			currentPalettes[y].colors[x]=new ColorRGB15(imageData[0], imageData[1], imageData[2]);
		}
	}

	/* parse tiles, build map */
	currentCanvas=document.getElementById('canvas-map');
	currentCtx=currentCanvas.getContext('2d');
	currentTiles=new Array();
	currentMap=new Map(32, 28);
	var nDuplicates=0;
	for(var y=0; y<28; y++){
		for(var x=0; x<32; x++){
			var imageData=currentCtx.getImageData(x*8, y*8, 8, 8).data;
			var tile=Tile4BPP.fromImageData(imageData, currentPalettes);

			var tileMatch=findInTileset(currentTiles, tile);
			var attributes;
			if(tileMatch){
				currentMap.tiles[y*32 + x]=tileMatch.tile;
				attributes={
					paletteIndex:currentPalettes.indexOf(tile.palette),
					flipX:tileMatch.flipValue & Tile4BPP.FLIP_X,
					flipY:tileMatch.flipValue & Tile4BPP.FLIP_Y
				};
				nDuplicates++;
			}else{
				currentTiles.push(tile);

				currentMap.tiles[y*32 + x]=tile;
				attributes={
					paletteIndex:currentPalettes.indexOf(tile.palette),
					flipX:false,
					flipY:false
				};
			}

			currentMap.attributes[y*32 + x]=
				((attributes.flipY? 1:0) << 7) |
				((attributes.flipX? 1:0) << 6) |
				((attributes.paletteIndex + 4) << 2) |
				0x00;
		}
	}
	currentCanvas=document.getElementById('canvas-tiles');
	currentCtx=currentCanvas.getContext('2d');
	//currentCanvas.width=128;
	currentCanvas.height=Math.ceil(currentTiles.length/16) * 8;
	for(var i=0; i<currentTiles.length; i++){
		currentCtx.putImageData(currentTiles[i].toImageData(currentTiles[i].palette), (i%16) * 8, (Math.floor(i/16)) * 8);
	}
	if(currentTiles.length>256){
		UI.notifications.error('256 tiles SNES limit exceeded. Edit manually your image and try to reduce the amount of unique 8x8 tiles.');
	}
	
	$('main button').prop('disabled', false);
}



function saveUint8Array(u8array, name){
	var blob=new Blob([u8array.buffer], {type: 'application/octet-stream'});
	saveAs(blob, name);
}
function buildDataMap(){
	var u8array=new Uint8Array(currentMap.tiles.length * 2);
	for(var i=0; i<currentMap.tiles.length; i++){
		u8array[(i * 2) + 0]=currentTiles.indexOf(currentMap.tiles[i]);
		u8array[(i * 2) + 1]=currentMap.attributes[i];
	}
	return u8array;
}
function exportMap(){
	saveUint8Array(buildDataMap(), 'sgb_border_map.bin');
}
function buildDataTiles(){
	var u8array=new Uint8Array(currentTiles.length * 32);
	for(var i=0; i<currentTiles.length; i++){
		for(var j=0; j<32; j++){
			u8array[(i * 32) + j]=currentTiles[i].data[j];
		}
	}
	return u8array;
}
function exportTiles(){
	saveUint8Array(buildDataTiles(), 'sgb_border_tiles.bin');
}
function buildDataPalettes(){
	var u8array=new Uint8Array(currentPalettes.length * 16*2);
	for(var i=0; i<currentPalettes.length; i++){
		for(var j=0; j<16; j++){
			u8array[(i * 32) + (j* 2) + 0]=currentPalettes[i].colors[j].data & 0xff;
			u8array[(i * 32) + (j* 2) + 1]=currentPalettes[i].colors[j].data >> 8;
		}
	}
	return u8array;
}
function exportPalettes(){
	saveUint8Array(buildDataPalettes(), 'sgb_border_palettes.bin');
}
function exportSGB(){
	var u8array=new Uint8Array((256 * 32) + (32 * 28 * 2) + (16 * 2 * 4));

	var dataTiles=buildDataTiles();
	for(var i=0; i<dataTiles.length; i++){
		u8array[0x0000 + i] = dataTiles[i];
	}

	var dataMap=buildDataMap();
	for(var i=0; i<dataMap.length; i++){
		u8array[0x2000 + i] = dataMap[i];
	}

	var dataPalettes=buildDataPalettes();
	for(var i=0; i<dataPalettes.length; i++){
		u8array[0x2700 + i] = dataPalettes[i];
	}

	saveUint8Array(u8array, 'my_border.sgb');
}