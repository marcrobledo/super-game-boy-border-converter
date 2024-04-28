'use strict';
import { extractPalettesSNES } from './tiled-image-converter.js'


onmessage = function (event) {
	const data = event.data;
	const imageData = data.imageData;
	const colorZero = data.colorZero;
	const maxTries = data.maxTries;

	let tries = 0;
	var found = false;
	while (!found && tries < maxTries) {
		try {
			const palettes = extractPalettesSNES(imageData, colorZero);
			tries++;
			if (palettes.length <= 3) {
				found = palettes;
				break;
			}
		}catch(err){
			break;
		}
	}

	postMessage({ palettes: found, tries: tries });
};

