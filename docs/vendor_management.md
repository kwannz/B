# Vendor Directory Management

## Go Dependencies
- Use `go mod vendor` to manage Go dependencies
- Keep vendor/ at project root
- Only commit go.mod and go.sum
- Add to .gitignore: `vendor/*` and `!vendor/modules.txt`

## Python Dependencies
- Use Python virtual environment (venv/)
- Generate requirements.txt for dependencies
- Add venv/ to .gitignore

## Version Requirements
- Go: 1.21.0 or later
- Python: 3.11.11
- MongoDB: 6.0 or later

## Setup Instructions
1. Go Setup:
```bash
go mod init tradingbot
go mod tidy
go mod vendor
```

2. Python Setup:
```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

3. Version Control:
```bash
# Add to .gitignore
vendor/*
!vendor/modules.txt
venv/
__pycache__/
```

## Offline Development
- Go dependencies are vendored in vendor/ directory
- Python dependencies listed in requirements.txt
- Regular updates required for security patches
