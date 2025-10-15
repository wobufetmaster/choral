<template>
  <div v-if="show" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content debug-modal" @click.stop>
      <div class="modal-header">
        <h3>🐛 Debug Information</h3>
        <button @click="$emit('close')" class="close-button">×</button>
      </div>

      <div class="debug-modal-content">
        <div v-if="!debugData" class="no-debug-data">
          <p>No debug data available. Send a message to populate debug information.</p>
        </div>

        <div v-else-if="debugData._error" class="debug-error">
          <p><strong>⚠️ Debug data was too large to save:</strong></p>
          <p>{{ debugData._error }}</p>
          <div v-if="debugData.messageCount" class="debug-summary">
            <p>Message count: {{ debugData.messageCount }}</p>
            <p>Model: {{ debugData.model }}</p>
            <p>Estimated tokens: {{ debugData.estimatedTokens }}</p>
          </div>
        </div>

        <template v-else>
          <!-- Truncation warning -->
          <div v-if="debugData._truncated" class="truncation-warning">
            <p>⚠️ <strong>Debug data was truncated due to size.</strong> Showing last {{ debugData.messages?.length || 0 }} of {{ debugData._originalMessageCount }} messages.</p>
          </div>

          <!-- Token Usage Summary -->
          <div class="debug-section">
            <div class="section-header" @click="toggleSection('tokens')">
              <span class="expand-icon">{{ expandedSections.tokens ? '▼' : '▶' }}</span>
              <h4>📊 Token Usage & Model Settings</h4>
            </div>
            <div v-if="expandedSections.tokens" class="section-content">
              <div class="debug-grid">
                <div class="debug-row">
                  <span class="debug-label">Estimated Tokens Sent:</span>
                  <span class="debug-value">{{ debugData.estimatedTokens || 'N/A' }}</span>
                </div>
                <div class="debug-row">
                  <span class="debug-label">Model:</span>
                  <span class="debug-value">{{ debugData.model || 'N/A' }}</span>
                </div>
                <div class="debug-row">
                  <span class="debug-label">Max Tokens (Response):</span>
                  <span class="debug-value">{{ debugData.options?.max_tokens || 'N/A' }}</span>
                </div>
                <div class="debug-row">
                  <span class="debug-label">Temperature:</span>
                  <span class="debug-value">{{ debugData.options?.temperature || 'N/A' }}</span>
                </div>
                <div class="debug-row">
                  <span class="debug-label">Top P:</span>
                  <span class="debug-value">{{ debugData.options?.top_p || 'N/A' }}</span>
                </div>
                <div class="debug-row">
                  <span class="debug-label">Top K:</span>
                  <span class="debug-value">{{ debugData.options?.top_k || 'N/A' }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- System Prompts -->
          <div class="debug-section" v-if="getSystemPrompts().length > 0">
            <div class="section-header" @click="toggleSection('system')">
              <span class="expand-icon">{{ expandedSections.system ? '▼' : '▶' }}</span>
              <h4>⚙️ System Prompts ({{ getSystemPrompts().length }})</h4>
              <span class="section-hint">From preset configuration</span>
            </div>
            <div v-if="expandedSections.system" class="section-content">
              <div v-for="(msg, idx) in getSystemPrompts()" :key="idx" class="message-item">
                <div class="message-header">
                  <span class="message-index">#{{ idx + 1 }}</span>
                  <span class="message-source">From preset</span>
                </div>
                <pre class="message-content">{{ msg.content }}</pre>
              </div>
            </div>
          </div>

          <!-- Character Context -->
          <div class="debug-section" v-if="getCharacterMessages().length > 0">
            <div class="section-header" @click="toggleSection('character')">
              <span class="expand-icon">{{ expandedSections.character ? '▼' : '▶' }}</span>
              <h4>👤 Character Context ({{ getCharacterMessages().length }})</h4>
              <span class="section-hint">Description, personality, scenario</span>
            </div>
            <div v-if="expandedSections.character" class="section-content">
              <div v-for="(msg, idx) in getCharacterMessages()" :key="idx" class="message-item">
                <div class="message-header">
                  <span class="message-index">#{{ getSystemPrompts().length + idx + 1 }}</span>
                  <span class="message-source">Character card</span>
                </div>
                <div v-if="isGroupChatMergedContent(msg.content)" class="merged-characters">
                  <div v-for="(char, charIdx) in parseGroupChatCharacters(msg.content)" :key="charIdx" class="character-block">
                    <div class="character-block-header" @click="toggleCharacter(charIdx)">
                      <div class="character-header-left">
                        <span class="expand-icon">{{ isCharacterExpanded(charIdx) ? '▼' : '▶' }}</span>
                        <span class="character-name">{{ char.name }}</span>
                      </div>
                      <span class="character-badge">Character {{ charIdx + 1 }}</span>
                    </div>
                    <pre v-if="isCharacterExpanded(charIdx)" class="message-content">{{ char.content }}</pre>
                  </div>
                </div>
                <pre v-else class="message-content">{{ msg.content }}</pre>
              </div>
            </div>
          </div>

          <!-- Persona Information -->
          <div class="debug-section" v-if="hasPersonaInfo()">
            <div class="section-header" @click="toggleSection('persona')">
              <span class="expand-icon">{{ expandedSections.persona ? '▼' : '▶' }}</span>
              <h4>🧑 Persona Information</h4>
              <span class="section-hint">Active user persona</span>
            </div>
            <div v-if="expandedSections.persona" class="section-content">
              <div class="persona-info">
                <div class="debug-row">
                  <span class="debug-label">Name:</span>
                  <span class="debug-value">{{ debugData.personaName || 'User' }}</span>
                </div>
                <div class="debug-row" v-if="debugData.personaNickname">
                  <span class="debug-label">Nickname:</span>
                  <span class="debug-value">{{ debugData.personaNickname }}</span>
                </div>
                <div v-if="debugData.personaDescription" class="persona-description">
                  <strong>Description:</strong>
                  <pre class="persona-content">{{ debugData.personaDescription }}</pre>
                </div>
                <div v-if="!debugData.personaDescription && !debugData.personaNickname" class="no-persona-details">
                  <em>No additional persona details configured</em>
                </div>
              </div>
              <div class="macro-context">
                <strong>Available Macros:</strong>
                <div class="macro-grid">
                  <div class="macro-item">
                    <span class="macro-syntax" :title="getMacroValue('user')">
                      <code v-text="'{{user}}'"></code>
                    </span>
                    <div class="macro-tooltip">{{ getMacroValue('user') }}</div>
                  </div>
                  <div class="macro-item">
                    <span class="macro-syntax" :title="getMacroValue('char')">
                      <code v-text="'{{char}}'"></code>
                    </span>
                    <div class="macro-tooltip">{{ getMacroValue('char') }}</div>
                  </div>
                  <div class="macro-item" v-if="debugData.context?.charNickname">
                    <span class="macro-syntax" :title="debugData.context.charNickname">
                      <code>Character Nickname</code>
                    </span>
                    <div class="macro-tooltip">{{ debugData.context.charNickname }}</div>
                  </div>
                </div>
                <div class="macro-hint">
                  <em>Hover over a macro to see its expanded value</em>
                </div>
              </div>
            </div>
          </div>

          <!-- Lorebook Entries -->
          <div class="debug-section" v-if="hasLorebookEntries()">
            <div class="section-header" @click="toggleSection('lorebooks')">
              <span class="expand-icon">{{ expandedSections.lorebooks ? '▼' : '▶' }}</span>
              <h4>📚 Lorebook Entries ({{ getTotalLorebookEntries() }})</h4>
              <span class="section-hint">Matched and injected</span>
            </div>
            <div v-if="expandedSections.lorebooks" class="section-content">
              <div v-for="(entries, filename) in debugData.matchedEntriesByLorebook" :key="filename" class="lorebook-group">
                <div class="lorebook-header">
                  <strong>{{ filename }}</strong>
                  <span class="entry-count">{{ entries.length }} entries</span>
                </div>
                <div v-for="(entry, idx) in entries" :key="idx" class="lorebook-entry">
                  <div class="entry-header">
                    <span class="entry-name">{{ entry.name }}</span>
                    <span class="entry-priority">Priority: {{ entry.priority || 0 }}</span>
                  </div>
                  <div v-if="entry.matchedKeys && entry.matchedKeys.length > 0" class="matched-keywords">
                    <span class="keywords-label">Matched:</span>
                    <span v-for="key in entry.matchedKeys" :key="key" class="keyword-tag">{{ key }}</span>
                  </div>
                  <pre class="entry-content">{{ entry.content }}</pre>
                </div>
              </div>
            </div>
          </div>

          <!-- Tool Definitions -->
          <div class="debug-section" v-if="debugData.tools && debugData.tools.length > 0">
            <div class="section-header" @click="toggleSection('tools')">
              <span class="expand-icon">{{ expandedSections.tools ? '▼' : '▶' }}</span>
              <h4>🔧 Available Tools ({{ debugData.tools.length }})</h4>
              <span class="section-hint">Character can call these functions</span>
            </div>
            <div v-if="expandedSections.tools" class="section-content">
              <div v-for="(tool, idx) in debugData.tools" :key="idx" class="tool-item">
                <div class="tool-header">
                  <strong>{{ tool.function.name }}</strong>
                </div>
                <p class="tool-description">{{ tool.function.description }}</p>
                <div class="tool-parameters">
                  <strong>Parameters:</strong>
                  <pre>{{ JSON.stringify(tool.function.parameters, null, 2) }}</pre>
                </div>
              </div>
            </div>
          </div>

          <!-- Conversation History -->
          <div class="debug-section" v-if="getConversationHistory().length > 0">
            <div class="section-header" @click="toggleSection('history')">
              <span class="expand-icon">{{ expandedSections.history ? '▼' : '▶' }}</span>
              <h4>💬 Conversation History ({{ getConversationHistory().length }})</h4>
              <span class="section-hint">Recent messages in context</span>
            </div>
            <div v-if="expandedSections.history" class="section-content">
              <div v-for="(msg, idx) in getConversationHistory()" :key="idx" class="message-item">
                <div class="message-header">
                  <span class="message-index">#{{ getMessageIndex(idx) }}</span>
                  <span :class="['message-role', msg.role]">{{ msg.role }}</span>
                </div>
                <pre class="message-content">{{ msg.content }}</pre>
              </div>
            </div>
          </div>

          <!-- Final Message Array (After Processing) -->
          <div class="debug-section">
            <div class="section-header" @click="toggleSection('final')">
              <span class="expand-icon">{{ expandedSections.final ? '▼' : '▶' }}</span>
              <h4>📤 Final Message Array</h4>
              <span class="section-hint">After prompt processing ({{ debugData.promptProcessing || 'merge_system' }})</span>
            </div>
            <div v-if="expandedSections.final" class="section-content">
              <div class="processing-info">
                <strong>Processing Mode:</strong> {{ debugData.promptProcessing || 'merge_system' }}
              </div>
              <div class="message-summary">
                Total: {{ debugData.messages?.length || 0 }} messages
                ({{ countMessagesByRole('system') }} system,
                {{ countMessagesByRole('user') }} user,
                {{ countMessagesByRole('assistant') }} assistant)
              </div>
              <pre class="json-dump">{{ JSON.stringify(debugData.messages, null, 2) }}</pre>
            </div>
          </div>

          <!-- Raw Request Body -->
          <div class="debug-section">
            <div class="section-header" @click="toggleSection('raw')">
              <span class="expand-icon">{{ expandedSections.raw ? '▼' : '▶' }}</span>
              <h4>🔍 Raw Request Body</h4>
              <span class="section-hint">Complete API request</span>
            </div>
            <div v-if="expandedSections.raw" class="section-content">
              <pre class="json-dump">{{ JSON.stringify(debugData, null, 2) }}</pre>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DebugModal',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    debugData: {
      type: Object,
      default: null
    }
  },
  emits: ['close'],
  data() {
    return {
      expandedSections: {
        tokens: true,
        system: true,
        character: false,
        persona: false,
        lorebooks: true,
        tools: false,
        history: false,
        final: false,
        raw: false
      },
      expandedCharacters: {} // Track which character blocks are expanded (by index)
    };
  },
  methods: {
    toggleSection(section) {
      this.expandedSections[section] = !this.expandedSections[section];
    },
    toggleCharacter(index) {
      // Toggle character block expanded state
      // Use a simple toggle - if undefined, set to false (collapsed), otherwise toggle
      const currentState = this.expandedCharacters[index];
      this.expandedCharacters = {
        ...this.expandedCharacters,
        [index]: currentState === undefined ? false : !currentState
      };
    },
    isCharacterExpanded(index) {
      // Default to expanded (true) if not explicitly set
      return this.expandedCharacters[index] !== false;
    },
    getSystemPrompts() {
      if (!this.debugData?.messages) return [];
      // System prompts are at the beginning
      const messages = this.debugData.messages;
      const systemMessages = [];
      for (let i = 0; i < messages.length; i++) {
        if (messages[i].role === 'system') {
          // Check if it looks like a preset system prompt (not character context)
          const content = messages[i].content || '';
          if (!content.includes('Description:') && !content.includes('Personality:')) {
            systemMessages.push(messages[i]);
          } else {
            break; // Found character context, stop
          }
        } else {
          break; // No more system messages at the start
        }
      }
      return systemMessages;
    },
    getCharacterMessages() {
      if (!this.debugData?.messages) return [];
      const messages = this.debugData.messages;
      const characterMessages = [];
      let foundCharacterContext = false;

      for (let i = 0; i < messages.length; i++) {
        if (messages[i].role === 'system') {
          const content = messages[i].content || '';
          // Character context usually contains these markers
          if (content.includes('Description:') || content.includes('Personality:') || content.includes('Scenario:')) {
            characterMessages.push(messages[i]);
            foundCharacterContext = true;
          } else if (foundCharacterContext) {
            // Found another system message after character context, stop
            break;
          }
        } else if (foundCharacterContext) {
          break; // Found non-system message after character context
        }
      }
      return characterMessages;
    },
    getConversationHistory() {
      if (!this.debugData?.messages) return [];
      const messages = this.debugData.messages;
      const history = [];

      // Skip system messages and get user/assistant messages
      for (let i = 0; i < messages.length; i++) {
        if (messages[i].role === 'user' || messages[i].role === 'assistant') {
          history.push(messages[i]);
        }
      }
      return history;
    },
    getMessageIndex(historyIdx) {
      // Calculate the actual index in the full message array
      const systemCount = this.getSystemPrompts().length + this.getCharacterMessages().length;
      // Add lorebook entries (injected after system messages)
      const lorebookCount = this.getTotalLorebookEntries();
      return systemCount + lorebookCount + historyIdx + 1;
    },
    hasLorebookEntries() {
      return this.debugData?.matchedEntriesByLorebook &&
             Object.keys(this.debugData.matchedEntriesByLorebook).length > 0;
    },
    getTotalLorebookEntries() {
      if (!this.hasLorebookEntries()) return 0;
      return Object.values(this.debugData.matchedEntriesByLorebook)
        .reduce((sum, entries) => sum + entries.length, 0);
    },
    countMessagesByRole(role) {
      if (!this.debugData?.messages) return 0;
      return this.debugData.messages.filter(m => m.role === role).length;
    },
    hasPersonaInfo() {
      // Show persona section if we have any persona data
      return this.debugData?.personaName ||
             this.debugData?.personaNickname ||
             this.debugData?.personaDescription ||
             this.debugData?.context;
    },
    getMacroValue(macro) {
      // Get the expanded value for a macro
      if (macro === 'user') {
        return this.debugData?.context?.userName || this.debugData?.personaName || 'User';
      } else if (macro === 'char') {
        return this.debugData?.context?.charName || 'Character';
      }
      return '';
    },
    isGroupChatMergedContent(content) {
      // Check if content contains merged group chat characters
      // Format: "=== Character: Name ===\nDescription: ...\nPersonality: ...\n=== Character: Name2 ===\n..."
      if (!content) return false;

      // Look for the new separator format
      const separatorPattern = /^=== Character: .+ ===/m;

      // Check if content has character separators
      if (separatorPattern.test(content)) {
        // Count how many character blocks there are
        const matches = content.match(/^=== Character: .+ ===/gm);
        return matches && matches.length > 1;
      }

      return false;
    },
    parseGroupChatCharacters(content) {
      // Parse merged group chat content into individual character blocks
      // Format: "=== Character: Name ===\nDescription: ...\nPersonality: ...\n=== Character: Name2 ===\n..."
      if (!content) return [];

      const characters = [];

      // Split by the character separator
      const blocks = content.split(/^=== Character: /m);

      for (const block of blocks) {
        if (!block.trim()) continue;

        // Extract character name from "Name ===\n..."
        const match = block.match(/^(.+?) ===\n([\s\S]*)/);
        if (match) {
          characters.push({
            name: match[1].trim(),
            content: match[2].trim()
          });
        } else if (block.trim() && !block.includes('===')) {
          // If block doesn't have the separator format, might be trailing content
          // Only add if it contains actual character info
          if (block.includes('Description:') || block.includes('Personality:')) {
            characters.push({
              name: 'Unknown',
              content: block.trim()
            });
          }
        }
      }

      return characters.length > 0 ? characters : [{ name: 'Content', content: content }];
    }
  }
};
</script>

