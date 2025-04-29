# Bucket CLI

Command-line interface for interacting with Bucket services. The CLI allows you to manage apps,
features, authentication, and generate TypeScript types for your Bucket features. With this tool,
you can streamline your feature flagging workflow directly from your terminal.

## Usage

Get started by installing the CLI locally in your project:

```bash
# npm
npm install --save-dev @bucketco/cli

# yarn
yarn add --dev @bucketco/cli
```

Then running the `new` command from your project's root directory,
initializing the CLI, creating a feature, and generating the types all at once:

```bash
# npm
npx bucket new

# yarn
yarn bucket new
```

### Individual commands

Instead of running `new` you can call each step individually.

```bash
# Initialize Bucket in your project (if not already setup)
npx bucket init

# Create a new feature
npx bucket features create "My Feature"

# Generate TypeScript types for your features
npx bucket features types
```

## Configuration

The CLI creates a `bucket.config.json` file in your project directory when you run `bucket init`.
This file contains all the necessary settings for your Bucket integration.

### Configuration File Structure

Here's a comprehensive list of configuration options available in the `bucket.config.json` file:

```json
{
  "$schema": "https://unpkg.com/@bucketco/cli@latest/schema.json",
  "baseUrl": "https://app.bucket.co",
  "apiUrl": "https://app.bucket.co/api",
  "appId": "ap123456789",
  "typesOutput": [
    {
      "path": "gen/features.d.ts",
      "format": "react"
    }
  ]
}
```

| Option        | Description                                                                                                                                                          | Default                                              |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `$schema`     | Autocompletion for the config. `latest` can be replaced with a specific version.                                                                                     | "https://unpkg.com/@bucketco/cli@latest/schema.json" |
| `baseUrl`     | Base URL for Bucket services.                                                                                                                                        | "https://app.bucket.co"                              |
| `apiUrl`      | API URL for Bucket services (overrides baseUrl for API calls).                                                                                                       | "https://app.bucket.co/api"                          |
| `appId`       | Your Bucket application ID.                                                                                                                                          | Required                                             |
| `typesOutput` | Path(s) where TypeScript types will be generated. Can be a string or an array of objects with `path` and `format` properties. Available formats: `react` and `node`. | "gen/features.ts" with format "react"                |

You can override these settings using command-line options for individual commands.

## Commands

### `bucket init`

Initialize a new Bucket configuration in your project.
This creates a `bucket.config.json` file with your settings and prompts for any required information not provided via options.

```bash
npx bucket init [--overwrite]
```

Options:

- `--overwrite`: Overwrite existing configuration file if one exists.
- `--app-id <id>`: Set the application ID.
- `--key-format <format>`: Set the key format for features.

### `bucket new [featureName]`

All-in-one command to get started quickly. This command combines `init`, feature creation,
and type generation in a single step. Use this for the fastest way to get up and running with Bucket.

```bash
npx bucket new "My Feature" [--app-id ap123456789] [--key my-feature]  [--key-format custom] [--out gen/features.ts] [--format react]
```

Options:

- `--key`: Specific key for the feature.
- `--app-id`: App ID to use.
- `--key-format`: Format for feature keys (custom, snake, camel, etc.).
- `--out`: Path to generate TypeScript types.
- `--format`: Format of the generated types (react or node).

If you prefer more control over each step, you can use the individual commands (`init`, `features create`, `features types`) instead.

### `bucket login`

Log in to your Bucket account. This will authenticate your CLI for subsequent operations and store credentials securely.

```bash
npx bucket login
```

### `bucket logout`

Log out from your Bucket account, removing stored credentials.

```bash
npx bucket logout
```

### `bucket features`

Manage your Bucket features with the following subcommands.

#### `bucket features create [featureName]`

Create a new feature in your Bucket app.
The command guides you through the feature creation process with interactive prompts if options are not provided.

```bash
npx bucket features create "My Feature" [--app-id ap123456789] [--key my-feature] [--key-format custom]
```

Options:

- `--key`: Specific key for the feature.
- `--app-id`: App ID to use.
- `--key-format`: Format for feature keys.

#### `bucket features list`

List all features for the current app.
This helps you visualize what features are available and their current configurations.

```bash
npx bucket features list [--app-id ap123456789]
```

Options:

- `--app-id`: App ID to use.

#### `bucket features types`

Generate TypeScript types for your features.
This ensures type safety when using Bucket features in your TypeScript/JavaScript applications.

```bash
npx bucket features types [--app-id ap123456789] [--out gen/features.ts] [--format react]
```

Options:

- `--app-id`: App ID to use.
- `--out`: Path to generate TypeScript types.
- `--format`: Format of the generated types (react or node).

### `bucket companies`

Commands for managing companies.

#### `bucket companies list`

