# Bucket CLI

Command-line interface for interacting with Bucket services. The CLI allows you to manage apps,
features, authentication, and generate TypeScript types for your Bucket features. With this tool,
you can streamline your feature flagging workflow directly from your terminal.

## Quick Start

Get started quickly by running the CLI directly without installing it from your project's root directory:
initializing the CLI (if not already setup), creating a feature, and generate the types all at once.

```bash
# Initialize CLI (if not already setup), create a feature, and generate types all at once
npx @bucketco/cli new
```

or install it locally and run it using the bin alias:

```bash
# npm
npm install --save-dev @bucketco/cli

npx bucket new

# yarn
yarn add --dev @bucketco/cli

yarn bucket new
```

### Global installation

You can also install the CLI globally adding the it to your PATH allowing you to use the shorthand `bucket`,
but we recommend installing it locally instead to better maintain the version.

```bash
npm install -g @bucketco/cli

bucket <command>
```

### Individual commands

Instead of running `new` you can call each step individually.

```bash
# Initialize Bucket in your project (if not already setup)
bucket init

# Create a new feature
bucket features create "My Feature"

# Generate TypeScript types for your features
bucket features types
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
bucket init [--overwrite]
```

Options:

- `--overwrite`: Overwrite existing configuration file if one exists
- `--app-id <id>`: Set the application ID
- `--key-format <format>`: Set the key format for features

### `bucket new [featureName]`

All-in-one command to get started quickly. This command combines `init`, feature creation,
and type generation in a single step. Use this for the fastest way to get up and running with Bucket.

```bash
bucket new "My Feature" [--key my-feature] [--app-id ap123456789] [--key-format custom] [--out gen/features.ts] [--format react]
```

Options:

- `--key`: Specific key for the feature
- `--app-id`: App ID to use
- `--key-format`: Format for feature keys (custom, snake, camel, etc.)
- `--out`: Path to generate TypeScript types
- `--format`: Format of the generated types (react or node)

If you prefer more control over each step, you can use the individual commands (`init`, `features create`, `features types`) instead.

### `bucket login`

Log in to your Bucket account. This will authenticate your CLI for subsequent operations and store credentials securely.

```bash
bucket login
```

### `bucket logout`

Log out from your Bucket account, removing stored credentials.

```bash
bucket logout
```

### `bucket features`

Manage your Bucket features with the following subcommands.

#### `bucket features create [featureName]`

Create a new feature in your Bucket app.
The command guides you through the feature creation process with interactive prompts if options are not provided.

```bash
bucket features create "My Feature" [--key my-feature] [--app-id ap123456789] [--key-format custom]
```

Options:

- `--key`: Specific key for the feature
- `--app-id`: App ID to use
- `--key-format`: Format for feature keys

#### `bucket features list`

List all features for the current app.
This helps you visualize what features are available and their current configurations.

```bash
bucket features list [--app-id ap123456789]
```

Options:

- `--app-id`: App ID to use

#### `bucket features types`

Generate TypeScript types for your features.
This ensures type safety when using Bucket features in your TypeScript/JavaScript applications.

```bash
bucket features types [--app-id ap123456789] [--out gen/features.ts] [--format react]
```

Options:

- `--app-id`: App ID to use
- `--out`: Path to generate TypeScript types
- `--format`: Format of the generated types (react or node)

### `bucket apps`

Commands for managing Bucket apps.

## Global Options

These options can be used with any command:

- `--debug`: Enable debug mode for verbose output
- `--base-url <url>`: Set the base URL for Bucket API
- `--api-url <url>`: Set the API URL directly (overrides base URL)
- `--help`: Display help information for a command

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
