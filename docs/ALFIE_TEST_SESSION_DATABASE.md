# 📊 Alfie Test Session Database

> Copy this into Notion as a **Database** to track individual test sessions over time.

---

## Database Properties (Columns)

Create a Notion database with these properties:

| Property Name | Type | Options/Format |
|--------------|------|----------------|
| Session # | Title | Auto-increment |
| Date | Date | Date only |
| Duration | Number | Minutes |
| Overall Score | Number | 0.0 - 5.0 |
| Grade | Select | A, B, C, D, F |
| Mode Tested | Select | Agent (Voice), Chat, Both |
| Script 1: Standup | Number | 1-5 |
| Script 2: Status | Number | 1-5 |
| Script 3: Decision | Number | 1-5 |
| Script 4: Memory | Number | 1-5 |
| Script 5: Problem | Number | 1-5 |
| Script 6: Review | Number | 1-5 |
| Script 7: Ambiguity | Number | 1-5 |
| Script 8: Multi-Project | Number | 1-5 |
| Context Awareness | Number | 1-5 |
| Actionable Advice | Number | 1-5 |
| Memory Recall | Number | 1-5 |
| Prioritization | Number | 1-5 |
| Strategic Thinking | Number | 1-5 |
| Response Relevance | Number | 1-5 |
| Strengths | Multi-select | (add as you go) |
| Weaknesses | Multi-select | (add as you go) |
| Bugs Found | Number | Count |
| Notes | Text | Rich text |
| Action Items | Text | Rich text |

---

## Suggested Views

### 1. 📈 Progress Chart View (Chart)
- X-axis: Date
- Y-axis: Overall Score
- Shows performance trend over time

### 2. 📋 All Sessions (Table)
- Sort by Date descending
- Show: Session #, Date, Overall Score, Grade, Notes

### 3. 🎯 By Metric (Table)
- Group by: Grade
- Show all metric scores
- Good for identifying patterns

### 4. 🐛 Bug Tracker (Table)
- Filter: Bugs Found > 0
- Show: Date, Bugs Found, Notes

---

## Formula Properties (Optional Advanced)

### Auto-Calculate Overall Score
```
(prop("Script 1: Standup") + prop("Script 2: Status") + prop("Script 3: Decision") + prop("Script 4: Memory") + prop("Script 5: Problem") + prop("Script 6: Review") + prop("Script 7: Ambiguity") + prop("Script 8: Multi-Project")) / 8
```

### Auto-Assign Grade
```
if(prop("Overall Score") >= 4.5, "A", if(prop("Overall Score") >= 4.0, "B", if(prop("Overall Score") >= 3.0, "C", if(prop("Overall Score") >= 2.0, "D", "F"))))
```

### Weighted Metric Score
```
(prop("Context Awareness") * 0.25) + (prop("Actionable Advice") * 0.20) + (prop("Memory Recall") * 0.15) + (prop("Prioritization") * 0.15) + (prop("Strategic Thinking") * 0.15) + (prop("Response Relevance") * 0.10)
```

---

## Sample Entry

| Property | Value |
|----------|-------|
| Session # | Test Session 1 |
| Date | Nov 29, 2025 |
| Duration | 25 |
| Overall Score | 4.2 |
| Grade | B |
| Mode Tested | Both |
| Script 1: Standup | 5 |
| Script 2: Status | 4 |
| Script 3: Decision | 4 |
| Script 4: Memory | 3 |
| Script 5: Problem | 5 |
| Script 6: Review | 4 |
| Script 7: Ambiguity | 4 |
| Script 8: Multi-Project | 4 |
| Context Awareness | 5 |
| Actionable Advice | 4 |
| Memory Recall | 3 |
| Prioritization | 4 |
| Strategic Thinking | 4 |
| Response Relevance | 5 |
| Strengths | Linear Integration, Prioritization, Problem Solving |
| Weaknesses | Memory Recall, Cross-session continuity |
| Bugs Found | 1 |
| Notes | Alfie correctly identified top 3 priorities from Linear. Memory of last week's conversation was spotty. |
| Action Items | Improve knowledge graph integration, test memory after 24hr gap |

---

## 🏷️ Suggested Multi-Select Options

### Strengths Tags
- Linear Integration
- Notion Integration
- Pieces Context
- Prioritization
- Strategic Advice
- Problem Solving
- Clear Communication
- Proactive Suggestions
- Time Estimates
- Risk Identification
- Pattern Recognition

### Weaknesses Tags
- Memory Gaps
- Generic Responses
- Missing Context
- Wrong Priorities
- Slow Response
- Hallucinations
- Over-verbose
- Under-verbose
- Missed Deadlines
- Ignored Data

---

## 📅 Recommended Test Schedule

| Frequency | Test Type | Scripts to Run |
|-----------|-----------|----------------|
| Daily | Quick Check | 1 (Standup) |
| Weekly | Core Review | 1, 2, 5, 6 |
| Bi-weekly | Full Suite | All 8 scripts |
| Monthly | Deep Dive + Metrics | All 8 + detailed metric scoring |

---

## 🎯 Target Benchmarks

| Metric | Minimum | Target | Stretch |
|--------|---------|--------|---------|
| Overall Score | 3.5 | 4.2 | 4.8 |
| Context Awareness | 4.0 | 4.5 | 5.0 |
| Actionable Advice | 3.5 | 4.0 | 4.5 |
| Memory Recall | 3.0 | 4.0 | 4.5 |
| Prioritization | 3.5 | 4.0 | 4.5 |
| Strategic Thinking | 3.0 | 4.0 | 4.5 |
| Response Relevance | 4.0 | 4.5 | 5.0 |

---

## Quick Setup Checklist

- [ ] Create new Notion database
- [ ] Add all properties from table above
- [ ] Create formula properties (optional)
- [ ] Set up views (Table, Chart)
- [ ] Add multi-select options
- [ ] Create first test entry
- [ ] Link to Alfie project page

---

*Template Version: 1.0*
*Created: November 2025*

