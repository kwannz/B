import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def monitor_trades(duration_minutes: int = 10):
    start_time = datetime.now()
    end_time = start_time + timedelta(minutes=duration_minutes)
    trades: List[Dict] = []
    
    while datetime.now() < end_time:
        remaining_time = (end_time - datetime.now()).total_seconds()
        logger.info(f"Time remaining: {remaining_time:.1f} seconds")
        
        with open('/home/ubuntu/full_outputs/cd_src_tradingbot_ba_partial_output_1738823575.9346783.txt', 'r') as f:
            lines = f.readlines()
            for line in lines:
                if 'Transaction' in line and 'Hash:' in line:
                    try:
                        # Extract trade number from previous lines
                        for prev_line in reversed(lines[:lines.index(line)]):
                            if '=== Executing Trade #' in prev_line:
                                trade_num = prev_line.split('#')[1].split()[0]
                                break
                        
                        tx_hash = line.split('Hash: ')[1].strip()
                        trade_info = {
                            'number': trade_num,
                            'hash': tx_hash,
                            'solscan_link': f"https://solscan.io/tx/{tx_hash}",
                            'timestamp': datetime.now().isoformat()
                        }
                        
                        # Get amount from previous lines
                        for prev_line in reversed(lines[:lines.index(line)]):
                            if 'amount_in_usd' in prev_line:
                                amount = prev_line.split('amount_in_usd')[1].split(',')[0].strip('": ')
                                trade_info['amount'] = amount
                                break
                                
                        if trade_info not in trades:
                            trades.append(trade_info)
                            logger.info(f"\nTrade #{trade_info['number']} executed:")
                            logger.info(f"Amount: ${trade_info['amount']} USD")
                            logger.info(f"Transaction Hash: {trade_info['hash']}")
                            logger.info(f"Solscan Link: {trade_info['solscan_link']}")
                    except Exception as e:
                        logger.error(f"Error parsing trade info: {str(e)}")
        
        logger.info(f"\nTotal trades executed: {len(trades)}")
        await asyncio.sleep(5)
    
    return trades

if __name__ == "__main__":
    asyncio.run(monitor_trades(10))
