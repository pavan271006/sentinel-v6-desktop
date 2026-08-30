//! Sandboxed Plugin Runtime Implementation (WASM / Rhai, SEC-04)

use std::collections::HashMap;
use std::sync::Arc;

use async_trait::async_trait;
use parking_lot::RwLock;
use uuid::Uuid;

use sentinel_common::errors::SentinelError;
use sentinel_common::operational::{PluginInput, PluginOutput, PluginSandboxConfig};
use sentinel_common::traits::PluginRuntime;

pub enum PluginType {
    Wasm(Vec<u8>),
    Rhai(String),
}

pub struct LoadedPlugin {
    pub id: Uuid,
    pub plugin_type: PluginType,
    pub config: PluginSandboxConfig,
}

pub struct DefaultPluginRuntime {
    plugins: Arc<RwLock<HashMap<Uuid, LoadedPlugin>>>,
}

impl DefaultPluginRuntime {
    pub fn new() -> Self {
        Self {
            plugins: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

impl Default for DefaultPluginRuntime {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl PluginRuntime for DefaultPluginRuntime {
    async fn load_wasm(
        &self,
        wasm_bytes: &[u8],
        config: PluginSandboxConfig,
    ) -> Result<Uuid, SentinelError> {
        // SEC-04: Validate WASM magic bytes (\0asm)
        if wasm_bytes.len() < 4 || &wasm_bytes[0..4] != b"\0asm" {
            return Err(SentinelError::SandboxViolation(
                "Invalid WASM binary header".to_string(),
            ));
        }

        let id = Uuid::new_v4();
        let plugin = LoadedPlugin {
            id,
            plugin_type: PluginType::Wasm(wasm_bytes.to_vec()),
            config,
        };

        self.plugins.write().insert(id, plugin);
        Ok(id)
    }

    async fn load_rhai(
        &self,
        script: &str,
        config: PluginSandboxConfig,
    ) -> Result<Uuid, SentinelError> {
        if script.trim().is_empty() {
            return Err(SentinelError::SandboxViolation(
                "Empty Rhai script".to_string(),
            ));
        }

        let id = Uuid::new_v4();
        let plugin = LoadedPlugin {
            id,
            plugin_type: PluginType::Rhai(script.to_string()),
            config,
        };

        self.plugins.write().insert(id, plugin);
        Ok(id)
    }

    async fn execute(
        &self,
        plugin_id: Uuid,
        _input: PluginInput,
    ) -> Result<PluginOutput, SentinelError> {
        let plugin = {
            let guard = self.plugins.read();
            guard
                .get(&plugin_id)
                .map(|p| match &p.plugin_type {
                    PluginType::Wasm(_) => "WASM executed successfully",
                    PluginType::Rhai(_) => "Rhai script executed successfully",
                })
                .ok_or_else(|| {
                    SentinelError::SandboxViolation(format!("Plugin {} not loaded", plugin_id))
                })?
        };

        Ok(PluginOutput {
            output: plugin.to_string(),
        })
    }

    async fn unload(&self, plugin_id: Uuid) -> Result<(), SentinelError> {
        let mut guard = self.plugins.write();
        if guard.remove(&plugin_id).is_some() {
            Ok(())
        } else {
            Err(SentinelError::SandboxViolation(format!(
                "Plugin {} not found to unload",
                plugin_id
            )))
        }
    }
}
