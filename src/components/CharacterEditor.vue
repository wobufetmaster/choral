<template>
  <div v-if="isOpen || tabData" :class="[tabData ? 'tab-editor' : 'modal-overlay']" @click.self="!tabData && close()">
    <div :class="[tabData ? 'tab-content-wrapper' : 'modal-content', 'character-editor']">
      <div :class="tabData ? 'tab-header' : 'modal-header'">
        <h2>{{ isEditMode ? 'Edit Character' : 'Create Character' }}</h2>
        <button v-if="!tabData" @click="close" class="close-btn">&times;</button>
        <button v-else @click="save" class="save-btn" :disabled="!isValid">
          {{ isEditMode ? 'Save Changes' : 'Create Character' }}
        </button>
      </div>

      <div :class="tabData ? 'tab-body' : 'modal-body'">
        <div class="editor-grid">
          <!-- Left Column: Image -->
          <div class="image-section">
            <div class="image-preview" @click="triggerImageUpload">
              <img v-if="imagePreview" :src="imagePreview" alt="Character preview" />
              <div v-else class="image-placeholder">
                <span>Click to upload image</span>
              </div>
            </div>
            <input
              ref="imageInput"
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              @change="handleImageUpload"
              style="display: none"
            />
            <button @click="triggerImageUpload" class="upload-btn">
              {{ imagePreview ? 'Change Image' : 'Upload Image' }}
            </button>
          </div>

          <!-- Right Column: Form Fields -->
          <div class="form-section">
            <div class="form-group">
              <label>Name *</label>
              <input v-model="editedCard.data.name" type="text" required />
              <div v-if="hasProblematicCharsInName" class="filename-warning">
                ⚠️ Name contains special characters (" ' : < > ? * | / \) that will be removed or replaced for cross-platform compatibility.
                <br>
                <small>Filename will be: <strong>{{ sanitizedFilename }}</strong></small>
              </div>
            </div>

            <div class="form-group">
              <label>Nickname (optional)</label>
              <input v-model="editedCard.data.nickname" type="text" />
            </div>

            <div class="form-group">
              <label>Description *</label>
              <textarea v-model="editedCard.data.description" @input="autoExpand" rows="4" required></textarea>
            </div>

            <div class="form-group">
              <label>Personality</label>
              <textarea v-model="editedCard.data.personality" @input="autoExpand" rows="3"></textarea>
            </div>

            <div class="form-group">
              <label>Scenario</label>
              <textarea v-model="editedCard.data.scenario" @input="autoExpand" rows="3"></textarea>
            </div>

            <div class="form-group">
              <label>First Message *</label>
              <textarea v-model="editedCard.data.first_mes" @input="autoExpand" rows="4" required></textarea>
            </div>

            <div class="form-group">
              <label>Alternate Greetings</label>
              <div v-for="(greeting, index) in editedCard.data.alternate_greetings" :key="index" class="greeting-item">
                <textarea v-model="editedCard.data.alternate_greetings[index]" @input="autoExpand" rows="2"></textarea>
                <button @click="removeGreeting(index)" class="remove-btn">Remove</button>
              </div>
              <button @click="addGreeting" class="add-btn">+ Add Greeting</button>
            </div>

            <div class="form-group">
              <label>Example Dialogue</label>
              <small>Example conversations to help guide the AI's responses. Use <code v-pre>{{char}}</code> and <code v-pre>{{user}}</code> placeholders.</small>
              <textarea v-model="editedCard.data.mes_example" @input="autoExpand" rows="6" placeholder="<START>&#10;{{user}}: Hello!&#10;{{char}}: *waves enthusiastically* Hi there!&#10;&#10;<START>&#10;{{user}}: How are you?&#10;{{char}}: I'm doing great, thanks for asking!"></textarea>
            </div>

            <div class="form-group">
              <label>System Prompt</label>
              <textarea v-model="editedCard.data.system_prompt" @input="autoExpand" rows="3"></textarea>
            </div>

            <div class="form-group">
              <label>Post History Instructions</label>
              <textarea v-model="editedCard.data.post_history_instructions" @input="autoExpand" rows="3"></textarea>
            </div>

            <div class="form-group">
              <label>Tags</label>
              <div class="tag-input-container">
                <div class="current-tags">
                  <span v-for="(tag, index) in editedCard.data.tags" :key="index" class="tag-chip">
                    {{ tag }}
                    <button @click="removeTag(index)" class="remove-tag">×</button>
                  </span>
                </div>
                <input
                  v-model="newTag"
                  @keydown.enter.prevent="addTag"
                  @input="updateTagSuggestions"
                  placeholder="Add tag (press Enter)"
                  class="tag-input"
                />
                <div v-if="tagSuggestions.length > 0" class="tag-suggestions">
                  <div
                    v-for="suggestion in tagSuggestions"
                    :key="suggestion"
                    @click="addSuggestedTag(suggestion)"
                    class="tag-suggestion"
                  >
                    {{ suggestion }}
                  </div>
                </div>
              </div>
            </div>

            <div class="form-group">
              <label>Creator</label>
              <input v-model="editedCard.data.creator" type="text" />
            </div>

            <div class="form-group">
              <label>Character Version</label>
              <input v-model="editedCard.data.character_version" type="text" />
            </div>
          </div>
        </div>
      </div>

      <div v-if="!tabData" class="modal-footer">
        <button @click="close" class="cancel-btn">Cancel</button>
        <button @click="save" class="save-btn" :disabled="!isValid">
          {{ isEditMode ? 'Save Changes' : 'Create Character' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useNotification } from '../composables/useNotification'
import { useApi } from '../composables/useApi'

const { notify } = useNotification()
const api = useApi()

const props = defineProps({
  isOpen: Boolean,
  character: Object, // If provided, edit mode; otherwise create mode
  tabData: Object // If provided, tab mode; otherwise modal mode
})

const emit = defineEmits(['close', 'save', 'update-tab', 'open-tab'])

const imageInput = ref(null)
const imagePreview = ref('')
const imageFile = ref(null)
const tagsString = ref('')
const newTag = ref('')
const tagSuggestions = ref([])
const allCharacterTags = ref([])
const hasUnsavedChanges = ref(false)
const originalCardState = ref(null)

const editedCard = ref({
  spec: 'chara_card_v3',
  spec_version: '3.0',
  data: {
    name: '',
    nickname: '',
    description: '',
    personality: '',
    scenario: '',
    first_mes: '',
    mes_example: '',
    system_prompt: '',
    post_history_instructions: '',
    alternate_greetings: [],
    tags: [],
    creator: '',
    character_version: '',
    extensions: {}
  }
})

const isEditMode = computed(() => !!(props.character || props.tabData?.character))

const isValid = computed(() => {
  return editedCard.value.data.name.trim() !== '' &&
         editedCard.value.data.description.trim() !== '' &&
         editedCard.value.data.first_mes.trim() !== ''
})

// Check if character name has problematic characters for filename
const hasProblematicCharsInName = computed(() => {
  const problematicChars = /["':<>?*|\/\\]/
  return problematicChars.test(editedCard.value.data.name)
})

// Show what the sanitized filename will be
const sanitizedFilename = computed(() => {
  let name = editedCard.value.data.name

  name = name
    .replace(/"/g, '')
    .replace(/'/g, '')
    .replace(/:/g, '-')
    .replace(/[<>]/g, '')
    .replace(/[?*|]/g, '')
    .replace(/[\/\\]/g, '-')
    .trim()

  if (!name) {
    name = 'character'
  }

  return name + '.png'
})

// Watch for character prop changes (when opening in edit mode)
watch(() => props.character, (newChar) => {
  if (newChar) {
    // Use the character's data card structure
    if (newChar.data) {
      editedCard.value = {
        spec: newChar.spec || 'chara_card_v3',
        spec_version: newChar.spec_version || '3.0',
        data: {
          name: newChar.data.name || '',
          nickname: newChar.data.nickname || '',
          description: newChar.data.description || '',
          personality: newChar.data.personality || '',
          scenario: newChar.data.scenario || '',
          first_mes: newChar.data.first_mes || '',
          mes_example: newChar.data.mes_example || '',
          system_prompt: newChar.data.system_prompt || '',
          post_history_instructions: newChar.data.post_history_instructions || '',
          alternate_greetings: newChar.data.alternate_greetings || [],
          tags: Array.isArray(newChar.data.tags) ? newChar.data.tags :
                (typeof newChar.data.tags === 'string' ? newChar.data.tags.split(',').map(t => t.trim()).filter(t => t) : []),
          creator: newChar.data.creator || '',
          character_version: newChar.data.character_version || '',
          extensions: newChar.data.extensions || {}
        }
      }
    } else {
      editedCard.value = JSON.parse(JSON.stringify(newChar))
    }

    // Set image preview from character
    if (newChar.image) {
      imagePreview.value = newChar.image
    }

    // Set tags string (handle both array and string formats)
    if (editedCard.value.data.tags) {
      if (Array.isArray(editedCard.value.data.tags)) {
        tagsString.value = editedCard.value.data.tags.join(', ')
      } else if (typeof editedCard.value.data.tags === 'string') {
        tagsString.value = editedCard.value.data.tags
        // Convert string to array for consistency
        editedCard.value.data.tags = editedCard.value.data.tags
          .split(',')
          .map(tag => tag.trim())
          .filter(tag => tag.length > 0)
      } else {
        tagsString.value = ''
        editedCard.value.data.tags = []
      }
    } else {
      tagsString.value = ''
      editedCard.value.data.tags = []
    }

    // Expand all textareas to fit content
    expandAllTextareas()
  } else {
    // Reset for create mode
    resetForm()
  }
}, { immediate: true })

// Watch for modal opening/closing
watch(() => props.isOpen, (isOpen) => {
  if (isOpen && !props.character) {
    resetForm()
  }
})

// Watch for tabData changes (when opening in tab mode)
watch(() => props.tabData, (newTabData) => {
  if (!newTabData) return

  // Check if we have saved draft data or character data
  const sourceData = newTabData.draftCard || newTabData.character

  // Defensive check: If in tab mode but no character data exists, this is likely corrupted localStorage
  if (!sourceData && props.tabData) {
    console.error('[CharacterEditor] Tab opened with missing character data - likely corrupted localStorage');
    notify(
      'Failed to load character data. This tab may have corrupted data. Please close it and try again.',
      'error'
    );
    // Don't process further - leave form in default blank state so user knows something is wrong
    return;
  }

  if (sourceData) {
    // Use the character's data card structure
    if (sourceData.data) {
      editedCard.value = {
        spec: sourceData.spec || 'chara_card_v3',
        spec_version: sourceData.spec_version || '3.0',
        data: {
          name: sourceData.data.name || '',
          nickname: sourceData.data.nickname || '',
          description: sourceData.data.description || '',
          personality: sourceData.data.personality || '',
          scenario: sourceData.data.scenario || '',
          first_mes: sourceData.data.first_mes || '',
          mes_example: sourceData.data.mes_example || '',
          system_prompt: sourceData.data.system_prompt || '',
          post_history_instructions: sourceData.data.post_history_instructions || '',
          alternate_greetings: sourceData.data.alternate_greetings || [],
          tags: Array.isArray(sourceData.data.tags) ? sourceData.data.tags :
                (typeof sourceData.data.tags === 'string' ? sourceData.data.tags.split(',').map(t => t.trim()).filter(t => t) : []),
          creator: sourceData.data.creator || '',
          character_version: sourceData.data.character_version || '',
          extensions: sourceData.data.extensions || {}
        }
      }
    } else {
      editedCard.value = JSON.parse(JSON.stringify(sourceData))
    }

    // Set image preview from character or draft
    if (newTabData.draftImagePreview) {
      imagePreview.value = newTabData.draftImagePreview
    } else if (sourceData.image) {
      imagePreview.value = sourceData.image
    }

    // Set image file if available
    if (newTabData.draftImageFile) {
      imageFile.value = newTabData.draftImageFile
    }

    // Set tags string (handle both array and string formats)
    if (editedCard.value.data.tags) {
      if (Array.isArray(editedCard.value.data.tags)) {
        tagsString.value = editedCard.value.data.tags.join(', ')
      } else if (typeof editedCard.value.data.tags === 'string') {
        tagsString.value = editedCard.value.data.tags
        // Convert string to array for consistency
        editedCard.value.data.tags = editedCard.value.data.tags
          .split(',')
          .map(tag => tag.trim())
          .filter(tag => tag.length > 0)
      } else {
        tagsString.value = ''
        editedCard.value.data.tags = []
      }
    } else {
      tagsString.value = ''
      editedCard.value.data.tags = []
    }

    // Save original state for change detection
    originalCardState.value = JSON.stringify({
      card: editedCard.value,
      imagePreview: imagePreview.value
    })
    hasUnsavedChanges.value = !!newTabData.draftCard // If there's a draft, there are unsaved changes

    // Expand all textareas to fit content
    expandAllTextareas()
  }
}, { immediate: true })

function resetForm() {
  editedCard.value = {
    spec: 'chara_card_v3',
    spec_version: '3.0',
    data: {
      name: '',
      nickname: '',
      description: '',
      personality: '',
      scenario: '',
      first_mes: '',
      mes_example: '',
      system_prompt: '',
      post_history_instructions: '',
      alternate_greetings: [],
      tags: [],
      creator: '',
      character_version: '',
      extensions: {}
    }
  }
  imagePreview.value = ''
  imageFile.value = null
  tagsString.value = ''
}

function triggerImageUpload() {
  imageInput.value.click()
}

async function handleImageUpload(event) {
  const file = event.target.files[0]
  if (file) {
    // Check if it's a JPEG and convert to PNG
    if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
      try {
        const dataUrl = await convertToPNG(file)
        imagePreview.value = dataUrl

        // Convert data URL back to File object for upload
        const response = await fetch(dataUrl)
        const blob = await response.blob()
        imageFile.value = new File([blob], file.name.replace(/\.(jpg|jpeg)$/i, '.png'), { type: 'image/png' })
      } catch (error) {
        console.error('Failed to convert JPEG to PNG:', error)
        notify('Failed to convert image to PNG', 'error')
      }
    } else {
      imageFile.value = file
      const reader = new FileReader()
      reader.onload = (e) => {
        imagePreview.value = e.target.result
      }
      reader.readAsDataURL(file)
    }
  }
}

function convertToPNG(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)
        const pngDataUrl = canvas.toDataURL('image/png')
        resolve(pngDataUrl)
      }
      img.onerror = reject
      img.src = e.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function addGreeting() {
  editedCard.value.data.alternate_greetings.push('')
}

function removeGreeting(index) {
  editedCard.value.data.alternate_greetings.splice(index, 1)
}

function autoExpand(event) {
  const textarea = event.target
  const scrollContainer = textarea.closest('.tab-body, .modal-body')
  const scrollPosBefore = scrollContainer ? scrollContainer.scrollTop : 0

  // Reset height to auto to get the correct scrollHeight
  textarea.style.height = 'auto'
  // Set height to scrollHeight to fit content
  textarea.style.height = textarea.scrollHeight + 'px'

  // Restore scroll position if it changed
  if (scrollContainer) {
    scrollContainer.scrollTop = scrollPosBefore
  }
}

function expandAllTextareas() {
  nextTick(() => {
    const scrollContainer = document.querySelector('.character-editor .tab-body, .character-editor .modal-body')
    const scrollPosBefore = scrollContainer ? scrollContainer.scrollTop : 0

    const textareas = document.querySelectorAll('.character-editor textarea')
    textareas.forEach(textarea => {
      textarea.style.height = 'auto'
      textarea.style.height = textarea.scrollHeight + 'px'
    })

    // Restore scroll position after all expansions
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollPosBefore
    }
  })
}

function close() {
  emit('close')
}

async function save() {
  if (!isValid.value) return

  // Parse tags from string
  editedCard.value.data.tags = tagsString.value
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag !== '')

  // Prepare data to save
  const characterData = {
    card: editedCard.value,
    imageFile: imageFile.value,
    originalFilename: props.character?.filename || props.tabData?.character?.filename
  }

  // In tab mode, save directly to API
  if (props.tabData) {
    try {
      const formData = new FormData()

      if (imageFile.value) {
        formData.append('file', imageFile.value)
      }
      formData.append('card', JSON.stringify(editedCard.value))

      let result
      if (characterData.originalFilename) {
        // Update existing character
        result = await api.updateCharacter(characterData.originalFilename, formData)
      } else {
        // Create new character
        result = await api.saveCharacter(formData)
      }

      // Clear unsaved changes flag and update original state
      hasUnsavedChanges.value = false
      originalCardState.value = JSON.stringify({
        card: editedCard.value,
        imagePreview: imagePreview.value
      })

      // Show success notification
      notify(
        characterData.originalFilename ? 'Character saved successfully' : 'Character created successfully',
        'success'
      )

      // If it was a new character, update the tabData to have the filename and clear draft
      if (!characterData.originalFilename && result.filename) {
        emit('update-tab', {
          label: editedCard.value.data.name,
          data: {
            character: { ...editedCard.value, filename: result.filename },
            // Clear draft data since it's now saved
            draftCard: null,
            draftImagePreview: null,
            draftImageFile: null
          }
        })
      } else {
        // Just update the label and clear draft for existing characters
        emit('update-tab', {
          label: editedCard.value.data.name,
          data: {
            ...props.tabData,
            character: { ...editedCard.value, filename: characterData.originalFilename },
            // Clear draft data since it's now saved
            draftCard: null,
            draftImagePreview: null,
            draftImageFile: null
          }
        })
      }
    } catch (error) {
      console.error('Failed to save character:', error)
      notify('Failed to save character', 'error')
    }
  } else {
    // In modal mode, emit to parent
    emit('save', characterData)
  }
}

// Debounced watcher for draft saving and unsaved changes detection
let updateTimeout = null
watch([editedCard, imagePreview, imageFile], () => {
  if (!props.tabData) return

  // Clear any pending updates
  if (updateTimeout) {
    clearTimeout(updateTimeout)
  }

  // Debounce the update to avoid interfering with typing
  updateTimeout = setTimeout(() => {
    // Check if there are unsaved changes
    const currentState = JSON.stringify({
      card: editedCard.value,
      imagePreview: imagePreview.value
    })

    const hasChanges = originalCardState.value && currentState !== originalCardState.value

    if (hasChanges !== hasUnsavedChanges.value) {
      hasUnsavedChanges.value = hasChanges
    }

    const charName = editedCard.value.data.name || 'Untitled'
    const label = hasUnsavedChanges.value ? `${charName} *` : charName

    // Save the current state as a draft and update label
    emit('update-tab', {
      label,
      data: {
        ...props.tabData,
        draftCard: JSON.parse(JSON.stringify(editedCard.value)),
        draftImagePreview: imagePreview.value,
        draftImageFile: imageFile.value
      }
    })
  }, 300) // 300ms debounce
}, { deep: true })

// Load all character tags for autocomplete
async function loadAllCharacterTags() {
  try {
    const characters = await api.getCharacters()

    const tags = new Set()
    characters.forEach(char => {
      const characterTags = char.data?.tags || char.tags || []
      characterTags.forEach(tag => tags.add(tag))
    })

    allCharacterTags.value = Array.from(tags).sort()
  } catch (error) {
    console.error('Failed to load character tags:', error)
  }
}

function addTag() {
  const tag = newTag.value.trim()
  if (!editedCard.value.data.tags) {
    editedCard.value.data.tags = []
  }
  if (tag && !editedCard.value.data.tags.includes(tag)) {
    editedCard.value.data.tags = [...editedCard.value.data.tags, tag]
    newTag.value = ''
    tagSuggestions.value = []

    // Auto-save in tab mode
    if (props.tabData) {
      autoSaveTagChange()
    }
  }
}

function addSuggestedTag(tag) {
  if (!editedCard.value.data.tags) {
    editedCard.value.data.tags = []
  }
  if (!editedCard.value.data.tags.includes(tag)) {
    editedCard.value.data.tags = [...editedCard.value.data.tags, tag]
    newTag.value = ''
    tagSuggestions.value = []

    // Auto-save in tab mode
    if (props.tabData) {
      autoSaveTagChange()
    }
  }
}

function removeTag(index) {
  editedCard.value.data.tags.splice(index, 1)

  // Auto-save in tab mode
  if (props.tabData) {
    autoSaveTagChange()
  }
}

function updateTagSuggestions() {
  if (!newTag.value.trim()) {
    tagSuggestions.value = []
    return
  }

  const query = newTag.value.toLowerCase()
  const currentTags = editedCard.value.data.tags || []
  tagSuggestions.value = allCharacterTags.value
    .filter(tag =>
      tag.toLowerCase().includes(query) &&
      !currentTags.includes(tag)
    )
    .slice(0, 5)
}

async function autoSaveTagChange() {
  // Only auto-save if we have a character filename (existing character)
  if (!props.tabData?.character?.filename) {
    return
  }

  try {
    const formData = new FormData()

    if (imageFile.value) {
      formData.append('file', imageFile.value)
    }
    formData.append('card', JSON.stringify(editedCard.value))

    await api.updateCharacter(props.tabData.character.filename, formData)

    // Silently save - no notification for tag auto-save
    console.log('Tags auto-saved')
  } catch (error) {
    console.error('Failed to auto-save tags:', error)
  }
}

// Load character tags on mount
onMounted(() => {
  loadAllCharacterTags()
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: var(--bg-secondary);
  border-radius: 8px;
  max-width: 1200px;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  margin: 0;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: var(--text-primary);
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.editor-grid {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 30px;
}

.image-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.image-preview {
  width: 100%;
  aspect-ratio: 2/3;
  border: 2px dashed var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.2s;
}

.image-preview:hover {
  border-color: var(--accent-color);
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  text-align: center;
  padding: 20px;
}

.upload-btn {
  padding: 10px 20px;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.upload-btn:hover {
  opacity: 0.9;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.form-group label {
  color: var(--text-primary);
  font-weight: 500;
  font-size: 14px;
}

.form-group small {
  color: var(--text-secondary);
  font-size: 12px;
  margin-top: -2px;
}

.form-group input,
.form-group textarea {
  padding: 8px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 14px;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--accent-color);
}

.form-group textarea {
  resize: none;
  min-height: 60px;
  overflow-y: hidden;
  transition: height 0.1s ease;
}

.greeting-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.greeting-item textarea {
  flex: 1;
}

.remove-btn {
  padding: 8px 12px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
}

.remove-btn:hover {
  background: #c82333;
}

.add-btn {
  padding: 8px 16px;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  align-self: flex-start;
}

.add-btn:hover {
  opacity: 0.9;
}

.modal-footer {
  padding: 20px;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.cancel-btn,
.save-btn {
  padding: 10px 24px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.cancel-btn {
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.cancel-btn:hover {
  background: var(--border-color);
}

.save-btn {
  background: var(--accent-color);
  color: white;
}

.save-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .editor-grid {
    grid-template-columns: 1fr;
  }

  .image-section {
    max-width: 300px;
    margin: 0 auto;
  }
}

/* Tab mode styles */
.tab-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: var(--bg-primary);
}

.tab-content-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.tab-header {
  padding: 20px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-secondary);
}

.tab-header h2 {
  margin: 0;
  color: var(--text-primary);
}

.tab-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

/* Tag Input Styles */
.tag-input-container {
  position: relative;
}

.current-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.tag-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--accent-color);
  color: white !important;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
}

.remove-tag {
  background: none;
  border: none;
  color: white;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-tag:hover {
  opacity: 0.8;
}

.tag-input {
  width: 100%;
  padding: 8px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 14px;
}

.tag-input:focus {
  outline: none;
  border-color: var(--accent-color);
}

.tag-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  margin-top: 4px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 10;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.tag-suggestion {
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.tag-suggestion:hover {
  background: var(--hover-color);
}

/* Filename warning styles */
.filename-warning {
  margin-top: 8px;
  padding: 10px 12px;
  background: rgba(251, 191, 36, 0.15);
  border: 1px solid rgba(251, 191, 36, 0.4);
  border-radius: 4px;
  color: #f59e0b;
  font-size: 13px;
  line-height: 1.5;
}

.filename-warning small {
  color: rgba(251, 191, 36, 0.9);
  font-size: 12px;
  display: block;
  margin-top: 4px;
}

.filename-warning strong {
  color: #fbbf24;
  font-weight: 600;
}
</style>
