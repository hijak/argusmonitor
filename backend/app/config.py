from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "Vordr"
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
    openai_app_name: str = "Vordr"
    openai_site_url: str = ""
    agent_shared_token: str = "vordr-agent-dev-token"

    cors_origins: str = "http://localhost:8080,http://localhost:5173,http://frontend:8080"

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_starttls: bool = True

    oidc_enabled: bool = False
    oidc_default_workspace_slug: str = "default"
    oidc_redirect_base_url: str = "http://localhost:8080"
    oidc_callback_path: str = "/login/oidc/callback"

    scheduler_enabled: bool = True

    monitoring_default_interval: int = 60
    monitoring_default_timeout: int = 30
    demo_mode: bool = False
    edition_profile: str = "self_hosted"
    license_key: str = ""

    transaction_artifacts_dir: str = "/data/transactions"
    transaction_video_width: int = 640
    transaction_video_height: int = 360
    transaction_video_fps: int = 8
    transaction_screenshot_quality: int = 70

    model_config = {"env_prefix": "VORDR_", "env_file": ".env"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