<style scoped>
.debug-modal {
  max-width: 1000px;
  width: 90%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.debug-modal-content {
  overflow-y: auto;
  padding: 1rem;
}

.no-debug-data {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
}

.debug-error {
  padding: 2rem;
  background: var(--bg-secondary);
  border: 2px solid #f59e0b;
  border-radius: 8px;
  margin: 1rem;
}

.debug-error strong {
  color: #f59e0b;
  font-size: 1.1rem;
}

.debug-summary {
  margin-top: 1rem;
  padding: 1rem;
  background: var(--bg-tertiary);
  border-radius: 6px;
}

.debug-summary p {
  margin: 0.5rem 0;
  font-family: monospace;
}

.truncation-warning {
  padding: 1rem;
  background: #fef3c7;
  color: #92400e;
  border: 2px solid #f59e0b;
  border-radius: 8px;
  margin: 1rem;
}

.truncation-warning strong {
  color: #b45309;
}

.debug-section {
  margin-bottom: 1rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-secondary);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  cursor: pointer;
  user-select: none;
  background: var(--bg-tertiary);
  border-radius: 8px 8px 0 0;
}

.section-header:hover {
  background: var(--hover-bg);
}

.expand-icon {
  font-size: 0.8rem;
  min-width: 1rem;
}

