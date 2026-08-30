# Limitations: Differential Security Engine

## Known Boundaries & Constraints
1. **Binary Non-Text Payloads**: Image/video/audio streams require perceptual hashing (pHash) rather than character-level entropy and JSON AST token extraction.
2. **Extremely Low Sample Sizes ($N < 3$)**: Welch's t-test requires at least 3 samples per population to calculate sample variance reliably.
