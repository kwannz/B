# Trading System Architecture

## Component Overview
```mermaid
graph TB
    subgraph Data Sources
        MD[Market Data APIs]
        SM[Social Media]
        NW[News Sources]
        BC[Blockchain Data]
    end

    subgraph Agent System
        MDA[Market Data Analyst]
        VA[Valuation Agent]
        SA[Sentiment Agent]
        FA[Fundamentals Agent]
        TA[Technical Analyst]
        RM[Risk Manager]
        PM[Portfolio Manager]
    end

    subgraph Model Layer
        LM[Local Model<br/>Ollama/DeepSeek]
        RM2[Remote Model<br/>DeepSeek API]
    end

    subgraph Storage Layer
        PSQL[(PostgreSQL<br/>Structured Data)]
        MGDB[(MongoDB<br/>Unstructured Data)]
        RD[(Redis Cache)]
    end

    subgraph Monitoring
        PROM[Prometheus]
        GRAF[Grafana]
        AL[Alert Manager]
    end

    %% Data Source Connections
    MD --> MDA
    SM --> SA
    NW --> SA
    BC --> FA

    %% Agent Interactions
    MDA --> VA
    MDA --> TA
    MDA --> FA
    SA --> PM
    VA --> PM
    FA --> PM
    TA --> PM
    PM --> RM

    %% Model Usage
    SA --> LM
    SA -.-> RM2
    FA --> LM
    FA -.-> RM2

    %% Storage Usage
    MDA --> PSQL
    VA --> PSQL
    SA --> MGDB
    FA --> MGDB
    TA --> PSQL
    RM --> PSQL
    PM --> PSQL
    PM --> RD

    %% Monitoring
    LM --> PROM
    RM2 --> PROM
    PROM --> GRAF
    PROM --> AL

    classDef primary fill:#f9f,stroke:#333,stroke-width:2px
    classDef secondary fill:#bbf,stroke:#333,stroke-width:2px
    classDef storage fill:#dfd,stroke:#333,stroke-width:2px
    classDef monitoring fill:#ffd,stroke:#333,stroke-width:2px

    class MDA,VA,SA,FA,TA,RM,PM primary
    class LM,RM2 secondary
    class PSQL,MGDB,RD storage
    class PROM,GRAF,AL monitoring
```

## Data Flow Description

1. **Data Collection Layer**
   - Market Data Analyst collects real-time market data
   - Sentiment Agent gathers news and social media data
   - Fundamentals Agent retrieves on-chain and project metrics

2. **Analysis Layer**
   - Local-first model processing through Ollama/DeepSeek
   - Remote model fallback when needed
   - Each agent processes domain-specific data

3. **Decision Layer**
   - Portfolio Manager aggregates signals from all agents
   - Risk Manager validates decisions against risk parameters
   - Final trading decisions executed through order management

4. **Storage Layer**
   - PostgreSQL: Structured data (orders, positions, metrics)
   - MongoDB: Unstructured data (sentiment, analysis results)
   - Redis: Real-time caching and temporary data

5. **Monitoring Layer**
   - Prometheus tracks system metrics and model performance
   - Grafana provides visualization dashboards
   - Alert Manager handles system notifications

## Key Features

1. **Local-First Model Architecture**
   - Primary: Local Ollama/DeepSeek models
   - Fallback: Remote DeepSeek API
   - Automatic failover handling

2. **Multi-Agent Coordination**
   - Hierarchical decision making
   - Specialized analysis domains
   - Coordinated signal generation

3. **Dual Database Strategy**
   - Structured data in PostgreSQL
   - Unstructured data in MongoDB
   - High-performance caching with Redis

4. **Comprehensive Monitoring**
   - Model performance metrics
   - System health monitoring
   - Real-time alerting system
