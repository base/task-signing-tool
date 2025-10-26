# Base Task Signing Tool

A web-based tool for managing and signing blockchain deployment tasks. This tool provides a user-friendly interface for reviewing, signing, and executing smart contract deployment tasks across multiple networks.

## Features

- 🔐 Secure task signing workflow
- 🌐 Multi-network support (mainnet, sepolia, etc.)
- 📁 Automatic task repository scanning
- 🖥️ Local development server with hot reload
- 📋 Task validation and verification

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm, yarn, pnpm, or bun

### Installation & Setup

1. **Clone the repository**

```bash
git clone https://github.com/base/task-signing-tool.git
cd task-signing-tool
```

2. **Install dependencies**

```bash
npm ci
```

3. **Run the development server**

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

4. **Open in browser**

Navigate to [http://localhost:3000](http://localhost:3000) to access the tool.

## Integration

### Integration with Task Repositories

To use this tool with a task repository like [contract-deployments](https://github.com/base/contract-deployments):

1. **Clone into task repository root**

```bash
cd /path/to/your/task-repository
git clone https://github.com/base/task-signing-tool.git
```

2. **Install and run** (follow Quick Start steps 2-4)

3. **Access tasks** - The tool will automatically detect and display tasks from your repository

## Directory Structure

### Expected Layout

Place this repository at the root of your task repository. Network folders (e.g., `mainnet`, `sepolia`) must live alongside it, and each task must be a date-prefixed folder inside a network folder.

```
root-of-your-task-repo/
├── task-signing-tool/          # This repository
│   ├── src/
│   ├── package.json
│   └── ...
├── mainnet/                    # Network folder
│   ├── 2024-01-15-task-name/  # Date-prefixed task
│   └── 2024-01-20-another-task/
├── sepolia/                    # Network folder
│   ├── 2024-01-10-test-task/
│   └── ...
└── ...
```

## Configuration

Configuration options can be set through environment variables or configuration files (to be documented based on actual implementation).

## Usage Scenarios

### Common Workflows

1. **Review pending tasks** - Browse tasks across different networks
2. **Sign tasks** - Cryptographically sign tasks for execution
3. **Validate signatures** - Verify task signatures before deployment
4. **Execute tasks** - Run signed tasks through the interface

### Best Practices

- Always review task details before signing
- Verify network configuration matches intended deployment
- Keep task folders organized with clear date prefixes
- Maintain consistent naming conventions

## Limitations

- Requires specific directory structure for task repositories
- Task folders must follow date-prefix naming convention
- Network folders must be at the root level alongside this tool
- (Additional limitations to be documented as discovered)

## Troubleshooting

### Common Issues

**Issue: Tasks not appearing in the tool**
- Verify directory structure matches expected layout
- Check that network folders are at the correct level
- Ensure task folders have date prefixes

**Issue: Development server won't start**
- Verify Node.js version (v16+ required)
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm ci`
- Check that port 3000 is not already in use

**Issue: Dependencies installation fails**
- Try using `npm install` instead of `npm ci`
- Clear npm cache: `npm cache clean --force`
- Check internet connection and npm registry access

**Note:** For additional issues not listed here, please check the [Issues](https://github.com/base/task-signing-tool/issues) page or create a new issue.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Footer

### Authors

Maintained by the Base team.

### License

This project's license information is available in the repository.

### Links

- **Main Repository:** [https://github.com/base/task-signing-tool](https://github.com/base/task-signing-tool)
- **Base Organization:** [https://github.com/base](https://github.com/base)
- **Related Projects:** [contract-deployments](https://github.com/base/contract-deployments)

---

*For questions or support, please open an issue in the repository.*
