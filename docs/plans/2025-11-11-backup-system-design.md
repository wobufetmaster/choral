# Backup System Design

**Date:** 2025-11-11
**Status:** Design Complete

## Overview

Implement an automatic backup system for Choral that periodically archives user data to prevent data loss. The system will create compressed, optionally encrypted zip archives of the `data/` directory on a configurable schedule, with retention management and manual trigger capability.

## Requirements

### What Gets Backed Up
- **User data directory** (`data/`):
  - `data/characters/*.png` - Character cards
  - `data/chats/*.json` - Chat histories
  - `data/personas/*.json` - User personas
  - `data/lorebooks/*.json` - Lorebooks
  - `data/presets/*.json` - Presets

### What Does NOT Get Backed Up
- Application code (recoverable from git)
- `config.json` (contains API keys - security risk)
- `logs/` directory (not critical user data)
- `node_modules/` (reinstallable)

### User Requirements
- Automatic periodic backups on configurable schedule
- Manual "Backup Now" button in UI
- Configurable retention (keep last N backups)
- Support for multiple backup destinations (local folder, external drive, cloud sync folder)
- Optional password encryption
- Manual restoration (no restore UI needed)

## Architecture

### Components

1. **`/server/backup.js`** - Core backup module
   - Create zip archives of `data/` directory
   - Manage encryption (optional)
   - Write to configured destination
   - Clean up old backups based on retention count

2. **API Endpoints** (in `/server/index.js`):
   - `POST /api/backup/trigger` - Trigger manual backup (async)
   - `POST /api/backup/validate-path` - Validate backup directory path

3. **Scheduler** - `node-cron` integration in `/server/index.js`
   - Run backups on user-configured interval
   - Reinitialize when config changes

4. **Settings UI** - New section in `/src/components/Settings.vue`
   - Enable/disable toggle
   - Interval dropdown
   - Retention count input
   - Directory path picker with validation
   - Optional encryption password
   - "Backup Now" button with progress feedback

5. **Configuration** - New section in `config.json`:
```json
{
  "backup": {
    "enabled": false,
    "interval": "6h",
    "retention": 10,
    "directory": "./backups",
    "encrypt": false,
    "password": ""
  }
}
```

## Implementation Details

### Backup Creation Process

1. **Trigger** (scheduled or manual)
2. **Pre-flight checks**:
   - Verify backups are enabled
   - Check if backup already in progress (lock flag)
   - Verify destination directory exists and is writable
3. **Create archive**:
   - Generate filename: `choral-backup-YYYY-MM-DD-HHmmss.zip`
   - Use `archiver` to zip entire `data/` directory
   - Preserve directory structure for easy restoration
   - If encryption enabled, use `archiver-zip-encrypted` with password from config
4. **Write to destination**:
   - Stream archive to configured directory
   - Handle write errors gracefully
5. **Cleanup old backups**:
   - List all `choral-backup-*.zip` files in destination
   - Sort by filename (timestamp ensures chronological order)
   - Delete oldest files if count > retention limit
6. **Release lock and report status**

### Scheduler Setup

**Interval Mapping:**
- `15m` → `*/15 * * * *` (every 15 minutes)
- `1h` → `0 * * * *` (every hour)
- `6h` → `0 */6 * * *` (every 6 hours)
- `12h` → `0 */12 * * *` (every 12 hours)
- `24h` → `0 0 * * *` (daily at midnight)

**Lifecycle:**
- Initialize cron job when server starts (if enabled)
- Destroy and recreate when config changes
- Gracefully stop when server shuts down

### Directory Path Validation

**Validation Endpoint:** `POST /api/backup/validate-path`

**Checks:**
1. Path is not inside `data/` directory (prevent recursive backup)
2. Path does not contain `../` (prevent path traversal)
3. If path exists:
   - Check if writable (test file creation)
   - Return success
4. If path doesn't exist:
   - Check if parent exists and is writable
   - Return "can create" status
   - Offer to create directory

**UI Flow:**
1. User clicks "Choose..." button (HTML5 directory picker)
2. Path sent to validation endpoint
3. Show appropriate feedback:
   - ✓ "Directory is writable"
   - ⚠️ "Directory doesn't exist. Create it?" [Create button]
   - ❌ "Cannot write to this directory. Choose another."
   - ❌ "Cannot backup into data directory."

### Manual Backup from UI

1. User clicks "Backup Now" button
2. Frontend calls `POST /api/backup/trigger`
3. Backend starts backup asynchronously
4. UI shows "Backup in progress..." (disable button)
5. When complete, backend returns success/error
6. UI shows result and re-enables button
7. Update "Last backup: X minutes ago" timestamp

## Configuration & Settings UI

### Settings Panel Layout

