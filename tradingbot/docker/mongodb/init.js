// Create tradingbot database
db = db.getSiblingDB('tradingbot');

// Create collections with schema validation
db.createCollection('trades', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['symbol', 'side', 'amount', 'price', 'timestamp'],
            properties: {
                symbol: { bsonType: 'string' },
                side: { enum: ['buy', 'sell'] },
                amount: { bsonType: 'double' },
                price: { bsonType: 'double' },
                timestamp: { bsonType: 'date' },
                fee: { bsonType: 'double' },
                status: { enum: ['pending', 'completed', 'failed', 'cancelled'] }
            }
        }
    }
});

db.createCollection('positions', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['symbol', 'amount', 'entry_price', 'timestamp'],
            properties: {
                symbol: { bsonType: 'string' },
                amount: { bsonType: 'double' },
                entry_price: { bsonType: 'double' },
                current_price: { bsonType: 'double' },
                unrealized_pnl: { bsonType: 'double' },
                timestamp: { bsonType: 'date' }
            }
        }
    }
});

db.createCollection('market_data', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['symbol', 'timestamp', 'data'],
            properties: {
                symbol: { bsonType: 'string' },
                timestamp: { bsonType: 'date' },
                data: {
                    bsonType: 'object',
                    required: ['open', 'high', 'low', 'close', 'volume'],
                    properties: {
                        open: { bsonType: 'double' },
                        high: { bsonType: 'double' },
                        low: { bsonType: 'double' },
                        close: { bsonType: 'double' },
                        volume: { bsonType: 'double' }
                    }
                }
            }
        }
    }
});

db.createCollection('sentiment_analysis', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['symbol', 'timestamp', 'source', 'sentiment'],
            properties: {
                symbol: { bsonType: 'string' },
                timestamp: { bsonType: 'date' },
                source: { enum: ['news', 'social', 'technical', 'deepseek'] },
                sentiment: {
                    bsonType: 'object',
                    required: ['score', 'confidence'],
                    properties: {
                        score: { bsonType: 'double' },
                        confidence: { bsonType: 'double' },
                        analysis: { bsonType: 'string' }
                    }
                }
            }
        }
    }
});

db.createCollection('strategy_performance', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['strategy_id', 'timestamp', 'metrics'],
            properties: {
                strategy_id: { bsonType: 'string' },
                timestamp: { bsonType: 'date' },
                metrics: {
                    bsonType: 'object',
                    required: ['win_rate', 'profit_factor', 'sharpe_ratio'],
                    properties: {
                        win_rate: { bsonType: 'double' },
                        profit_factor: { bsonType: 'double' },
                        sharpe_ratio: { bsonType: 'double' },
                        max_drawdown: { bsonType: 'double' }
                    }
                }
            }
        }
    }
});

// Create indexes
db.trades.createIndex({ symbol: 1, timestamp: -1 });
db.trades.createIndex({ status: 1 });

db.positions.createIndex({ symbol: 1 }, { unique: true });
db.positions.createIndex({ timestamp: -1 });

db.market_data.createIndex({ symbol: 1, timestamp: -1 });
db.market_data.createIndex({ timestamp: -1 });

db.sentiment_analysis.createIndex({ symbol: 1, timestamp: -1 });
db.sentiment_analysis.createIndex({ source: 1, timestamp: -1 });

db.strategy_performance.createIndex({ strategy_id: 1, timestamp: -1 });
db.strategy_performance.createIndex({ timestamp: -1 });

// Create users
db.createUser({
    user: 'tradingbot',
    pwd: 'tradingbot',
    roles: [
        { role: 'readWrite', db: 'tradingbot' },
        { role: 'dbAdmin', db: 'tradingbot' }
    ]
});

// Create test user for development
if (db.getSiblingDB('admin').getUser('admin') == null) {
    db.getSiblingDB('admin').createUser({
        user: 'admin',
        pwd: 'admin',
        roles: ['root']
    });
}
