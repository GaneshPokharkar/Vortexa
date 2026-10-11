import os
import tempfile

# Tests never touch data/waveloop.db: point the store at a throwaway file before api.store is imported.
os.environ["WAVELOOP_DB"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"
