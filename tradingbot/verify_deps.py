import sys
import numpy
import pytest
import aiohttp
import redis
import prometheus_client

def verify_dependencies():
    print("Python version:", sys.version)
    print("NumPy version:", numpy.__version__)
    print("pytest version:", pytest.__version__)
    print("aiohttp version:", aiohttp.__version__)
    print("redis version:", redis.__version__)
    print("prometheus_client version:", getattr(prometheus_client, 'version', 'version not available'))
    print("\nVerifying GitHub access...")

if __name__ == "__main__":
    verify_dependencies()
    
    # Verify GitHub repository access
    import subprocess
    try:
        result = subprocess.run(['gh', 'repo', 'list', 'kwanRoshi', '--limit', '5'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            print("\nGitHub repository access verified:")
            print(result.stdout)
        else:
            print("\nError accessing GitHub repositories:", result.stderr)
    except Exception as e:
        print("\nError running GitHub CLI:", str(e))
