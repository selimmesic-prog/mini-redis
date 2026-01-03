# Mini-Redis MCP Server

MCP (Model Context Protocol) server that integrates Jira with Claude Code for the mini-redis development team.

## Features

| Tool | Description |
|------|-------------|
| `jira_get_ticket` | Fetch ticket details by key (MINI-123) |
| `jira_get_comments` | Get comments/discussion on a ticket |
| `jira_search` | Search tickets using JQL queries |
| `jira_my_tickets` | Get tickets assigned to you |

## Setup

### 1. Get Jira API Token

1. Go to: https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Give it a name (e.g., "Claude Code MCP")
4. Copy the token

### 2. Install Dependencies

```bash
cd mcp-server
npm install
```

### 3. Configure Claude Code

Edit `.mcp.json` in the project root with your credentials:

```json
{
  "mcpServers": {
    "jira": {
      "command": "node",
      "args": ["mcp-server/index.js"],
      "env": {
        "JIRA_HOST": "your-company.atlassian.net",
        "JIRA_EMAIL": "your-email@company.com",
        "JIRA_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

### 4. Restart Claude Code

The MCP server will be automatically loaded when you open the project.

## Usage Examples

Once configured, you can ask Claude:

```
> What's in ticket MINI-123?
> Show me my assigned tickets
> Search for tickets with label "backend"
> How should I implement MINI-456?
```

Claude will fetch the ticket details and combine them with codebase knowledge to give implementation suggestions.

## Security Notes

- Never commit `.mcp.json` with real credentials
- Add `.mcp.json` to `.gitignore`
- Each developer should configure their own credentials locally