.section-header h4 {
  margin: 0;
  font-size: 1rem;
  flex-shrink: 0;
}

.section-hint {
  margin-left: auto;
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-style: italic;
}

.section-content {
  padding: 1rem;
}

.debug-grid {
  display: grid;
  gap: 0.5rem;
}

.debug-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem;
  background: var(--bg-primary);
  border-radius: 4px;
}

.debug-label {
  font-weight: 500;
  color: var(--text-secondary);
}

.debug-value {
  font-family: 'Courier New', monospace;
  color: var(--text-primary);
}

.message-item {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: var(--bg-primary);
  border-radius: 6px;
  border-left: 3px solid var(--primary);
}

.message-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  font-size: 0.85rem;
}

.message-index {
  font-weight: bold;
  color: var(--primary);
  font-family: monospace;
}

.message-source {
  padding: 0.2rem 0.5rem;
  background: var(--bg-tertiary);
  border-radius: 4px;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.message-role {
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-weight: 500;
  font-size: 0.8rem;
}

.message-role.system {
  background: #3b82f6;
  color: white;
}

.message-role.user {
  background: #10b981;
  color: white;
}

.message-role.assistant {
  background: #8b5cf6;
  color: white;
}

.message-content {
  margin: 0;
  padding: 0.75rem;
  background: var(--bg-tertiary);
  border-radius: 4px;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  overflow-x: auto;
  line-height: 1.5;
}

.lorebook-group {
  margin-bottom: 1.5rem;
}

.lorebook-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: var(--bg-primary);
  border-radius: 6px;
  margin-bottom: 0.75rem;
}

