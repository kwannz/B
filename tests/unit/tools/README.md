# Tools Tests

This directory contains tests for utility tools and helper functions used in the trading bot.

## Directory Structure

- `metrics/` - Tests for performance and monitoring metrics
  - Rate limiting
  - Performance metrics
  - System metrics
- `security/` - Tests for security-related tools
  - SSL verification
  - Safe tar extraction
  - Security checks
- `utils/` - Tests for utility functions
  - Caching
  - Concurrency
  - Data validation
  - Parsing
  - Proxy management

## Running Tests

To run all tool tests:
```bash
pytest tests/unit/tools
```

To run tests for a specific category:
```bash
pytest tests/unit/tools/[category]
```

## Test Coverage

The tests cover:
- Function behavior
- Error handling
- Edge cases
- Performance characteristics
- Security implications
- Resource management

## Adding New Tests

When adding new tool tests:
1. Place tests in the appropriate category directory
2. Create a new category directory if needed
3. Follow the naming convention: `test_*.py`
4. Include both positive and negative test cases
5. Document any special setup requirements
6. Consider security implications 