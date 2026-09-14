# Contributing to Sentinel V6 Desktop

Thank you for your interest in contributing to **Sentinel V6 Desktop**!

## Development Setup
1. Fork and clone the repository:
   ```bash
   git clone https://github.com/pavan271006/sentinel-v6-desktop.git
   cd sentinel-v6-desktop
   ```
2. Install frontend dependencies:
   ```bash
   npm install
   ```
3. Run tests:
   ```bash
   npm test
   cargo test --manifest-path sentinel_core/Cargo.toml
   ```
4. Launch development desktop build:
   ```bash
   npm run dev:desktop
   ```

## Pull Request Guidelines
- Ensure all Vitest tests pass with 0 failures.
- Maintain clean TypeScript types and Rust security invariants.
