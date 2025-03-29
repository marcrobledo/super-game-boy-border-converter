/*
* Super Game Boy border converter
* Online PNG to SGB raw data border converter
* (last update: 2025-03-29)
* By Marc Robledo https://www.marcrobledo.com
*
* License:
*
* MIT License
* 
* Copyright (c) 2024-2025 Marc Robledo
* This project uses code from https://github.com/rilden/tiledpalettequant by rilden
* which is also licensed under the MIT License.
* 
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
* 
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
* 
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
*/


import { Action, ColorZeroBehaviour, Dither, DitherPattern } from './tiledpalettequant/enums.js';
import { PaletteSNES, ColorRGB15, Tile4BPP, Map } from './snes.js'


/* app loading */
$(document).ready((evt) => {
	/* UI events */
	$('#img-source').on('load', function (evt) {
		var valid = (this.width === 256 && this.height === 224);
		$('#btn-quantize').prop('disabled', !valid);
		if (valid)
			UI.notifications.empty()
		else
			UI.notifications.error('Invalid image dimensions (must be 256x224)');


		var canvas = document.createElement('canvas');
		var ctx = canvas.getContext('2d');
		ctx.drawImage(this, 0, 0);
		var pixels = [
			ctx.getImageData(80, 80, 1, 1),
			ctx.getImageData(176, 80, 1, 1),
			ctx.getImageData(80, 134, 1, 1),
			ctx.getImageData(176, 134, 1, 1)
		]
		var foundColor = true;
		for (var i = 1; i < 4 && foundColor; i++) {
			if (
				pixels[0].data[0] !== pixels[i].data[0] ||
				pixels[0].data[1] !== pixels[i].data[1] ||
				pixels[0].data[2] !== pixels[i].data[2] ||
				pixels[0].data[3] !== pixels[i].data[3] ||
				pixels[i].data[4] < 255
			) {
				foundColor = false;
			}
		}

		if (foundColor) {
			$('#input-color').val('#' + [pixels[0].data[0], pixels[0].data[1], pixels[0].data[2]].map(c => c.toString(16).padStart(2, '0')).join(''));
		}

		tryWorkerLossless = true;
	});
	$('#img-source').on('error', function (evt) {
		UI.notifications.error('Invalid image file');
	});
	$('#input-file').on('change', function (evt) {
		if (!this.files || !this.files.length)
			UI.notifications.error('Invalid file');

		if (this.files.length > 0) {
			var tempImg = new Image();
			tempImg.addEventListener('load', function () {
				if (tempImg.width === 256 && tempImg.height === 224) {
					predefinedPalettesImageData = null;
					$('#img-source').attr('src', tempImg.src);
				} else if (tempImg.width === 256 && tempImg.height === 232) { /* embedded palettes */
					predefinedPalettesImageData = extractEmbededPalettesImageData(tempImg);
					$('#img-source').attr('src', removeEmbededPalettes(tempImg));
				} else {
					UI.notifications.error('Invalid image dimensions (must be 256x224)');
				}
			});
			tempImg.src = URL.createObjectURL(this.files[0]);
		}
	});
	$('#btn-import').on('click', (evt) => {
		$('#input-file').trigger('click');
	});
	$('#btn-quantize').on('click', function () {
		$('main button').prop('disabled', true);


		UI.notifications.empty();

		try {
			const props = {
				fractionOfPixels: parseFloat(document.getElementById('fraction-pixels').value),
				colorZero: [255, 0, 255],
				dithering: DITHER_VALUES[parseInt(document.getElementById('select-dither').value)],
				ditheringWeight: parseFloat(document.getElementById('input-dithering-weight').value),
				ditheringMethod: DITHER_PATTERN_VALUES[parseInt(document.getElementById('select-dither-method').value)]
			};

			if (/^#[0-9a-f]{6}$/i.test(document.getElementById('input-color').value)) {
				const colorStr = document.getElementById('input-color').value;
				props.colorZero = [
					parseInt(colorStr.slice(1, 3), 16),
					parseInt(colorStr.slice(3, 5), 16),
					parseInt(colorStr.slice(5, 7), 16),
				];
			} else {
				//throw new Error('Invalid color value');
			}

			if (isNaN(props.ditheringWeight)) {
				//fix invalid dithering weight
				props.ditheringWeight = 0.5;
				document.getElementById('input-dithering-weight').value = props.ditheringWeight.toString();
			}

			$('#app').show();
			$('#intro').hide();
			document.getElementById('progress-bar').value = 0;

			const sourceImage = document.getElementById('img-source');
			const canvas = document.createElement('canvas');
			canvas.width = sourceImage.width;
			canvas.height = sourceImage.height;
			const ctx = canvas.getContext('2d');
			ctx.drawImage(sourceImage, 0, 0);
			const imageData = ctx.getImageData(0, 0, sourceImage.width, sourceImage.height);

			$('#lossless-message').hide();
			if (tryWorkerLossless)
				quantizeSNESMapLossless(imageData, props);
			quantizeSNESMapLossy(imageData, props);
		} catch (err) {
			UI.notifications.error(err.message);
		}

	});

	$('#canvas-map').on('click', function () {
		if (this.style.width !== '512px') {
			this.style.width = '512px';
			$(this).addClass('zoom-out');
			$(this).removeClass('zoom-in');
		} else {
			this.style.width = '256px';
			$(this).addClass('zoom-in');
			$(this).removeClass('zoom-out');
		}
	});
	$('#canvas-tiles').on('click', function () {
		if (this.style.width !== '256px') {
			this.style.width = '256px';
			$(this).addClass('zoom-out');
			$(this).removeClass('zoom-in');
		} else {
			this.style.width = '128px';
			$(this).addClass('zoom-in');
			$(this).removeClass('zoom-out');
		}
	});

	/* highlight mouse over tile */
	$('#canvas-map').on('mousemove', function (evt) {
		const tileSize = this.style.width !== '512px' ? 8 : 16;
		const rect = this.getBoundingClientRect();
		const x = Math.floor((evt.clientX - rect.left) / tileSize);
		const y = Math.floor((evt.clientY - rect.top) / tileSize);
		const tilePos = y * 32 + x;

		_repaintCanvases();
		const tile = currentMap.tiles[tilePos];
		const paletteIndex = (currentMap.attributes[tilePos] >> 2) & 0x03;
		_highlightTilesInMap(tile);
		_highlightTileInTileset(tile);
		_highlightPalettes([paletteIndex]);
	});
	$('#canvas-tiles').on('mousemove', function (evt) {
		const tileSize = this.style.width !== '256px' ? 8 : 16;
		const rect = this.getBoundingClientRect();
		const x = Math.floor((evt.clientX - rect.left) / tileSize);
		const y = Math.floor((evt.clientY - rect.top) / tileSize);
		const tileIndex = y * (this.width / 8) + x;

		_repaintCanvases();
		const tile = currentTiles[tileIndex];
		const paletteIndexes = currentMap.tiles.reduce(function (paletteIndexes, tileInMap, index) {
			if (tileInMap === tile) {
				const paletteIndex = (currentMap.attributes[index] >> 2) & 0x03;
				if (!paletteIndexes.includes(paletteIndex)) {
					paletteIndexes.push(paletteIndex);
				}
			}
			return paletteIndexes;
		}, []);
		_highlightTilesInMap(tile);
		_highlightTile(this, x, y);
		_highlightPalettes(paletteIndexes);
	});
	$('#canvas-palettes').on('mousemove', function (evt) {
		const rect = this.getBoundingClientRect();
		const paletteIndex = Math.floor((evt.clientY - rect.top) / 16);

		_repaintCanvases();
		const tilesInfo = currentMap.tiles.reduce(function (acc, tileInMap, index) {
			const paletteIndexInMap = (currentMap.attributes[index] >> 2) & 0x03;
			if (paletteIndexInMap === paletteIndex) {
				acc.inMap.push({ x: index % 32, y: Math.floor(index / 32) });
				const tileIndex = currentTiles.indexOf(tileInMap);
				if (tileIndex !== -1 && !acc.inTileset.includes(tileInMap)) {
					acc.inTileset.push(tileInMap);
				}
			}
			return acc;
		}, { inMap: [], inTileset: [] });

		tilesInfo.inMap.forEach(function (tileInfo) {
			_highlightTile(document.getElementById('canvas-map'), tileInfo.x, tileInfo.y);
		});
		tilesInfo.inTileset.forEach(function (tile) {
			_highlightTileInTileset(tile);
		});
		_highlightPalettes([paletteIndex]);
	});
	$('#canvas-map').on('mouseout', _repaintCanvases);
	$('#canvas-tiles').on('mouseout', _repaintCanvases);
	$('#canvas-palettes').on('mouseout', _repaintCanvases);






	$('#btn-export-map').on('click', exportMap);
	$('#btn-export-tiles').on('click', exportTiles);
	$('#btn-export-palettes').on('click', exportPalettes);
	$('#btn-export-sgb').on('click', exportSGB);

	$('#select-dither').on('change', UI.toggleDitheringOptions);


	UI.toggleDitheringOptions();
	document.getElementById('img-source').src = 'assets/example.png'
});