List all companies in your app.

```bash
npx bucket companies list [--filter <text>] [--app-id ap123456789]
```

Options:

- `--filter`: Filter companies by name or ID.
- `--app-id`: App ID to use.

The command outputs a table with the following columns:

- `id`: Company ID.
- `name`: Company name (shows "(unnamed)" if not set).
- `users`: Number of users in the company.
- `lastSeen`: Date when the company was last active.

### `bucket companies features access`

Grant or revoke access to specific features for companies, segments, and users.
If no feature key is provided, you'll be prompted to select one from a list.

```bash
npx bucket companies features access [--app-id ap123456789] [featureKey] [--enable|--disable] [--companies <id...>] [--segments <id...>] [--users <id...>]
```

Arguments:

- `featureKey`: Key of the feature to grant/revoke access to (optional, interactive selection if omitted).

Options:

- `--enable`: Enable the feature for the specified targets.
- `--disable`: Disable the feature for the specified targets.
- `--users`: User IDs to target. Can be specified multiple times.
- `--companies`: Company IDs to target. Can be specified multiple times.
- `--segments`: Segment IDs to target. Can be specified multiple times.
- `--app-id`: App ID to use.

At least one target (companies, segments, or users) must be specified. You must also specify either `--enable` or `--disable`, but not both.

Example:

```bash
# Enable feature for multiple companies and users
npx bucket companies features access my-feature --enable --companies comp_123 --companies comp_456 --users user_789
```

### `bucket apps`

Commands for managing Bucket apps.

## Global Options

These options can be used with any command:

- `--debug`: Enable debug mode for verbose output.
- `--base-url <url>`: Set the base URL for Bucket API.
- `--api-url <url>`: Set the API URL directly (overrides base URL).
- `--help`: Display help information for a command.

## AI-Assisted Development

Bucket provides powerful AI-assisted development capabilities through rules and Model Context Protocol (MCP). These features help your AI development tools better understand your features and provide more accurate assistance.

### Bucket Rules (Recommended)

The `rules` command helps you set up AI-specific rules for your project. These rules enable AI tools to better understand how to work with Bucket and feature flags and how they should be used in your codebase.

```bash
npx bucket rules [--format <cursor|copilot>] [--yes]
```

Options:

- `--format`: Format to add rules in:
  - `cursor`: Adds rules to `.cursor/rules/bucket.mdc` for Cursor IDE integration.
  - `copilot`: Adds rules to `.github/copilot-instructions.md` for GitHub Copilot integration.
- `--yes`: Skip confirmation prompts and overwrite existing files without asking.

This command will add rules to your project that provide AI tools with context about how to setup and use Bucket feature flags. For the copilot format, the rules will be added to a dedicated section in the file, allowing you to maintain other copilot instructions alongside Bucket's rules.

## Model Context Protocol

The Model Context Protocol (MCP) is an open protocol that provides a standardized way to connect AI models to different data sources and tools. In the context of Bucket, MCP enables your development environment to understand your feature flags, their states, and their relationships within your codebase. This creates a seamless bridge between your feature management workflow and AI-powered development tools.

_**Note: The Bucket MCP server is now remote hosted and the `mcp` command has been repurposed to help you connect to the new server.**_

### Setting up MCP

The `mcp` command helps you configure your editor or AI client to connect with Bucket's remote MCP server. This allows your AI tools to understand your feature flags and provide more contextual assistance.

```bash
npx bucket mcp [--app-id <id>] [--editor <editor>] [--scope <local|global>]
```

Options:

- `--app-id`: App ID to use for the MCP connection.
- `--editor`: The editor/client to configure:
  - `cursor`: [Cursor IDE](https://www.cursor.com/)
  - `vscode`: [Visual Studio Code](https://code.visualstudio.com/)
  - `claude`: [Claude Desktop](https://claude.ai/download)
  - `windsurf`: [Windsurf](https://windsurf.com/editor)
- `--scope`: Whether to configure settings globally or locally for the project.

The command will guide you through:

1. Selecting which editor/client to configure.
2. Choosing which Bucket app to connect to.
3. Deciding between global or project-local configuration.
4. Setting up the appropriate configuration file for your chosen editor .

_**Note: The setup uses [mcp-remote](https://github.com/geelen/mcp-remote) as a compatibility layer allowing the remote hosted Bucket MCP server to work with all editors/clients that support MCP STDIO servers. If your editor/client supports HTTP Streaming with OAuth you can connect to the Bucket MCP server directly.**_

## Development

```bash
# Build the CLI
yarn build

# Run the CLI locally
yarn bucket [command]

# Lint and format code
yarn lint
yarn format
```

## Requirements

- Node.js >=18.0.0

## License

> MIT License
> Copyright (c) 2025 Bucket ApS
