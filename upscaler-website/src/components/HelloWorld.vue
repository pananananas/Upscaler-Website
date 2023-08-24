<template>
  <div>
    <select v-model="selectedAlgorithm">
      <option value="nearestNeighbor">Nearest Neighbor</option>
      <option value="bilinear">Bilinear Interpolation</option>
    </select>
    <div ref="dropArea" 
         @click="selectFile" 
         @drop="handleDrop" 
         @dragover.prevent 
         @dragenter.prevent 
         class="drop-area">
      Przeciągnij obraz tutaj lub kliknij, aby wybrać
    </div>
    <input type="file" ref="fileInput" @change="handleFileChange" style="display: none" />
    <canvas v-if="newWidth && newHeight" ref="canvas" :width="newWidth" :height="newHeight"></canvas>
  </div>
</template>


<script>
export default {
  data() {
    return {
      selectedAlgorithm: "nearestNeighbor",
      newWidth: null, 
      newHeight: null,
    };
  },
  methods: {
    async handleDrop(event) {
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      this.processImage(file);
    },
    selectFile() {
      this.$refs.fileInput.click();
    },
    handleFileChange(event) {
      const file = event.target.files[0];
      this.processImage(file);
    },
    async processImage(file) {
      if (file && file.type.startsWith("image/")) {
        const image = await this.createImageFromFile(file);
        
        this.newWidth = image.width * 2;
        this.newHeight = image.height * 2;

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