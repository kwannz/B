from solders.hash import Hash
from solders.keypair import Keypair
from solders.transaction import VersionedTransaction

def verify_solders():
    """Verify that solders packages can be imported correctly."""
    print("Successfully imported solders packages:")
    print("- solders.hash.Hash")
    print("- solders.keypair.Keypair")
    print("- solders.transaction.VersionedTransaction")

if __name__ == "__main__":
    verify_solders()
