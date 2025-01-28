# Trading Bot System

## Project Structure
```
├── src/
│   ├── frontend/        # React/Vite frontend
│   ├── backend/         # FastAPI services
│   └── shared/          # Shared utilities
├── config/             # Configuration files
├── deploy/             # Deployment files
│   ├── docker/         # Docker configurations
│   ├── scripts/        # Deployment scripts
│   ├── config/         # Environment templates
│   └── docs/           # Documentation
└── tests/              # Test suites
    ├── unit/
    ├── integration/
    └── e2e/
```

## Quick Start
1. Clone the repository
2. Run ./deploy/scripts/deploy.sh
3. Configure environment variables
4. Access services:
   - Frontend: http://localhost:3001
   - API Gateway: http://localhost:8000
   - Monitoring: http://localhost:3000

## Development
- Frontend: React 18 with Vite
- Backend: FastAPI with PostgreSQL
- AI: DeepSeek R1 and V3 models
- Testing: PyTest and Vitest
