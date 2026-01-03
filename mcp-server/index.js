import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// =============================================================================
// Configuration - Set via environment variables
// =============================================================================
const config = {
  jiraHost: process.env.JIRA_HOST,         // e.g., "company.atlassian.net"
  jiraEmail: process.env.JIRA_EMAIL,       // e.g., "dev@company.com"
  jiraApiToken: process.env.JIRA_API_TOKEN // API token from Atlassian
};

// =============================================================================
// Jira API Client
// =============================================================================
class JiraClient {
  constructor(host, email, apiToken) {
    this.baseUrl = `https://${host}/rest/api/3`;
    this.auth = Buffer.from(`${email}:${apiToken}`).toString("base64");
  }

  async request(endpoint, method = "GET", body = null) {
    const options = {
      method,
      headers: {
        "Authorization": `Basic ${this.auth}`,
        "Accept": "application/json",
        "Content-Type": "application/json"
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, options);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Jira API error (${response.status}): ${error}`);
    }

    return response.json();
  }

  async getTicket(ticketKey) {
    const data = await this.request(`/issue/${ticketKey}`);
    return this.formatTicket(data);
  }

  async getComments(ticketKey) {
    const data = await this.request(`/issue/${ticketKey}/comment`);
    return data.comments.map(comment => ({
      author: comment.author?.displayName || "Unknown",
      created: comment.created,
      body: this.extractText(comment.body)
    }));
  }

  async searchTickets(jql, maxResults = 10) {
    // Use the new /search/jql POST endpoint (old /search GET was deprecated)
    const data = await this.request("/search/jql", "POST", {
      jql: jql,
      maxResults: maxResults
    });
    return data.issues.map(issue => this.formatTicket(issue));
  }

  async getMyTickets(maxResults = 10) {
    return this.searchTickets("assignee = currentUser() ORDER BY updated DESC", maxResults);
  }

  formatTicket(issue) {
    const fields = issue.fields;
    return {
      key: issue.key,
      summary: fields.summary,
      description: this.extractText(fields.description),
      type: fields.issuetype?.name,
      status: fields.status?.name,
      priority: fields.priority?.name,
      assignee: fields.assignee?.displayName,
      reporter: fields.reporter?.displayName,
      labels: fields.labels || [],
      created: fields.created,
      updated: fields.updated,
      acceptance_criteria: this.extractAcceptanceCriteria(fields.description)
    };
  }

  extractText(adfContent) {
    if (!adfContent) return "";
    if (typeof adfContent === "string") return adfContent;

    // Atlassian Document Format (ADF) to plain text
    const extractFromNode = (node) => {
      if (!node) return "";
      if (node.type === "text") return node.text || "";
      if (node.content) {
        return node.content.map(extractFromNode).join("");
      }
      return "";
    };

    if (adfContent.content) {
      return adfContent.content.map(extractFromNode).join("\n").trim();
    }
    return "";
  }

  extractAcceptanceCriteria(description) {
    const text = this.extractText(description);
    const criteria = [];

    // Look for common AC patterns
    const lines = text.split("\n");
    let inAcSection = false;

    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      if (lowerLine.includes("acceptance criteria") || lowerLine.includes("ac:")) {
        inAcSection = true;
        continue;
      }
      if (inAcSection) {
        const trimmed = line.trim();
        if (trimmed.startsWith("-") || trimmed.startsWith("*") || trimmed.match(/^\d+\./)) {
          criteria.push(trimmed.replace(/^[-*]\s*/, "").replace(/^\d+\.\s*/, ""));
        } else if (trimmed === "" && criteria.length > 0) {
          break; // End of AC section
        }
      }
    }

    return criteria;
  }
}

// =============================================================================
// MCP Server Setup
// =============================================================================
const server = new McpServer({
  name: "mini-redis-jira",
  version: "1.0.0"
});

// Lazy-init Jira client (validates config on first use)
let jiraClient = null;

function getJiraClient() {
  if (!jiraClient) {
    if (!config.jiraHost || !config.jiraEmail || !config.jiraApiToken) {
      throw new Error(
        "Missing Jira configuration. Set JIRA_HOST, JIRA_EMAIL, and JIRA_API_TOKEN environment variables."
      );
    }
    jiraClient = new JiraClient(config.jiraHost, config.jiraEmail, config.jiraApiToken);
  }
  return jiraClient;
}

// =============================================================================
// Tool: Get Ticket
// =============================================================================
server.tool(
  "jira_get_ticket",
  "Fetch a Jira ticket by its key (e.g., MINI-123). Returns summary, description, acceptance criteria, status, and other details.",
  {
    ticket_key: z.string().describe("The Jira ticket key (e.g., MINI-123, PROJ-456)")
  },
  async ({ ticket_key }) => {
    try {
      const client = getJiraClient();
      const ticket = await client.getTicket(ticket_key);

      return {
        content: [{
          type: "text",
          text: JSON.stringify(ticket, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error fetching ticket: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

// =============================================================================
// Tool: Get Comments
// =============================================================================
server.tool(
  "jira_get_comments",
  "Fetch comments on a Jira ticket. Useful for getting additional context, clarifications, or discussion.",
  {
    ticket_key: z.string().describe("The Jira ticket key (e.g., MINI-123)")
  },
  async ({ ticket_key }) => {
    try {
      const client = getJiraClient();
      const comments = await client.getComments(ticket_key);

      return {
        content: [{
          type: "text",
          text: comments.length > 0
            ? JSON.stringify(comments, null, 2)
            : "No comments on this ticket."
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error fetching comments: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

// =============================================================================
// Tool: Search Tickets
// =============================================================================
server.tool(
  "jira_search",
  "Search for Jira tickets using JQL (Jira Query Language). Examples: 'project = MINI', 'labels = backend', 'status = \"In Progress\"'",
  {
    jql: z.string().describe("JQL query string"),
    max_results: z.number().optional().default(10).describe("Maximum results to return (default: 10)")
  },
  async ({ jql, max_results }) => {
    try {
      const client = getJiraClient();
      const tickets = await client.searchTickets(jql, max_results);

      return {
        content: [{
          type: "text",
          text: tickets.length > 0
            ? JSON.stringify(tickets, null, 2)
            : "No tickets found matching your query."
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error searching tickets: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

// =============================================================================
// Tool: My Tickets
// =============================================================================
server.tool(
  "jira_my_tickets",
  "Get tickets assigned to the current user, sorted by recently updated.",
  {
    max_results: z.number().optional().default(10).describe("Maximum results to return (default: 10)")
  },
  async ({ max_results }) => {
    try {
      const client = getJiraClient();
      const tickets = await client.getMyTickets(max_results);

      return {
        content: [{
          type: "text",
          text: tickets.length > 0
            ? JSON.stringify(tickets, null, 2)
            : "No tickets assigned to you."
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error fetching your tickets: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

// =============================================================================
// Start Server
// =============================================================================
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Mini-Redis Jira MCP server running on stdio");
}

main().catch(console.error);
