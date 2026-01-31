# Neodyme Plugins

Welcome to the Neodyme plugin ecosystem! Plugins allow you to extend your server's functionality without modifying the core codebase.

## [Neodyme Backend](https://github.com/Aorux01/Neodyme)

---

## Available Plugins

| Plugin | Version | Description |
|--------|---------|-------------|
| [Discord Integration](./discord-integration/) | 1.0.0 | Discord webhooks and bot for server management |

---

## Installing Plugins

1. Download or create your plugin folder
2. Place it in the `plugins/` directory
3. Restart the Neodyme server
4. The plugin will be automatically loaded

---

## Creating Your Own Plugin

See the [Plugin Documentation](https://github.com/Aorux01/Neodyme/wiki/Plugin) for a complete guide on creating custom plugins.

### Basic Plugin Structure

```
plugins/
  my-plugin/
    index.js      # Main plugin file (required)
    config.json   # Plugin configuration (optional)
    README.md     # Documentation (recommended)
```

### Minimal Plugin Example

```javascript
class MyPlugin {
    name = "MyPlugin";
    version = "1.0.0";
    description = "My custom plugin";

    async init(pluginManager) {
        console.log('MyPlugin loaded!');
        return true;
    }

    async shutdown() {
        console.log('MyPlugin unloaded!');
    }
}

module.exports = MyPlugin;
```

---

## Official Plugins

### Discord Integration

Full Discord integration with:
- Server start/stop webhooks
- Shop rotation notifications
- Bot commands for account management
- Role-based permission system

[View Documentation](./discord-integration/README.md)

---

## Community Plugins

Want to share your plugin? Create a pull request to add it to this list! Or contact me on Discord: @aorux01

---

## Plugin Guidelines

When creating plugins:

1. **Use descriptive names** - Make it clear what your plugin does
2. **Include documentation** - Add a README.md with setup instructions
3. **Handle errors gracefully** - Don't crash the server
4. **Clean up resources** - Implement the `shutdown()` method
5. **Follow the plugin API** - Use the provided PluginManager methods

---

## Support

- Documentation: [Wiki](https://github.com/Aorux01/Neodyme/wiki/plugin.md)
- Issues: [GitHub Issues](https://github.com/Aorux01/Neodyme/issues)
- Discord: @aorux01
