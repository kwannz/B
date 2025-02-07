import asyncio
import websockets
import sys

async def test_websocket(url):
    try:
        async with websockets.connect(url, ping_interval=None) as ws:
            print(f'Successfully connected to {url}')
            return True
    except Exception as e:
        print(f'Failed to connect to {url}: {e}')
        return False

async def main():
    urls = [
        'ws://localhost:8001/ws',
        'ws://localhost:8001/ws/trades'
    ]
    results = await asyncio.gather(*[test_websocket(url) for url in urls])
    if not all(results):
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())
