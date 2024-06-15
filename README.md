git clone the plugin and then npm link it to your project node_module's

example project tsconfig.json
```json
{
  "include": ["src/**/*"],
  "compilerOptions": {
    "outDir": "./dist",
    "allowJs": true,
    "baseUrl": ".",
    "moduleResolution": "Node",
    "module": "ESNext",
    "declaration": true,
    "plugins": [
      {
        "name": "ts-circular-deps"
      }
    ]
  }
}
```