.entry-count {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.lorebook-entry {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: var(--bg-primary);
  border-radius: 6px;
  border-left: 3px solid #f59e0b;
}

.entry-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.entry-name {
  font-weight: 600;
  color: var(--text-primary);
}

.entry-priority {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-family: monospace;
}

.matched-keywords {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}

.keywords-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.keyword-tag {
  padding: 0.2rem 0.5rem;
  background: var(--primary);
  color: white;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
}

.entry-content {
  margin: 0;
  padding: 0.75rem;
  background: var(--bg-tertiary);
  border-radius: 4px;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  line-height: 1.5;
}

.tool-item {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: var(--bg-primary);
  border-radius: 6px;
  border-left: 3px solid #06b6d4;
}

.tool-header {
  margin-bottom: 0.5rem;
}

.tool-header strong {
  color: var(--text-primary);
  font-family: monospace;
}

.tool-description {
  margin: 0.5rem 0;
  color: var(--text-secondary);
}

.tool-parameters {
  margin-top: 0.5rem;
}

.tool-parameters strong {
  display: block;
  margin-bottom: 0.25rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.tool-parameters pre {
  margin: 0;
  padding: 0.5rem;
  background: var(--bg-tertiary);
  border-radius: 4px;
  font-size: 0.85rem;
  overflow-x: auto;
}

.processing-info {
  padding: 0.75rem;
  background: var(--bg-primary);
  border-radius: 6px;
  margin-bottom: 0.75rem;
}

.message-summary {
  padding: 0.75rem;
  background: var(--bg-primary);
  border-radius: 6px;
  margin-bottom: 0.75rem;
  font-family: monospace;
}

.json-dump {
  margin: 0;
  padding: 1rem;
  background: #1e1e1e;
  color: #d4d4d4;
  border-radius: 6px;
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
  overflow-x: auto;
  max-height: 500px;
  overflow-y: auto;
}

.persona-info {
  margin-bottom: 1.5rem;
}

.persona-description {
  margin-top: 1rem;
}

.persona-description strong {
  display: block;
  margin-bottom: 0.5rem;
  color: var(--text-secondary);
}

.persona-content {
  margin: 0;
  padding: 0.75rem;
  background: var(--bg-tertiary);
  border-radius: 4px;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  line-height: 1.5;
  overflow-x: auto;
}

.no-persona-details {
  padding: 1rem;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.macro-context {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}

.macro-context strong {
  display: block;
  margin-bottom: 0.75rem;
  color: var(--text-secondary);
}

.macro-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.macro-item {
  position: relative;
  display: inline-block;
}

.macro-syntax {
  display: inline-block;
  padding: 0.5rem 0.75rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: help;
  transition: all 0.2s;
}

.macro-syntax:hover {
  background: var(--bg-primary);
  border-color: var(--primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.macro-syntax code {
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  color: var(--primary);
  font-weight: 600;
}

.macro-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(-8px);
  padding: 0.5rem 0.75rem;
  background: var(--bg-primary);
  border: 1px solid var(--primary);
  border-radius: 6px;
  white-space: nowrap;
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
  color: var(--text-primary);
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s;
  pointer-events: none;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.macro-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: var(--primary);
}

.macro-item:hover .macro-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(-12px);
}

.macro-hint {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-style: italic;
  margin-top: 0.5rem;
}

.merged-characters {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.character-block {
  padding: 0.75rem;
  background: var(--bg-primary);
  border-radius: 6px;
  border-left: 4px solid var(--primary);
}

.character-block:nth-child(even) {
  border-left-color: #8b5cf6;
}

.character-block:nth-child(odd) {
  border-left-color: #10b981;
}

.character-block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  padding: 0.5rem;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  user-select: none;
  border-radius: 4px;
  transition: background 0.2s;
}

.character-block-header:hover {
  background: var(--hover-bg);
}

.character-header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.character-name {
  font-weight: 700;
  font-size: 1rem;
  color: var(--text-primary);
}

.character-badge {
  padding: 0.25rem 0.5rem;
  background: var(--bg-tertiary);
  border-radius: 4px;
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.character-block .message-content {
  margin: 0;
  background: var(--bg-tertiary);
}
</style>
