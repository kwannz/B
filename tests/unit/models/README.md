# Model Tests

This directory contains tests for data models and schemas used in the trading bot.

## Test Files

- `test_models.py` - Tests for database models and relationships
- `test_schemas.py` - Tests for Pydantic schemas and validation

## Test Coverage

The tests cover:
- Model initialization and validation
- Schema validation and conversion
- Relationship integrity
- Data type validation
- Default values
- Required fields
- Field constraints
- Model methods and properties

## Running Tests

To run all model tests:
```bash
pytest tests/unit/models
```

## Adding New Tests

When adding new model tests:
1. Add model tests to `test_models.py`
2. Add schema tests to `test_schemas.py`
3. Ensure comprehensive coverage of:
   - All model fields and relationships
   - All schema validations
   - Edge cases and error conditions
4. Add necessary fixtures to conftest.py
5. Follow the project's testing standards 