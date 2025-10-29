<template>
  <div class="modal-overlay" @click="closeModal">
    <div class="modal-content image-attachment-modal" @click.stop>
      <div class="modal-header">
        <h3>Compose Message with Images</h3>
        <button @click="closeModal" class="close-button">×</button>
      </div>

      <div class="modal-body">
        <!-- Text input -->
        <div class="text-input-section">
          <label>Message:</label>
          <textarea
            v-model="messageText"
            placeholder="Type your message (optional)..."
            rows="4"
            @paste="handlePaste"
          ></textarea>
        </div>

        <!-- Image attachment controls -->
        <div class="attachment-controls">
          <button @click="triggerFilePicker" class="upload-btn">
            📁 Upload Image
          </button>
          <input
            ref="fileInput"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.gif"
            multiple
            @change="handleFileSelect"
            style="display: none"
          />
          <span class="paste-hint">or press Ctrl+V / Cmd+V to paste</span>
        </div>

        <!-- Image previews -->
        <div v-if="attachedImages.length > 0" class="image-previews">
          <div
            v-for="(img, index) in attachedImages"
            :key="index"
            class="image-preview"
          >
            <img :src="img.dataUrl" :alt="img.filename" />
            <div class="image-info">
              <span class="filename">{{ img.filename }}</span>
              <span class="filesize">{{ formatFileSize(img.size) }}</span>
            </div>
            <button @click="removeImage(index)" class="remove-btn">×</button>
          </div>
        </div>

        <!-- Warning for large files -->
        <div v-if="totalSize > 5000000" class="size-warning">
          ⚠️ Total size > 5MB. Some models may reject large images.
        </div>
      </div>

      <div class="modal-footer">
        <button @click="closeModal" class="cancel-btn">Cancel</button>
        <button
          @click="sendMessage"
          :disabled="!canSend"
          class="send-btn"
        >
          Send
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ImageAttachmentModal',
  props: {
    initialImages: {
      type: Array,
      default: () => []
    }
  },
  emits: ['close', 'send', 'update-pending'],
  data() {
    return {
      messageText: '',
      attachedImages: [...this.initialImages], // { dataUrl, filename, size, type }
    };
  },
  computed: {
    canSend() {
      return this.messageText.trim() || this.attachedImages.length > 0;
    },
    totalSize() {
      return this.attachedImages.reduce((sum, img) => sum + img.size, 0);
    },
  },
  methods: {
    triggerFilePicker() {
      this.$refs.fileInput.click();
    },

    async handleFileSelect(event) {
      const files = Array.from(event.target.files);
      for (const file of files) {
        await this.addImageFile(file);
      }
      // Reset input so same file can be selected again
      event.target.value = '';
    },

    async handlePaste(event) {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          event.preventDefault();
          const file = item.getAsFile();
          if (file) {
            await this.addImageFile(file);
          }
        }
      }
    },

    async addImageFile(file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        this.$root.$notify(`Unsupported format. Use JPG, PNG, WebP, or GIF.`, 'error');
        return;
      }

      try {
        let dataUrl = await this.readFileAsDataURL(file);

        // Calculate actual base64 size from data URL
        // The base64 string length IS the number of bytes that will be sent
        const base64String = dataUrl.split(',')[1];
        let actualSize = base64String.length; // This is the actual byte size that gets transmitted

        // Check if image exceeds 5MB (most providers' limit)
        const MAX_SIZE_MB = 5;
        const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

        console.log(`Original image base64: ${(actualSize / (1024 * 1024)).toFixed(2)}MB, file size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`);

        if (actualSize > MAX_SIZE_BYTES) {
          this.$root.$notify(`Image is ${(actualSize / (1024 * 1024)).toFixed(1)}MB. Compressing to fit 5MB limit...`, 'info');
          const compressed = await this.compressImage(dataUrl, MAX_SIZE_BYTES);
          dataUrl = compressed.dataUrl;
          actualSize = compressed.size;
          console.log(`Compressed to: ${(actualSize / (1024 * 1024)).toFixed(2)}MB`);
        }

        this.attachedImages.push({
          dataUrl,
          filename: file.name,
          size: actualSize,
          type: file.type,
        });
      } catch (error) {
        console.error('Failed to read/compress image:', error);
        this.$root.$notify(`Failed to process image: ${error.message}`, 'error');
      }
    },

    readFileAsDataURL(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    },

    async compressImage(dataUrl, maxSizeBytes) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          let result = null;

          // Try progressively smaller dimensions until we're under the limit
          // Note: PNG compression doesn't support quality parameter, so we only scale
          for (let scale = 1.0; scale >= 0.2; scale -= 0.05) {
            const scaledWidth = Math.floor(width * scale);
            const scaledHeight = Math.floor(height * scale);

            canvas.width = scaledWidth;
            canvas.height = scaledHeight;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

            const compressed = canvas.toDataURL('image/png');

            // Calculate actual base64 size (the base64 string length IS the transmitted size)
            const base64String = compressed.split(',')[1];
            const size = base64String.length;

            console.log(`Trying scale ${scale.toFixed(2)}: ${(size / (1024 * 1024)).toFixed(2)}MB`);

            if (size <= maxSizeBytes) {
              result = { dataUrl: compressed, size };
              console.log(`Success! Final size: ${(size / (1024 * 1024)).toFixed(2)}MB at ${(scale * 100).toFixed(0)}% scale`);
              break;
            }
          }

          if (result) {
            resolve(result);
          } else {
            reject(new Error('Unable to compress image below 5MB'));
          }
        };
        img.onerror = () => reject(new Error('Failed to load image for compression'));
        img.src = dataUrl;
      });
    },

    removeImage(index) {
      this.attachedImages.splice(index, 1);
    },

    formatFileSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    },

    closeModal() {
      // Save any pending images before closing
      this.$emit('update-pending', this.attachedImages);
      this.$emit('close');
    },

    sendMessage() {
      this.$emit('send', {
        text: this.messageText,
        images: this.attachedImages,
      });
    },
  },
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-secondary);
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  margin: 0;
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-secondary);
}

.close-button:hover {
  color: var(--text-primary);
}

.modal-body {
  padding: 1rem;
  overflow-y: auto;
  flex: 1;
}

.text-input-section label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.text-input-section textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: inherit;
  resize: vertical;
}

.attachment-controls {
  margin-top: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.upload-btn {
  padding: 0.5rem 1rem;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.upload-btn:hover {
  opacity: 0.9;
}

.paste-hint {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.image-previews {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.image-preview {
  position: relative;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  overflow: hidden;
}

.image-preview img {
  width: 100%;
  height: 150px;
  object-fit: cover;
  display: block;
}

.image-info {
  padding: 0.5rem;
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.filename {
  font-size: 0.8rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filesize {
  font-size: 0.7rem;
  color: var(--text-secondary);
}

.remove-btn {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-btn:hover {
  background: rgba(255, 0, 0, 0.8);
}

.size-warning {
  margin-top: 1rem;
  padding: 0.5rem;
  background: rgba(255, 165, 0, 0.1);
  border: 1px solid rgba(255, 165, 0, 0.3);
  border-radius: 4px;
  color: orange;
  font-size: 0.9rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem;
  border-top: 1px solid var(--border-color);
}

.cancel-btn,
.send-btn {
  padding: 0.5rem 1.5rem;
  border-radius: 4px;
  border: none;
  cursor: pointer;
}

.cancel-btn {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.cancel-btn:hover {
  background: var(--bg-secondary);
}

.send-btn {
  background: var(--accent-color);
  color: white;
}

.send-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