```
┌─ Backup ─────────────────────────────────────┐
│ ☑ Enable automatic backups                   │
│                                               │
│ Backup Interval: [6 hours          ▼]        │
│ Keep last: [10] backups                       │
│                                               │
│ Backup Directory:                             │
│ [/Users/sean/backups           ] [Choose...]  │
│ ✓ Directory is writable                       │
│                                               │
│ ☐ Encrypt backups                             │
│ Password: [••••••••••]                        │
│ ⚠️ Remember this password - cannot recover!   │
│                                               │
│ [Backup Now]    Last backup: 2 hours ago      │
└───────────────────────────────────────────────┘
```

### Interval Options
- 15 minutes
- 1 hour
- 6 hours (default)
- 12 hours
- 24 hours

### Constraints
- **Retention count:** 1-100 (enforced in UI and backend)
- **Password:** Minimum 8 characters if encryption enabled
- **Directory:** Must be writable, outside of `data/`

## Error Handling & Edge Cases

### Backup Errors

| Error | Handling |
|-------|----------|
| Destination doesn't exist | Create automatically if validation passed, otherwise log error |
| Insufficient disk space | Catch write error, show notification, delete partial file |
| Permission denied | Log clear error, show in UI, suggest directory change |
| Backup in progress | Prevent concurrent backups with lock flag, disable UI button |
| Data directory missing | Skip backup, log warning (edge case) |

### Configuration Errors

| Error | Handling |
|-------|----------|
| Invalid interval | Reset to default (6h), log warning |
| Invalid retention count | Clamp to 1-100 range |
| Path traversal attempt | Reject, show error in UI |
| Backup inside `data/` | Reject, show error in UI |

### Scheduler Errors

- **Scheduled backup fails:** Log error, don't crash server, retry on next interval
- **Config changes during backup:** Complete current backup, then apply new config
- **Server restart:** Resume schedule based on config, don't trigger immediate backup

## Security Considerations

### Password Encryption
- Encryption password stored in `config.json` (server-side only)
- Not exposed via API endpoints
- User responsible for remembering password
- Old backups remain encrypted with old password if changed (expected behavior)

### API Key Protection
- **Never backup `config.json`** - contains OpenRouter API key
- Only backup `data/` directory contents

### Path Security
- Validate all paths to prevent traversal attacks
- Reject paths containing `../`
- Reject paths inside critical directories (`data/`, `server/`, `src/`)

### File Permissions
- Backup files created with default Node.js permissions
- Respects system umask
- No special permission handling needed

## Manual Restoration

Since no restore UI is needed, users manually restore backups:

1. Locate desired backup in configured directory (e.g., `choral-backup-2025-11-11-143052.zip`)
2. If encrypted, unzip with password using system tool or file manager
3. Extract contents to replace `choral/data/` directory
4. Restart Choral to reload files

**Documentation needed:** Add restoration instructions to README.md

## Dependencies

### New NPM Packages
- `archiver` (^6.0.0) - Create zip archives
- `archiver-zip-encrypted` (^2.0.0) - Password encryption support
- `node-cron` (^3.0.0) - Schedule periodic tasks

All packages are stable, widely used, and actively maintained.

## Testing Strategy

### Manual Testing
1. **Basic backup creation:**
   - Enable backups, set 15m interval
   - Wait for automatic backup
   - Verify zip file created in destination
   - Extract and verify contents match `data/` directory

2. **Encryption:**
   - Enable encryption with password
   - Create backup
   - Verify cannot open without password
   - Verify can open with correct password

3. **Retention cleanup:**
   - Set retention to 3
   - Create 5 backups manually
   - Verify only newest 3 remain

4. **Path validation:**
   - Test non-existent path (should offer to create)
   - Test read-only path (should reject)
   - Test path inside `data/` (should reject)
   - Test path with `../` (should reject)

5. **Manual trigger:**
   - Click "Backup Now"
   - Verify progress indicator appears
   - Verify backup completes
   - Verify timestamp updates

6. **Config changes:**
   - Change interval while backups enabled
   - Verify new schedule takes effect
   - Disable backups, verify no more automatic backups
   - Re-enable, verify backups resume

7. **Edge cases:**
   - Very large `data/` directory (100+ characters, many chats)
   - Empty `data/` directory
   - Backup while actively chatting

### Integration Testing
- Test with Syncthing (backup directory inside synced folder)
- Test with cloud storage (Google Drive, Dropbox)
- Test with external drive (USB, network share)

## Future Enhancements (Out of Scope)

- Incremental backups (only changed files)
- Restore UI with backup browsing
- Cloud storage integration (S3, Dropbox API)
- Backup notifications (desktop, email)
- Scheduled backup reports
- Backup verification/integrity checks
- Differential backups

## Success Criteria

✅ Automatic backups run on schedule
✅ Manual backup button works
✅ Retention limit enforced
✅ Encryption works with password
✅ Path validation prevents errors
✅ Backup restoration works manually
✅ No performance impact on chat operations
✅ Clear error messages for failures
✅ Configuration persists across restarts

## Timeline Estimate

- **Core backup module:** 2-3 hours
- **API endpoints:** 1 hour
- **Scheduler integration:** 1 hour
- **Settings UI:** 2-3 hours
- **Path validation:** 1 hour
- **Testing & polish:** 2 hours

**Total:** ~10 hours of development
