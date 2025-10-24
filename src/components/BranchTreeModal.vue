<template>
  <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content branch-tree-modal">
      <div class="modal-header">
        <h3>🌿 Branch Timeline</h3>
        <div class="header-actions">
          <button @click="showVisualTimeline = !showVisualTimeline" class="view-toggle-btn">
            {{ showVisualTimeline ? '📋 List View' : '🌳 Visual Timeline' }}
          </button>
          <button @click="$emit('close')" class="close-btn">✕</button>
        </div>
      </div>

      <div class="branch-tree-container">
        <div v-if="!branches || Object.keys(branches).length === 0" class="no-branches">
          <p>No branches yet. Create a branch by clicking the 🌿 button on any message.</p>
        </div>

        <!-- Visual Timeline View -->
        <div v-else-if="showVisualTimeline" class="visual-timeline">
          <div ref="mermaidContainer" class="mermaid-container"></div>
        </div>

        <!-- List View -->
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
import mermaid from 'mermaid';

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
  data() {
    return {
      showVisualTimeline: false
    };
  },
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
  watch: {
    showVisualTimeline(newVal) {
      if (newVal) {
        this.$nextTick(() => {
          this.renderMermaidDiagram();
        });
      }
    },
    show(newVal) {
      if (newVal && this.showVisualTimeline) {
        this.$nextTick(() => {
          this.renderMermaidDiagram();
        });
      }
    }
  },
  mounted() {
    // Initialize Mermaid
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        primaryColor: '#4a90e2',
        primaryTextColor: '#fff',
        primaryBorderColor: '#4a90e2',
        lineColor: '#888',
        secondaryColor: '#2d3748',
        tertiaryColor: '#1a202c'
      },
      flowchart: {
        nodeSpacing: 60,
        rankSpacing: 80,
        padding: 20,
        curve: 'basis'
      }
    });
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
    },
    async renderMermaidDiagram() {
      if (!this.$refs.mermaidContainer || !this.branches) return;

      // Generate Mermaid diagram syntax
      const mermaidSyntax = this.generateMermaidSyntax();

      // Clear container
      this.$refs.mermaidContainer.innerHTML = '';

      // Create a unique ID for this diagram
      const diagramId = `mermaid-${Date.now()}`;

      try {
        // Render the diagram
        const { svg } = await mermaid.render(diagramId, mermaidSyntax);
        this.$refs.mermaidContainer.innerHTML = svg;

        // Add click handlers to nodes
        this.$nextTick(() => {
          this.addClickHandlers();
        });
      } catch (error) {
        console.error('Failed to render Mermaid diagram:', error);
        this.$refs.mermaidContainer.innerHTML = '<p style="color: var(--text-secondary);">Failed to render timeline diagram</p>';
      }
    },
    generateMermaidSyntax() {
      // Build a tree structure (LR = Left to Right)
      let syntax = 'graph LR\n';

      // Color palette for branches (10 colors)
      const branchColors = [
        '#4a90e2', // Blue (main)
        '#48bb78', // Green
        '#ed8936', // Orange
        '#9f7aea', // Purple
        '#f56565', // Red
        '#38b2ac', // Teal
        '#f687b3', // Pink
        '#ecc94b', // Yellow
        '#4299e1', // Light Blue
        '#68d391'  // Light Green
      ];

      // Style definitions for message dots (larger)
      syntax += '    classDef messageDot fill:#666,stroke:#888,stroke-width:2px,rx:50,ry:50\n';
      syntax += '    classDef invisible fill:transparent,stroke:transparent\n';

      // Define a class for each branch color (slightly smaller branch nodes)
      branchColors.forEach((color, idx) => {
        syntax += `    classDef branchColor${idx} fill:${color},stroke:${color},stroke-width:2px,color:#fff,rx:50,ry:50\n`;
        syntax += `    classDef branchColor${idx}Current fill:${color},stroke:#fff,stroke-width:4px,color:#fff,rx:50,ry:50\n`;
      });

      // Define link styles for each branch color
      branchColors.forEach((color, idx) => {
        syntax += `    linkStyle default stroke:${color},stroke-width:2px\n`;
      });

      // Process main branch first, then child branches
      const mainBranchObj = this.branches[this.mainBranch];
      const childBranches = Object.values(this.branches).filter(b => b.id !== this.mainBranch);

      // Track link index for styling
      let linkIndex = 0;

      // Build message chain for main branch
      if (mainBranchObj) {
        const branchId = this.sanitizeNodeId(mainBranchObj.id);
        const branchName = mainBranchObj.name.replace(/"/g, '\\"');
        // Pad branch name to ensure consistent circle size (target: 10 characters)
        const paddedBranchName = branchName.padEnd(10, ' ');
        const messageCount = mainBranchObj.messages?.length || 0;
        const branchColor = branchColors[0]; // Main branch gets first color
        const colorIndex = 0;
        const isCurrent = mainBranchObj.id === this.currentBranch;

        for (let i = 0; i < messageCount; i++) {
          const msgNodeId = `${branchId}_msg_${i}`;

          if (i === 0) {
            // Use circle notation for branch label
            syntax += `    ${msgNodeId}(("${paddedBranchName}"))\n`;
            // Apply color class with current indicator if active
            if (isCurrent) {
              syntax += `    class ${msgNodeId} branchColor${colorIndex}Current\n`;
            } else {
              syntax += `    class ${msgNodeId} branchColor${colorIndex}\n`;
            }
          } else {
            syntax += `    ${msgNodeId}(( ))\n`;
            syntax += `    class ${msgNodeId} messageDot\n`;
          }

          if (i > 0) {
            const prevMsgNodeId = `${branchId}_msg_${i - 1}`;
            syntax += `    ${prevMsgNodeId} --> ${msgNodeId}\n`;
            syntax += `    linkStyle ${linkIndex} stroke:${branchColor},stroke-width:3px\n`;
            linkIndex++;
          }
        }
      }

      // Build message chains for child branches
      childBranches.forEach((branch, idx) => {
        const branchId = this.sanitizeNodeId(branch.id);
        const branchName = branch.name.replace(/"/g, '\\"');
        // Pad branch name to ensure consistent circle size (target: 10 characters)
        const paddedBranchName = branchName.padEnd(10, ' ');
        const messageCount = branch.messages?.length || 0;
        const branchPoint = branch.branchPointMessageIndex ?? 0;
        const colorIndex = (idx + 1) % branchColors.length; // Cycle through colors
        const branchColor = branchColors[colorIndex];
        const isCurrent = branch.id === this.currentBranch;

        // Calculate how many new messages this branch has (after the branch point)
        const newMessageCount = messageCount - branchPoint - 1;

        // Add branch label node
        const labelNodeId = `${branchId}_msg_0`;
        syntax += `    ${labelNodeId}(("${paddedBranchName}"))\n`;
        if (isCurrent) {
          syntax += `    class ${labelNodeId} branchColor${colorIndex}Current\n`;
        } else {
          syntax += `    class ${labelNodeId} branchColor${colorIndex}\n`;
        }

        // Add message dots for new messages only
        for (let i = 0; i < newMessageCount; i++) {
          const msgNodeId = `${branchId}_msg_${i + 1}`;
          syntax += `    ${msgNodeId}(( ))\n`;
          syntax += `    class ${msgNodeId} messageDot\n`;

          // Connect to previous node
          const prevNodeId = i === 0 ? labelNodeId : `${branchId}_msg_${i}`;
          syntax += `    ${prevNodeId} --> ${msgNodeId}\n`;
          syntax += `    linkStyle ${linkIndex} stroke:${branchColor},stroke-width:3px\n`;
          linkIndex++;
        }

        // Connect branch to parent at the branch point
        if (branch.parentBranchId) {
          const parentBranch = this.branches[branch.parentBranchId];
          const parentId = this.sanitizeNodeId(branch.parentBranchId);

          // Calculate the relative position within the parent's displayed message chain
          // If parent is main branch, use branchPoint directly
          // If parent is a child branch, need to adjust for the parent's own branch point
          let relativePosition;
          if (parentBranch.parentBranchId === null) {
            // Parent is main branch - branchPoint is absolute
            relativePosition = branchPoint;
          } else {
            // Parent is a child branch - branchPoint is in parent's message array,
            // but we need position in parent's displayed chain (after parent's branch point)
            const parentBranchPoint = parentBranch.branchPointMessageIndex ?? 0;
            relativePosition = branchPoint - parentBranchPoint;
          }

          const parentMsgNode = `${parentId}_msg_${relativePosition}`;
          syntax += `    ${parentMsgNode} -.-> ${labelNodeId}\n`;
          syntax += `    linkStyle ${linkIndex} stroke:${branchColor},stroke-width:2px,stroke-dasharray:5\n`;
          linkIndex++;
        }
      });

      return syntax;
    },
    sanitizeNodeId(branchId) {
      // Replace invalid characters for Mermaid node IDs
      return branchId.replace(/[^a-zA-Z0-9]/g, '_');
    },
    addClickHandlers() {
      if (!this.$refs.mermaidContainer) return;

      // Find all nodes in the SVG
      const nodes = this.$refs.mermaidContainer.querySelectorAll('.node');

      console.log('Found nodes:', nodes.length);

      nodes.forEach(node => {
        // Extract node ID - Mermaid uses the format "flowchart-NODEID-NUMBER"
        const nodeId = node.id || node.getAttribute('id');
        if (!nodeId) return;

        // Extract the branch ID from message node IDs (format: branchid_msg_0)
        const match = nodeId.match(/flowchart-([^-]+)_msg_(\d+)/);
        if (!match) return;

        const sanitizedBranchId = match[1];
        const messageIndex = parseInt(match[2]);

        // Only make the first message (branch label) clickable
        if (messageIndex !== 0) return;

        // Make node clickable
        node.style.cursor = 'pointer';

        // Add click handler
        node.addEventListener('click', (e) => {
          e.stopPropagation();

          console.log('Clicked node ID:', nodeId);
          console.log('Extracted sanitized branch ID:', sanitizedBranchId);

          // Find matching branch by sanitized ID
          const branch = Object.values(this.branches).find(b => {
            const branchSanitizedId = this.sanitizeNodeId(b.id);
            console.log('Comparing', branchSanitizedId, 'with', sanitizedBranchId);
            return branchSanitizedId === sanitizedBranchId;
          });

          console.log('Found branch:', branch);

          if (branch) {
            this.switchBranch(branch.id);
          }
        });

        // Add hover effect
        node.addEventListener('mouseenter', () => {
          const rect = node.querySelector('rect, polygon, circle');
          if (rect) {
            rect.style.filter = 'brightness(1.2)';
          }
        });

        node.addEventListener('mouseleave', () => {
          const rect = node.querySelector('rect, polygon, circle');
          if (rect) {
            rect.style.filter = 'brightness(1)';
          }
        });
      });
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
  max-width: 90vw;
  width: 90%;
  max-height: 85vh;
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

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.view-toggle-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.view-toggle-btn:hover {
  background: var(--hover-color);
  border-color: var(--accent-color);
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

.visual-timeline {
  display: flex;
  justify-content: flex-start;
  align-items: flex-start;
  min-height: 400px;
  padding: 20px;
  overflow: auto;
}

.mermaid-container {
  width: 100%;
  min-width: 100%;
  display: flex;
  justify-content: flex-start;
  align-items: flex-start;
}

.mermaid-container svg {
  min-width: 100%;
  height: auto;
}
</style>
