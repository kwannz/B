# Core Tests

This directory contains tests for core functionality of the trading bot.

## Directory Structure

- `config/` - Tests for configuration management and project structure
  - Project structure validation
  - Setup configuration
  - Environment settings
  - Application configuration
- `conftest.py` - Core test fixtures and configuration

## Running Tests

To run all core tests:
```bash
pytest tests/unit/core
```

To run configuration tests only:
```bash
pytest tests/unit/core/config
```

## Test Configuration

The `conftest.py` file in this directory provides core test fixtures including:
- Database session mocks
- Environment setup
- Common test data
- Shared mocks and utilities

## Adding New Tests

When adding new core tests:
1. Place configuration-related tests in the `config/` directory
2. Add core functionality tests in this directory
3. Add any new fixtures to `conftest.py`
4. Follow the naming convention: `test_*.py`
