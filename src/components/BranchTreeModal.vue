<template>
  <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content branch-tree-modal">
      <div class="modal-header">
        <h3>🌿 Branch Timeline</h3>
        <button @click="$emit('close')" class="close-btn">✕</button>
      </div>

      <div class="branch-tree-container">
        <div v-if="!branches || Object.keys(branches).length === 0" class="no-branches">
          <p>No branches yet. Create a branch by clicking the 🌿 button on any message.</p>
        </div>
        <div v-else class="branch-list">
          <div
            v-for="branch in sortedBranches"
            :key="branch.id"
            :class="['branch-item', { 'active': branch.id === currentBranch, 'main': branch.id === mainBranch }]"
            @click="switchBranch(branch.id)"
          >
            <div class="branch-header">
              <div class="branch-info">
                <span class="branch-name">{{ branch.name }}</span>
                <span v-if="branch.id === mainBranch" class="badge main-badge">Main</span>
                <span v-if="branch.id === currentBranch" class="badge current-badge">Current</span>
              </div>
              <div class="branch-actions">
                <button
                  v-if="branch.id !== mainBranch"
                  @click.stop="renameBranch(branch)"
                  class="action-btn"
                  title="Rename"
                >✏️</button>
                <button
                  v-if="branch.id !== mainBranch"
                  @click.stop="deleteBranch(branch)"
                  class="action-btn delete-btn"
                  title="Delete"
                >🗑️</button>
              </div>
            </div>
            <div class="branch-meta">
              <span class="message-count">{{ branch.messages?.length || 0 }} messages</span>
              <span v-if="branch.parentBranchId" class="parent-info">
                ← from {{ getBranchName(branch.parentBranchId) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'BranchTreeModal',
  props: {
    show: Boolean,
    branches: Object,
    mainBranch: String,
    currentBranch: String,
    chatId: String
  },
  emits: ['close', 'switch-branch', 'rename-branch', 'delete-branch'],
  computed: {
    sortedBranches() {
      if (!this.branches) return [];

      // Sort branches: main first, then by creation date
      return Object.values(this.branches).sort((a, b) => {
        if (a.id === this.mainBranch) return -1;
        if (b.id === this.mainBranch) return 1;
        return new Date(a.createdAt) - new Date(b.createdAt);
      });
    }
  },
  methods: {
    getBranchName(branchId) {
      return this.branches[branchId]?.name || 'Unknown';
    },
    switchBranch(branchId) {
      if (branchId !== this.currentBranch) {
        this.$emit('switch-branch', branchId);
      }
    },
    renameBranch(branch) {
      const newName = prompt(`Rename branch "${branch.name}":`, branch.name);
      if (newName && newName.trim() && newName !== branch.name) {
        this.$emit('rename-branch', branch.id, newName.trim());
      }
    },
    deleteBranch(branch) {
      // Check for child branches
      const children = Object.values(this.branches).filter(b => b.parentBranchId === branch.id);

      let message = `Delete branch "${branch.name}"?`;
      if (children.length > 0) {
        const childNames = children.map(c => c.name).join(', ');
        message += `\n\nThis branch has ${children.length} child branch(es): ${childNames}\n\nDelete all child branches as well?`;
      }

      if (confirm(message)) {
        this.$emit('delete-branch', branch.id, children.length > 0);
      }
    }
  }
};
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
}

.modal-content {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 20px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--hover-color);
  color: var(--text-primary);
}

.branch-tree-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.no-branches {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-secondary);
}

.branch-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.branch-item {
  background: var(--bg-secondary);
  border: 2px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.branch-item:hover {
  border-color: var(--accent-color);
  background: var(--hover-color);
}

.branch-item.active {
  border-color: var(--accent-color);
  background: rgba(var(--accent-color-rgb, 100, 150, 255), 0.1);
}

.branch-item.main {
  border-left: 4px solid var(--accent-color);
}

.branch-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.branch-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.branch-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 16px;
}

.badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 500;
  text-transform: uppercase;
}

.main-badge {
  background: var(--accent-color);
  color: white;
}

.current-badge {
  background: rgba(100, 200, 100, 0.2);
  color: rgb(100, 255, 100);
  border: 1px solid rgb(100, 200, 100);
}

.branch-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--hover-color);
}

.action-btn.delete-btn:hover {
  background: rgba(255, 100, 100, 0.2);
}

.branch-meta {
  display: flex;
  gap: 12px;
  font-size: 13px;
  color: var(--text-secondary);
}

.message-count {
  font-weight: 500;
}

.parent-info {
  font-style: italic;
}
</style>
