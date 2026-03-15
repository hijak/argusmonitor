from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "ArgusMonitor"
    debug: bool = False

    database_url: str = ""
    database_url_sync: str = ""

    redis_url: str = "redis://redis:6379/0"

    secret_key: str = "change-me-in-production-use-a-real-secret-key"
    jwt_algorithm: str = "HS256"
    jwt_expiration_minutes: int = 1440  # 24 hours

    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_base_url: str = "https://api.openai.com/v1"
    openai_app_name: str = "ArgusMonitor"
    openai_site_url: str = ""
    agent_shared_token: str = "argus-agent-dev-token"

    cors_origins: str = "http://localhost:8080,http://localhost:5173,http://frontend:8080"

    monitoring_default_interval: int = 60
    monitoring_default_timeout: int = 30
    demo_mode: bool = False

    model_config = {"env_prefix": "ARGUS_", "env_file": ".env"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
