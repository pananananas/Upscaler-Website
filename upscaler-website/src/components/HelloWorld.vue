<template>
  <div>
    <select v-model="selectedAlgorithm">
      <option value="nearestNeighbor">Nearest Neighbor</option>
      <option value="bilinear">Bilinear Interpolation</option>
			<option value="bicubic">Bicubic Interpolation</option>
			<option value="upscaler">Upscaler.js</option>
    </select>
    <div ref="dropArea" 
         @click="selectFile" 
         @drop="handleDrop" 
         @dragover.prevent 
         @dragenter.prevent 
         class="drop-area">
      Przeciągnij obraz tutaj lub kliknij, aby wybrać powiększany obraz.
    </div>
    <input type="file" ref="fileInput" @change="handleFileChange" style="display: none" />
		<button v-if="newWidth && newHeight" @click="downloadImage">Pobierz</button>
		<div>
    <canvas v-if="newWidth && newHeight" ref="canvas" :width="newWidth" :height="newHeight"></canvas>
		</div>
  </div>
</template>


<script>
import Upscaler from 'upscaler'
import x2 from '@upscalerjs/esrgan-thick/2x'

export default {
  data() {
    return {
      selectedAlgorithm: "nearestNeighbor",
      newWidth: null, 
      newHeight: null,
			originalFilename: null,
			upscaler: new Upscaler({ model: x2}),
    };
  },
  methods: {
    downloadImage() {
      const canvas = this.$refs.canvas;
      const dataURL = canvas.toDataURL("image/png");
      const downloadLink = document.createElement('a');
      downloadLink.href = dataURL;
      downloadLink.download = this.getDownloadFilename();
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    },
    getDownloadFilename() {
      const baseName = this.originalFilename ? this.originalFilename.split('.')[0] : "image";
      return `${baseName}_${this.selectedAlgorithm}.png`;
    },
    handleFileChange(event) {
      const file = event.target.files[0];
      this.originalFilename = file.name;
      this.processImage(file);
    },
    handleDrop(event) {
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      this.originalFilename = file.name;
      this.processImage(file);
		},	

    selectFile() {
      this.$refs.fileInput.click();
    },

    async processImage(file) {
      if (file && file.type.startsWith("image/")) {
        const image = await this.createImageFromFile(file);
        
        this.newWidth = image.width * 4;
        this.newHeight = image.height * 4;

        this.$nextTick(() => {
          const canvas = this.$refs.canvas;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(image, 0, 0, image.width, image.height);

          const srcData = ctx.getImageData(0, 0, image.width, image.height);
          const dstData = new ImageData(this.newWidth, this.newHeight);

          if (this.selectedAlgorithm === "bilinear") {
            this.bilinearInterpolation(srcData, dstData, image.width, image.height);
          } else if (this.selectedAlgorithm === "nearestNeighbor") {
            this.nearestNeighbor(srcData, dstData, image.width, image.height);
          } else if (this.selectedAlgorithm === "bicubic") {
						this.bicubicInterpolation(srcData, dstData, image.width, image.height);
					} else if (this.selectedAlgorithm === "upscaler") {
						this.upscaler.upscale(file).then((upscaledImgSrc) => {
							const img = document.createElement("img");
							img.src = upscaledImgSrc;
							document.getElementById("target").appendChild(img);
						});
					}

          ctx.putImageData(dstData, 0, 0);
        });
      }
    },

    nearestNeighbor(srcData, dstData, srcWidth, srcHeight) {
      const srcPixels = srcData.data;
      const dstPixels = dstData.data;

      const ratioX = srcWidth / dstData.width;
      const ratioY = srcHeight / dstData.height;

      for (let y = 0; y < dstData.height; y++) {
        for (let x = 0; x < dstData.width; x++) {
          const srcX = Math.round(x * ratioX);
          const srcY = Math.round(y * ratioY);

          const srcIndex = (srcY * srcWidth + srcX) * 4;
          const dstIndex = (y * dstData.width + x) * 4;

          for (let i = 0; i < 4; i++) {
            dstPixels[dstIndex + i] = srcPixels[srcIndex + i];
          }
        }
      }
    },

		bilinearInterpolation(srcData, dstData, srcWidth, srcHeight) {
			const srcPixels = srcData.data;
			const dstPixels = dstData.data;

			const ratioX = srcWidth / dstData.width;
			const ratioY = srcHeight / dstData.height;

			for (let y = 0; y < dstData.height; y++) {
				for (let x = 0; x < dstData.width; x++) {
					let posX = x * ratioX;
					let posY = y * ratioY;

					let x1 = Math.floor(posX);
					let y1 = Math.floor(posY);
					let x2 = Math.min(x1 + 1, srcWidth - 1);
					let y2 = Math.min(y1 + 1, srcHeight - 1);

					let indexDst = (y * dstData.width + x) * 4;
					for (let c = 0; c < 3; c++) {  // RGB channels
						let i1 = (y1 * srcWidth + x1) * 4 + c;
						let i2 = (y1 * srcWidth + x2) * 4 + c;
						let i3 = (y2 * srcWidth + x1) * 4 + c;
						let i4 = (y2 * srcWidth + x2) * 4 + c;

						let value = srcPixels[i1] * (x2 - posX) * (y2 - posY) +
												srcPixels[i2] * (posX - x1) * (y2 - posY) +
												srcPixels[i3] * (x2 - posX) * (posY - y1) +
												srcPixels[i4] * (posX - x1) * (posY - y1);
						
						dstPixels[indexDst + c] = value;
					}
					dstPixels[indexDst + 3] = 255;  // alpha channel
				}
			}
		},

    bicubicInterpolation(srcData, dstData, srcWidth, srcHeight) {
        // const srcPixels = srcData.data;
        const dstPixels = dstData.data;

        const ratioX = srcWidth / dstData.width;
        const ratioY = srcHeight / dstData.height;

        const cubicInterpolate = (p, x) => {
            return p[1] + 0.5 * x * (p[2] - p[0] + x * (2.0 * p[0] - 5.0 * p[1] + 4.0 * p[2] - p[3] + x * (3.0 * (p[1] - p[2]) + p[3] - p[0])));
        };

        const getPixel = (imageData, x, y) => {
            const position = (x + y * imageData.width) * 4;
            return [
                imageData.data[position],
                imageData.data[position + 1],
                imageData.data[position + 2],
                imageData.data[position + 3]
            ];
        };

        for (let y = 0; y < dstData.height; y++) {
            for (let x = 0; x < dstData.width; x++) {
                const gx = x * ratioX;
                const gy = y * ratioY;

                const gxi = Math.floor(gx);
                const gyi = Math.floor(gy);

                const c = [];
                for (let j = -1; j <= 2; j++) {
                    const rowData = [];
                    for (let i = -1; i <= 2; i++) {
                        rowData.push(getPixel(srcData, gxi + i, gyi + j));
                    }
                    c.push(rowData);
                }

                const red = [];
                const green = [];
                const blue = [];
                const alpha = [];
                for (let j = 0; j < 4; j++) {
                    const r = cubicInterpolate([
                        c[j][0][0],
                        c[j][1][0],
                        c[j][2][0],
                        c[j][3][0]
                    ], gx - gxi);

                    const g = cubicInterpolate([
                        c[j][0][1],
                        c[j][1][1],
                        c[j][2][1],
                        c[j][3][1]
                    ], gx - gxi);

                    const b = cubicInterpolate([
                        c[j][0][2],
                        c[j][1][2],
                        c[j][2][2],
                        c[j][3][2]
                    ], gx - gxi);

                    const a = cubicInterpolate([
                        c[j][0][3],
                        c[j][1][3],
                        c[j][2][3],
                        c[j][3][3]
                    ], gx - gxi);

                    red.push(r);
                    green.push(g);
                    blue.push(b);
                    alpha.push(a);
                }

                const dstIndex = (y * dstData.width + x) * 4;

                dstPixels[dstIndex] = cubicInterpolate(red, gy - gyi);
                dstPixels[dstIndex + 1] = cubicInterpolate(green, gy - gyi);
                dstPixels[dstIndex + 2] = cubicInterpolate(blue, gy - gyi);
                dstPixels[dstIndex + 3] = cubicInterpolate(alpha, gy - gyi);
            }
        }
    },

		async upscaleWithUpscaler(image, ctx) {
			const pathToImage = URL.createObjectURL(image);
			try {
				const upscaledImageSrc = await this.upscaler.upscale(pathToImage);
				const upscaledImage = await this.createImageFromSrc(upscaledImageSrc);
				
				this.newWidth = upscaledImage.width;
				this.newHeight = upscaledImage.height;
				
				ctx.drawImage(upscaledImage, 0, 0, upscaledImage.width, upscaledImage.height);
			} catch (error) {
				console.error("Error during upscaling with Upscaler.js:", error);
			}
		},

		async createImageFromSrc(src) {
			return new Promise((resolve, reject) => {
				const image = new Image();
				image.onload = () => resolve(image);
				image.onerror = reject;
				image.src = src;
			});
		},

    async createImageFromFile(file) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = URL.createObjectURL(file);
      });
    },
  },
};
</script>

<style>
.drop-area {
  border: 2px dashed #ccc;
  padding: 20px;
  text-align: center;
  cursor: pointer;
}
</style>