const UI = {
	savedMap: true,
	savedTiles: true,
	savedPalettes: true,
	setWarnOnLeave: function () {
		if (this.savedMap && this.savedTiles && this.savedPalettes) {
			window.onbeforeunload = null;
		} else {
			window.onbeforeunload = function () {
				return true;
			};
		}
	},
	notifications: {
		empty: function () {
			$('#alerts').empty();
		},
		add: function (message, className) {
			$('#alerts').append(
				$('<div></<div>')
					.addClass('alert' + (className ? ' alert-' + className : ''))
					.html(message)
			)
		},
		error: function (message) {
			this.empty();
			this.add(message, 'danger');
		},
		warning: function (message) {
			this.empty();
			this.add(message, 'warning');
		}
	},

	toggleDitheringOptions: function () {
		if (parseInt($('#select-dither').val())) {
			$('#container-dithering-options').show();
		} else {
			$('#container-dithering-options').hide();
		}
	}
}
let predefinedPalettesImageData;
function generateLosslessImageData(image) {
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	canvas.width = 256;
	canvas.height = 224;
	ctx.drawImage(image, 0, 0);

	const tempImageData = ctx.getImageData(0, 0, image.width, image.height);
	for (var i = 0; i < tempImageData.data.length; i += 4) {
		const r = tempImageData.data[i + 0];
		const g = tempImageData.data[i + 1];
		const b = tempImageData.data[i + 2];
		const rgb15 = new ColorRGB15(r, g, b);
		tempImageData.data[i + 0] = rgb15.r8;
		tempImageData.data[i + 1] = rgb15.g8;
		tempImageData.data[i + 2] = rgb15.b8;
	}
	return tempImageData;
}

