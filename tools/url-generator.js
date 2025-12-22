// example-url-generator.js
const data = {
  "title": "Team Beta - Aging WIP",
  "subtitle": "As of 2024/06/23",
  "board_url": "#",
  "min_days": 0,
  "max_days": 30,
  "theme": {
    "theme_name": "Default Theme",
    "theme_author_name": "System",
    "theme_author_email": "system@example.com",
    "sle_colors": ["#86efac", "#fef08a", "#fde047", "#fdba74", "#fca5a5"],
    "types": {
      "Task": { "color": "#3b82f6", "icon": "✓" },
      "Bug": { "color": "#ef4444", "icon": "🐛" },
      "Story": { "color": "#10b981", "icon": "📖" }
    },
    "priorities": {
      "Highest": "🔴",
      "High": "🟠",
      "Medium": "🟡",
      "Low": "🟢",
      "Lowest": "⚪"
    }
  },
  "features": {
    "dependencies": {
      "enabled": true,
      "show_toggle": true,
      "default_visible": true,
      "arrow_color": "#303030",
      "arrow_thickness": 2
    },
    "filters": {
      "enabled": true,
      "fields": ["type", "assignee", "label", "parent", "priority"] 
    }
  },
  "columns": [
    {
      "style": {
        "name": "Analysis Active",
        "top_text": "WIP: 3",
        "order": 1
      },
      "sle": { "step1": 2, "step2": 5, "step3": 7, "step4": 12 },
      "items": [
        {
          "key": "KAN-202",
          "title": "Database Schema Review",
          "type": "Task",
          "age": 1,
          "priority": "High",
          "urgency": 3,
          "assignee": { "name": "Alice Dev", "picture": "", "link": "#" },
          "labels": ["Backend", "DB"],
          "parent": { "key": "EPIC-1", "title": "Backend Overhaul", "url": "#" },
          "url": "https://jira.company.com/browse/KAN-202"
        },
        {
          "key": "KAN-205",
          "title": "Login Auth Bug",
          "type": "Bug",
          "age": 13,
          "priority": "Highest",
          "urgency": 4,
          "assignee": { "name": "Bob QA", "picture": "", "link": "#" },
          "labels": ["Security"],
          "parent": { "key": "EPIC-2", "title": "Security Audit", "url": "#" },
          "url": "https://jira.company.com/browse/KAN-205",
          "depends_on": "KAN-202"
        },
        {
          "key": "KAN-206",
          "title": "Legacy Cleanup",
          "type": "Task",
          "age": 4,
          "priority": "Low",
          "urgency": 1,
          "assignee": { "name": "Charlie", "picture": "", "link": "#" },
          "labels": ["Tech Debt"],
          "parent": { "key": "EPIC-1", "title": "Backend Overhaul", "url": "#" },
          "url": "https://jira.company.com/browse/KAN-206"
        }
      ]
    },
    {
      "style": {
        "name": "Dev Active",
        "top_text": "WIP: 2",
        "order": 2
      },
      "sle": { "step1": 5, "step2": 10, "step3": 15, "step4": 20 },
      "items": [
         {
          "key": "KAN-301",
          "title": "API Integration",
          "type": "Story",
          "age": 8,
          "priority": "Medium",
          "urgency": 2,
          "assignee": { "name": "Diana", "picture": "", "link": "#" },
          "labels": ["Frontend"],
          "parent": { "key": "EPIC-3", "title": "Frontend Revamp", "url": "#" },
          "url": "https://jira.company.com/browse/KAN-301",
          "depends_on": "KAN-206"
        },
        {
          "key": "KAN-305",
          "title": "Performance Tuning",
          "type": "Task",
          "age": 22,
          "priority": "High",
          "urgency": 3,
          "assignee": { "name": "Evan", "picture": "", "link": "#" },
          "labels": ["Ops"],
          "parent": { "key": "EPIC-3", "title": "Frontend Revamp", "url": "#" },
          "url": "https://jira.company.com/browse/KAN-305"
        }
      ]
    },
    {
      "style": {
        "name": "Testing",
        "top_text": "WIP: 1",
        "order": 3
      },
      "sle": { "step1": 3, "step2": 6, "step3": 9, "step4": 15 },
      "items": [
        {
          "key": "KAN-101",
          "title": "Critical Fix",
          "type": "Bug",
          "age": 28,
          "priority": "Highest",
          "urgency": 4,
          "assignee": { "name": "Fiona", "picture": "", "link": "#" },
          "labels": ["Urgent"],
          "parent": { "key": "EPIC-9", "title": "Q3 Goals", "url": "#" },
          "url": "https://jira.company.com/browse/KAN-101",
          "depends_on": "KAN-305"
        }
      ]
    }
  ]
};

const base64Encoded = btoa(JSON.stringify(data));
console.log(`${base64Encoded}`);