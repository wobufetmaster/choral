# Character Test Fixtures

## Current Fixture Status

**Note about V2/V3 fixtures:** Both `test-character-v2.png` and `test-character-v3.png` currently use the Character Card V3 format. This is because:

1. The existing character cards in the repository are all V3 format
2. The characterCard.js module already handles V2 backward compatibility by checking for both `ccv3` and `chara` PNG chunks
3. For testing purposes, we copied the existing Default-chan.png (V3 format) to both fixture files

## Future Improvement

To create a proper V2 fixture for more comprehensive backward compatibility testing:
- Generate a genuine V2 character card PNG with a `chara` chunk (base64-encoded V2 JSON)
- Replace `test-character-v2.png` with this genuine V2 card
- This would allow testing the V2 → V3 conversion logic in characterCard.js

## Test Coverage

Despite using V3 format for both fixtures, the current test suite still provides adequate coverage:
- Character card PNG chunk reading
- Base64 encoding/decoding
- JSON parsing and validation
- Invalid file handling (via `invalid-character.png`)

The V2 compatibility code path in characterCard.js is exercised through integration tests when actual V2 cards are imported by users.