function rebuildCanvasPalette(palettes) {
	const PALETTE_TILE_SIZE = 16;
	const canvas = document.getElementById('canvas-palettes');
	canvas.height = palettes.length * PALETTE_TILE_SIZE;
	const palCtx = canvas.getContext('2d');
	for (let j = 0; j < palettes.length; j += 1) {
		for (let i = 0; i < palettes[j].length; i += 1) {
			let colorString = `rgb(
				${Math.round(palettes[j][i][0])},
				${Math.round(palettes[j][i][1])},
				${Math.round(palettes[j][i][2])})`;
			palCtx.fillStyle = colorString;
			palCtx.fillRect(i * PALETTE_TILE_SIZE, j * PALETTE_TILE_SIZE, PALETTE_TILE_SIZE, PALETTE_TILE_SIZE);

		}
	}
}
function rebuildCanvasMap(imageData) {
	document.getElementById('canvas-map').getContext('2d').putImageData(imageData, 0, 0);
}


function removeEmbededPalettes(image) {
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	canvas.width = image.width;
	canvas.height = image.height - 8;
	ctx.drawImage(image, 0, 8, image.width, image.height - 8, 0, 0, image.width, image.height - 8);
	return canvas.toDataURL();
}
function extractEmbededPalettesImageData(image) {
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	canvas.width = 8 * 3;
	canvas.height = 8
	ctx.drawImage(image, 0, 0);
	return ctx.getImageData(0, 0, 8 * 3, 8);
}












