import { ref } from 'vue';
import { formatRelativeDate } from '../utils/dateFormat.js';

/**
 * Chat history management composable
 */
export function useChatHistory(api) {
  const chatHistory = ref([]);

  /**
   * Format timestamp for display
   */
  function formatDate(timestamp) {
    return formatRelativeDate(timestamp);
  }

  /**
   * Get preview text from a chat
   */
  function getPreview(chat) {
    let messages = chat.messages;

    // Handle branch-based structure
    if (chat.branches && chat.mainBranch) {
      const branch = chat.branches[chat.currentBranch || chat.mainBranch];
      messages = branch?.messages || [];
    }

    if (!messages || messages.length === 0) {
      return 'Empty chat';
    }

    // Get last message content
    const lastMsg = messages[messages.length - 1];
    let content = '';

    if (lastMsg.role === 'user') {
      content = typeof lastMsg.content === 'string'
        ? lastMsg.content
        : lastMsg.content?.find(p => p.type === 'text')?.text || '';
    } else {
      content = lastMsg.swipes?.[lastMsg.swipeIndex ?? 0] || lastMsg.content || '';
    }

    // Truncate
    const maxLength = 100;
    if (content.length > maxLength) {
      return content.substring(0, maxLength) + '...';
    }
    return content || 'No preview';
  }

  /**
   * Load chat history for a character or group
   */
  async function loadChatHistory(characterFilename, isGroupChat) {
    try {
      if (isGroupChat) {
        chatHistory.value = await api.getGroupChats();
      } else {
        const allChats = await api.getChats();
        // Filter by character if specified
        if (characterFilename) {
          chatHistory.value = allChats.filter(
            chat => chat.characterFilename === characterFilename
          );
        } else {
          chatHistory.value = allChats;
        }
      }

      // Sort by timestamp descending
      chatHistory.value.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    } catch (error) {
      console.error('Failed to load chat history:', error);
      chatHistory.value = [];
    }
  }

  /**
   * Delete a chat
   */
  async function deleteChat(filename, isGroupChat) {
    if (isGroupChat) {
      await api.deleteGroupChat(filename);
    } else {
      await api.deleteChat(filename);
    }

    // Remove from local list
    chatHistory.value = chatHistory.value.filter(c => c.filename !== filename);
  }

  return {
    chatHistory,
    formatDate,
    getPreview,
    loadChatHistory,
    deleteChat
  };
}
