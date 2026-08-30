"""
Research Engine: Observer & Attack Surface Extractor
Performs black-box endpoint discovery, parameter mapping, and method cataloging.
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field

@dataclass
class EndpointSurface:
    path: str
    method: str
    auth_required: bool = True
    parameters: List[str] = field(default_factory=list)
    body_schema: Dict[str, Any] = field(default_factory=dict)
    tags: List[str] = field(default_factory=list)

class Observer:
    """Discovers and catalogs target attack surface."""
    
    def __init__(self, client: Any):
        self.client = client
        self.surface: List[EndpointSurface] = []

    def discover_surface(self) -> List[EndpointSurface]:
        """Extracts OpenAPI documentation or scans known endpoints."""
        try:
            resp = self.client.get("/openapi.json")
            if resp.status_code == 200:
                spec = resp.json()
                paths = spec.get("paths", {})
                for path, methods in paths.items():
                    for m, details in methods.items():
                        params = [p.get("name") for p in details.get("parameters", [])]
                        self.surface.append(EndpointSurface(
                            path=path,
                            method=m.upper(),
                            parameters=params,
                            tags=details.get("tags", [])
                        ))
        except Exception:
            pass
        return self.surface