/* highlight tiles in canvases */
const _repaintCanvases = function () {
	document.getElementById('canvas-map').getContext('2d').putImageData(document.getElementById('canvas-map').imageDataBackup, 0, 0);
	document.getElementById('canvas-tiles').getContext('2d').putImageData(document.getElementById('canvas-tiles').imageDataBackup, 0, 0);
	document.getElementById('canvas-palettes').getContext('2d').putImageData(document.getElementById('canvas-palettes').imageDataBackup, 0, 0);
}
const _highlightTile = function (canvas, x, y) {
	const ctx = canvas.getContext('2d');
	ctx.strokeStyle = 'red';
	ctx.strokeRect(x * 8, y * 8, 8, 8);
};
const _highlightTilesInMap = function (tile) {
	const tileIndexesInMap = currentMap.tiles.reduce(function (tileIndexes, tileInMap, index) {
		if (tileInMap === tile) {
			tileIndexes.push(index);
		}
		return tileIndexes;
	}, []);
	if (tileIndexesInMap.length) {
		tileIndexesInMap.forEach(function (tileIndex) {
			_highlightTile(document.getElementById('canvas-map'), tileIndex % 32, Math.floor(tileIndex / 32));
		});
	}
};
const _highlightTileInTileset = function (tile) {
	const tileIndex = currentTiles.indexOf(tile);
	if (tileIndex !== -1) {
		_highlightTile(document.getElementById('canvas-tiles'), tileIndex % 16, Math.floor(tileIndex / 16));
	}
};
const _highlightPalettes = function (paletteIndexes) {
	const ctx = document.getElementById('canvas-palettes').getContext('2d');
	ctx.strokeStyle = 'red';
	paletteIndexes.forEach(function (paletteIndex) {
		ctx.strokeRect(0, paletteIndex * 16, 256, 16);
	});
};




























/* lossless method: if all tiles have less than 16 colors, it might not need palette lossy quantization */
let workerLossless = null;
let tryWorkerLossless = true;
function quantizeSNESMapLossless(imageData, props) {
	if (workerLossless)
		workerLossless.terminate();

	workerLossless = new Worker('./app/lossless.worker.js', { type: 'module' });
	workerLossless.onmessage = function (event) {
		const data = event.data;
		if (data.palettes) {
			if (workerLossy)
				workerLossy.terminate();

			console.log('lossless result in ' + data.tries + ' tries, stopping tiledpalettequant worker');
			document.getElementById('progress-bar').value = 100;

			$('#lossless-message').show();
			rebuildCanvasMap(generateLosslessImageData(document.getElementById('img-source')));
			rebuildCanvasPalette(data.palettes.map(palette => palette.map(color => ColorRGB15.toRGB24(color))));
			secondStep();

		} else {
			console.log('failed to generate lossless result in ' + data.tries + ' tries');
			tryWorkerLossless = false;
		}
	};

	if (predefinedPalettesImageData) {
		console.log('predefined palettes found in original image');
		const canvas = document.createElement('canvas');
		canvas.width = imageData.width;
		canvas.height = imageData.height + 8;
		const ctx = canvas.getContext('2d');
		ctx.putImageData(predefinedPalettesImageData, 0, 0);
		ctx.putImageData(imageData, 0, 8);
		imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
	}
	/* web worker */
	workerLossless.postMessage({
		imageData: imageData,
		colorZero: props.colorZero,
		maxTries: 512 /* props.fractionOfPixels===1? 1024 : 512 */
	});
};







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

