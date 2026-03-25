---
name: table-search
description: Semantic table search for finding database tables using natural language queries. Use this skill whenever the user needs to search for database tables, discover table schemas, find tables related to specific topics like "用户表", "应急物资", or any table discovery tasks. Always trigger for table search, database exploration, or schema lookup requests.
---

# Table Search Skill

## Overview

This skill provides semantic table search capabilities for finding database tables using natural language queries.

## Service Configuration

- **Base URL**: `http://localhost:12222`
- **Root Path**: `/semantic_search`
- **API Docs**: `http://localhost:12222/semantic_search/docs`

## Quick Start

### Health Check

Always verify the service is running before making requests:

**Using Bash tool:**
```
Call Bash with: curl http://localhost:12222/semantic_search/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "Semantic Search API",
  "version": "1.0.0"
}
```

### Basic Table Search

**Using Bash tool (single quotes avoid escaping):**
```
Call Bash with: curl -X POST http://localhost:12222/semantic_search/table/search_tables -H 'Content-Type: application/json' -d '{"query": "查找用户相关的表", "limit": 10}'
```

**Using Bash tool (heredoc for complex JSON):**
```
Call Bash with: curl -X POST http://localhost:12222/semantic_search/table/search_tables -H 'Content-Type: application/json' -d @- << 'EOF'
{
  "query": "查找用户相关的表",
  "limit": 10
}
EOF
```

## API Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | **Yes** | - | Natural language search query in Chinese |
| `resource_ids` | array | No | `[]` | Filter by specific resource IDs |
| `limit` | integer | No | `10` | Max number of results to return |
| `enable_query_enhancement` | boolean | No | `true` | Enable AI query enhancement |
| `enable_rewrite` | boolean | No | `false` | Enable query rewriting |
| `enable_hyde` | boolean | No | `false` | Enable HyDE (Hypothetical Document Embeddings) |
| `enable_keywords` | boolean | No | `true` | Enable keyword extraction |

## Usage Examples

### Example 1: Find User Tables

**Using Bash (single quotes):**
```
Call Bash with: curl -X POST http://localhost:12222/semantic_search/table/search_tables -H 'Content-Type: application/json' -d '{"query": "用户表", "limit": 10}'
```

**Using Bash (heredoc - cleaner for complex queries):**
```
Call Bash with: curl -X POST http://localhost:12222/semantic_search/table/search_tables -H 'Content-Type: application/json' -d @- << 'EOF'
{
  "query": "用户表",
  "limit": 10
}
EOF
```

### Example 2: Emergency Management Tables

```
Call Bash with: curl -X POST http://localhost:12222/semantic_search/table/search_tables -H 'Content-Type: application/json' -d '{"query": "应急管理相关的表", "limit": 20}'
```

### Example 3: Search with Resource Filter

```
Call Bash with: curl -X POST http://localhost:12222/semantic_search/table/search_tables -H 'Content-Type: application/json' -d '{"query": "物资管理", "resource_ids": [100, 200, 300], "limit": 10}'
```

### Example 4: Advanced Search with All Features

**Using heredoc (recommended for complex JSON):**
```
Call Bash with: curl -X POST http://localhost:12222/semantic_search/table/search_tables -H 'Content-Type: application/json' -d @- << 'EOF'
{
  "query": "统计资源数量少于30的表",
  "limit": 10,
  "enable_query_enhancement": true,
  "enable_rewrite": true,
  "enable_hyde": true,
  "enable_keywords": true
}
EOF
```

## Response Format

```json
{
  "code": 200,
  "msg": "success",
  "data": [
    {
      "resource_id": 123,
      "resource_name": "sys_user",
      "view_name": "用户信息视图"
    },
    {
      "resource_id": 456,
      "resource_name": "user_profile",
      "view_name": "用户资料视图"
    }
  ]
}
```

**Field descriptions:**
- `resource_id`: Resource identifier
- `resource_name`: Table name
- `view_name`: View name

## Error Handling

| HTTP Code | Meaning | Action |
|-----------|---------|--------|
| `200` | Success | Process results |
| `400` | Bad Request | Check query parameters |
| `500` | Internal Server Error | Service issue, retry later |
| `503` | Service Unavailable | Maintenance window, wait |

## Best Practices

1. **Use natural Chinese** for queries: "用户管理表", "应急物资"
2. **Start with default settings** (`enable_query_enhancement: true`)
3. **Adjust limit** based on your needs (10-50 is typical)
4. **Use resource_ids** when you know specific resources to filter

## When to Use This Skill

- User asks to "查找表", "搜索表", "找表"
- User mentions table discovery or schema exploration
- User wants to find tables related to a business topic
- User needs database table recommendations

## Related

- For field search within tables, use the `field-search` skill
- For complete semantic search capabilities, use `semantic-search-api`
