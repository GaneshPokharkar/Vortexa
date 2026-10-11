import os
import tempfile

# Tests never touch data/waveloop.db: point the store at a throwaway file before api.store is imported.
os.environ["WAVELOOP_DB"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"
# Tests never call real providers with the developer's api/.env keys (load_dotenv won't override these).
# Tests that exercise the live path set their own fake key and stub the client.
os.environ["ANTHROPIC_API_KEY"] = ""
os.environ["ELEVENLABS_API_KEY"] = ""
