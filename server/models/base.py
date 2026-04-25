"""Base model interface for DeepMCP."""

from abc import ABC, abstractmethod
from typing import Any


class BaseModel(ABC):
    """Base class for all DeepMCP inference models."""

    def __init__(self, model_id: str, config: dict[str, Any] | None = None) -> None:
        self.model_id = model_id
        self.config = config or {}
        self._loaded = False

    @property
    def loaded(self) -> bool:
        return self._loaded

    @abstractmethod
    def load(self) -> None:
        """Load model weights into memory."""
        ...

    @abstractmethod
    def predict(self, inputs: dict[str, Any]) -> dict[str, Any]:
        """Run inference and return structured results."""
        ...

    @abstractmethod
    def get_schema(self) -> dict[str, Any]:
        """Return MCP tool schema for this model."""
        ...

    def health(self) -> dict[str, str]:
        return {
            "id": self.model_id,
            "status": "online" if self._loaded else "loading",
        }
