import sys
import numpy
import torch
import sqlalchemy

def verify_installations():
    print(f"Python version: {sys.version}")
    print(f"Numpy version: {numpy.__version__}")
    print(f"PyTorch version: {torch.__version__}")
    print(f"SQLAlchemy version: {sqlalchemy.__version__}")

if __name__ == "__main__":
    verify_installations()
