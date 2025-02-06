from solders.hash import Hash
from solders.keypair import Keypair
from solders.transaction import VersionedTransaction

def test_verify_solders():
    """Test that solders packages can be imported correctly."""
    assert Hash is not None, "Failed to import solders.hash.Hash"
    assert Keypair is not None, "Failed to import solders.keypair.Keypair"
    assert VersionedTransaction is not None, "Failed to import solders.transaction.VersionedTransaction"
