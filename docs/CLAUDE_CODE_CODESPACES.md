# 🤖 Using Claude Code with GitHub Codespaces

This guide will help you set up and use Claude Code within GitHub Codespaces for the Smart Help Desk PIO project.

## 📋 Prerequisites

1. **GitHub Account** with Codespaces enabled
2. **Anthropic API Key** for Claude Code
3. Your project pushed to a GitHub repository

## 🚀 Quick Start

### Step 1: Push Your Project to GitHub

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Smart Help Desk PIO"

# Add your GitHub repository as remote
git remote add origin https://github.com/YOUR_USERNAME/smart-help-desk-pio.git

# Push to GitHub
git push -u origin main
```

### Step 2: Create a Codespace

1. Go to your repository on GitHub
2. Click the green "Code" button
3. Select the "Codespaces" tab
4. Click "Create codespace on main"

### Step 3: Set Up Claude Code

Once your Codespace is running:

1. Open the terminal in Codespaces
2. The post-create script will automatically install Claude Code
3. Configure Claude Code with your API key:

```bash
# Set your Anthropic API key
export ANTHROPIC_API_KEY="your-api-key-here"

# Initialize Claude Code
claude-code init
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in your Codespace with:

```bash
# Claude Code
ANTHROPIC_API_KEY=your-api-key-here

# Backend
DATABASE_URL="file:./dev.db"
PORT=5000
JWT_SECRET=your-secret-key
```

### Claude Code Settings

Configure Claude Code for your project:

```bash
# Set project context
claude-code config set project.name "Smart Help Desk PIO"
claude-code config set project.language "typescript"
claude-code config set project.framework "react,express"

# Enable features
claude-code config set features.autoComplete true
claude-code config set features.codeReview true
claude-code config set features.refactoring true
```

## 🎯 Using Claude Code

### Basic Commands

```bash
# Get help with code
claude-code help "How do I implement vendor webhooks?"

# Generate code
claude-code generate "Create a webhook endpoint for JIRA"

# Review code
claude-code review backend/src/services/vendorIntegration/webhookService.ts

# Refactor code
claude-code refactor --improve-performance backend/src/services/syncService.ts

# Fix issues
claude-code fix "Type errors in syncService.ts"
```

### Integration with VS Code

Claude Code integrates with VS Code in Codespaces:

1. **Inline suggestions**: Type `// claude:` followed by your question
2. **Code completion**: Use Ctrl+Space for AI-powered completions
3. **Quick fixes**: Hover over errors for AI-suggested fixes

### Project-Specific Commands

For the Smart Help Desk PIO project:

```bash
# Generate Serbian translations
claude-code generate "Add Serbian translations for vendor integration UI"

# Implement webhook handlers
claude-code generate "Create webhook handler for ServiceNow integration"

# Review security
claude-code review --security backend/src/services/vendorIntegration/

# Optimize database queries
claude-code optimize backend/src/services/ticketService.ts
```

## 🛠️ Troubleshooting

### Claude Code Not Found

If Claude Code isn't installed:

```bash
npm install -g @anthropic-ai/claude-code
```

### API Key Issues

```bash
# Check if API key is set
echo $ANTHROPIC_API_KEY

# Set API key
export ANTHROPIC_API_KEY="sk-ant-..."

# Persist API key
echo 'export ANTHROPIC_API_KEY="sk-ant-..."' >> ~/.bashrc
source ~/.bashrc
```

### Connection Issues

```bash
# Test Claude Code connection
claude-code test

# Check logs
claude-code logs --tail 50
```

## 📝 Best Practices

1. **Context Management**
   - Keep conversations focused on specific tasks
   - Use `claude-code context clear` to reset when switching tasks

2. **Code Generation**
   - Always review generated code
   - Test thoroughly before committing
   - Use `--dry-run` flag to preview changes

3. **Security**
   - Never commit API keys
   - Use Codespaces secrets for sensitive data
   - Review security implications of generated code

## 🔗 Useful Resources

- [Claude Code Documentation](https://docs.anthropic.com/claude-code)
- [GitHub Codespaces Guide](https://docs.github.com/codespaces)
- [Project README](../README.md)

## 💡 Tips for Smart Help Desk Development

1. **Vendor Integration**: Use Claude Code to generate vendor-specific adapters
2. **Serbian Localization**: Ask Claude to ensure all strings are properly localized
3. **Type Safety**: Use `claude-code types` to generate TypeScript interfaces
4. **Testing**: Generate test cases with `claude-code test generate`

## 🎉 Ready to Code!

Your Codespace is now configured with Claude Code. Start the application:

```bash
./start-dev.sh
```

Then use Claude Code to help with development:

```bash
claude-code help "What's the next vendor integration task?"
``` 