let workerLossy = null;
function quantizeSNESMapLossy(imageData, props) {
	if (workerLossy)
		workerLossy.terminate();


	workerLossy = new Worker('./app/tiledpalettequant/worker.js');
	workerLossy.onmessage = function (event) {
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
			rebuildCanvasMap(quantizedImageData);
		}
		else if (data.action === Action.UpdatePalettes) {
			rebuildCanvasPalette(data.palettes);
		}
	};

	workerLossy.postMessage({
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



function findInTileset(tileset, tile) {
	for (var i = 0; i < tileset.length; i++) {
		if (tileset[i]) {
			var tileMatch = tileset[i].equals(tile);
			if (tileMatch)
				return tileMatch;
		}
	}
	return null;
}

function secondStep() {
	var currentCanvas = document.getElementById('canvas-palettes');
	var currentCtx = currentCanvas.getContext('2d');

	const PALETTE_TILE_SIZE = 16
	/* parse palettes */
	const MAX_PALETTES = 3;
	currentPalettes = new Array(MAX_PALETTES);
	for (var y = 0; y < MAX_PALETTES; y++) {
		currentPalettes[y] = new PaletteSNES();
		for (var x = 0; x < 16; x++) {
			var imageData = currentCtx.getImageData(x * PALETTE_TILE_SIZE, y * PALETTE_TILE_SIZE, 1, 1).data;
			currentPalettes[y].colors[x] = new ColorRGB15(imageData[0], imageData[1], imageData[2]);
		}
	}

	/* build blank tile */
	/* first tile must be a blank tile, see https://github.com/marcrobledo/super-game-boy-border-converter/issues/2 */
	const blankTile = new Tile4BPP();
	blankTile.palette = currentPalettes[0];

	/* parse tiles, build map */
	currentCanvas = document.getElementById('canvas-map');
	currentCtx = currentCanvas.getContext('2d');
	currentTiles = new Array(blankTile);
	currentMap = new Map(32, 28);
	var nDuplicates = 0;
	var maxPaletteIndex = 0;
	for (var y = 0; y < 28; y++) {
		for (var x = 0; x < 32; x++) {
			var imageData = currentCtx.getImageData(x * 8, y * 8, 8, 8).data;
			var tile = Tile4BPP.fromImageData(imageData, currentPalettes);

			var tileMatch = findInTileset(currentTiles, tile);
			var attributes;
			if (tileMatch) {
				currentMap.tiles[y * 32 + x] = tileMatch.tile;
				attributes = {
					paletteIndex: currentPalettes.indexOf(tile.palette),
					flipX: tileMatch.flipValue & Tile4BPP.FLIP_X,
					flipY: tileMatch.flipValue & Tile4BPP.FLIP_Y
				};
				nDuplicates++;
			} else {
				currentTiles.push(tile);

				currentMap.tiles[y * 32 + x] = tile;
				attributes = {
					paletteIndex: currentPalettes.indexOf(tile.palette),
					flipX: false,
					flipY: false
				};
			}
			if (attributes.paletteIndex > maxPaletteIndex)
				maxPaletteIndex = attributes.paletteIndex;

			currentMap.attributes[y * 32 + x] =
				((attributes.flipY ? 1 : 0) << 7) |
				((attributes.flipX ? 1 : 0) << 6) |
				((attributes.paletteIndex + 4) << 2) |
				0x00;
		}
	}

	const nPalettes = maxPaletteIndex + 1;
	if (nPalettes < 3) {
		while (currentPalettes.length > nPalettes) {
			currentPalettes.pop();
		}
		currentCanvas = document.getElementById('canvas-palettes');
		currentCtx = currentCanvas.getContext('2d');
		var newHeight = PALETTE_TILE_SIZE * nPalettes;
		var imageData = currentCtx.getImageData(0, 0, currentCanvas.width, newHeight);
		currentCanvas.height = newHeight;
		currentCtx.putImageData(imageData, 0, 0);
	}
	currentCanvas = document.getElementById('canvas-tiles');
	currentCtx = currentCanvas.getContext('2d');
	//currentCanvas.width=128;
	currentCanvas.height = Math.ceil(currentTiles.length / 16) * 8;
	for (var i = 0; i < currentTiles.length; i++) {
		currentCtx.putImageData(currentTiles[i].toImageData(currentTiles[i].palette), (i % 16) * 8, (Math.floor(i / 16)) * 8);
	}



	if (currentTiles.length <= 256) {
		$('main button').prop('disabled', false);
		UI.savedMap = false;
		UI.savedTiles = false;
		UI.savedPalettes = false;
		UI.setWarnOnLeave();
	} else {
		tryWorkerLossless = false;
		UI.notifications.error('256 tiles SNES limit exceeded. Edit manually your image and try to reduce the amount of unique 8x8 tiles. <a href="https://github.com/marcrobledo/super-game-boy-border-converter?tab=readme-ov-file#improving-conversion-results" target="_blank">More information</a>');
	}

	/* save image data for repaint canvases */
	['map', 'tiles', 'palettes'].forEach(function (canvasName) {
		const canvas = document.getElementById('canvas-' + canvasName);
		canvas.imageDataBackup = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
	});
}



function saveUint8Array(u8array, name) {
	var blob = new Blob([u8array.buffer], { type: 'application/octet-stream' });
	saveAs(blob, name);
}
function buildDataMap() {
	var u8array = new Uint8Array(currentMap.tiles.length * 2);
	for (var i = 0; i < currentMap.tiles.length; i++) {
		u8array[(i * 2) + 0] = currentTiles.indexOf(currentMap.tiles[i]);
		u8array[(i * 2) + 1] = currentMap.attributes[i];
	}
	return u8array;
}
function exportMap() {
	saveUint8Array(buildDataMap(), 'sgb_border_map.bin');
	UI.savedMap = true;
	UI.setWarnOnLeave();
}
function buildDataTiles() {
	var u8array = new Uint8Array(currentTiles.length * 32);
	for (var i = 0; i < currentTiles.length; i++) {
		for (var j = 0; j < 32; j++) {
			u8array[(i * 32) + j] = currentTiles[i].data[j];
		}
	}
	return u8array;
}
function exportTiles() {
	saveUint8Array(buildDataTiles(), 'sgb_border_tiles.bin');
	UI.savedTiles = true;
	UI.setWarnOnLeave();
}
function buildDataPalettes() {
	var u8array = new Uint8Array(currentPalettes.length * 16 * 2);
	for (var i = 0; i < currentPalettes.length; i++) {
		for (var j = 0; j < 16; j++) {
			u8array[(i * 32) + (j * 2) + 0] = currentPalettes[i].colors[j].data & 0xff;
			u8array[(i * 32) + (j * 2) + 1] = currentPalettes[i].colors[j].data >> 8;
		}
	}
	return u8array;
}
function exportPalettes() {
	saveUint8Array(buildDataPalettes(), 'sgb_border_palettes.bin');
	UI.savedPalettes = true;
	UI.setWarnOnLeave();
}
function exportSGB() {
	var u8array = new Uint8Array((256 * 32) + (32 * 28 * 2) + (16 * 2 * 4));

	var dataTiles = buildDataTiles();
	for (var i = 0; i < dataTiles.length; i++) {
		u8array[0x0000 + i] = dataTiles[i];
	}

	var dataMap = buildDataMap();
	for (var i = 0; i < dataMap.length; i++) {
		u8array[0x2000 + i] = dataMap[i];
	}

	var dataPalettes = buildDataPalettes();
	for (var i = 0; i < dataPalettes.length; i++) {
		u8array[0x2700 + i] = dataPalettes[i];
	}

	saveUint8Array(u8array, 'my_border.sgb');
	UI.savedMap = true;
	UI.savedTiles = true;
	UI.savedPalettes = true;
	UI.setWarnOnLeave();
}