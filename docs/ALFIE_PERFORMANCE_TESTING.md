# 🤖 Alfie Business Manager - Performance Testing Hub

> *"Intelligence is a very valuable thing, innit, my friend?"*

Use this template to systematically evaluate and improve Alfie's performance as your AI Business Manager.

---

## 📊 Performance Dashboard

### Current Grade: `___` / A

| Metric | Score | Target | Status |
|--------|-------|--------|--------|
| 🎯 Context Awareness | /5 | 4.5 | ⬜ |
| ✅ Actionable Advice | /5 | 4.0 | ⬜ |
| 🧠 Memory Recall | /5 | 4.0 | ⬜ |
| 📋 Prioritization | /5 | 4.0 | ⬜ |
| 🔮 Strategic Thinking | /5 | 4.0 | ⬜ |
| 💬 Response Relevance | /5 | 4.5 | ⬜ |

**Last Test Date:** _______________
**Next Scheduled Test:** _______________

---

## 🧪 Test Sessions Log

### Session Template

<details>
<summary>📋 Click to expand session template</summary>

```
## Test Session #___

**Date:** 
**Duration:** 
**Tester:** Clay
**Alfie Mode:** Agent / Chat

### Script Scores

| # | Script | Score | Notes |
|---|--------|-------|-------|
| 1 | Daily Standup | /5 | |
| 2 | Project Status | /5 | |
| 3 | Decision Support | /5 | |
| 4 | Memory Recall | /5 | |
| 5 | Problem Solving | /5 | |
| 6 | Weekly Review | /5 | |
| 7 | Ambiguous Request | /5 | |
| 8 | Multi-Project | /5 | |

**Average Score:** ___/5
**Grade:** ___

### Observations
**Strengths:**
- 

**Weaknesses:**
- 

**Bugs Found:**
- 

### Action Items
- [ ] 
```

</details>

---

## 📝 Test Scripts Reference

### Script 1: Daily Standup Simulation
**Purpose:** Tests context awareness & prioritization
**Weight:** High

#### Prompt
```
Good morning Alfie. What should I focus on today?
```

#### Follow-up
```
Which of those would have the biggest impact on [current main project]?
```

#### What to Look For
- [ ] References specific Linear issues by name
- [ ] Mentions "In Progress" items
- [ ] Recalls yesterday's work from Timeline
- [ ] Provides clear priority order
- [ ] Gives reasoning for priorities

#### Scoring Guide
| Score | Description |
|-------|-------------|
| 5 | Specific issues named, clear priorities with reasoning, uses all data sources |
| 4 | References projects, useful prioritization |
| 3 | Generic advice without project specifics |
| 2 | Vague response, minimal data usage |
| 1 | Off-topic or refuses |

---

### Script 2: Project Status Deep Dive
**Purpose:** Tests data integration & strategic thinking
**Weight:** High

#### Prompt
```
Give me a status report on the Alfie Agent - Business Manager project.
```

#### Follow-up
```
What's the biggest risk to hitting our target date?
```

#### What to Look For
- [ ] Pulls progress % from Linear
- [ ] Names specific completed issues
- [ ] Identifies blockers
- [ ] References Pieces timeline data
- [ ] Suggests priorities

#### Scoring Guide
| Score | Description |
|-------|-------------|
| 5 | Comprehensive with specific issues, progress data, strategic insights |
| 4 | Good overview with some details |
| 3 | Generic status, no actual data |
| 2 | Minimal/incorrect information |
| 1 | Cannot provide status |

---

### Script 3: Decision Support
**Purpose:** Tests strategic thinking & context synthesis
**Weight:** Medium

#### Prompt
```
I'm trying to decide whether to [Option A] or [Option B] first. What do you think?
```

*Example: "work on the Headless Steel Browser integration or fix the Linear view"*

#### Follow-up
```
What would happen if I delayed [chosen option] by a week?
```

#### What to Look For
- [ ] Considers impact of each option
- [ ] References dependencies
- [ ] Asks clarifying questions if needed
- [ ] Provides clear recommendation
- [ ] Explains trade-offs

#### Scoring Guide
| Score | Description |
|-------|-------------|
| 5 | Clear recommendation with project context and reasoning |
| 4 | Good recommendation with some context |
| 3 | Generic decision framework |
| 2 | Non-committal or unhelpful |
| 1 | Cannot help |

---

### Script 4: Memory & Continuity
**Purpose:** Tests memory recall & conversation continuity
**Weight:** Medium

#### Prompt
```
Remember when we discussed [recent topic]? What was the outcome?
```

*Example: "the Notes system implementation"*

#### Follow-up
```
Based on that, what should we do next?
```

#### What to Look For
- [ ] Recalls previous conversation
- [ ] References specific decisions
- [ ] Connects past to present
- [ ] Admits gaps honestly

#### Scoring Guide
| Score | Description |
|-------|-------------|
| 5 | Accurately recalls and connects to action |
| 4 | General context, useful continuation |
| 3 | Vague but offers help |
| 2 | Doesn't acknowledge memory gap |
| 1 | Fabricates or refuses |

---

### Script 5: Problem Solving
**Purpose:** Tests analytical thinking & actionable advice
**Weight:** High

#### Prompt
```
[Describe a recurring problem you're facing]
```

*Example: "The Linear integration keeps breaking. I've fixed it three times now. How should I approach this differently?"*

#### Follow-up
```
Should I create a Linear issue to track this?
```

#### What to Look For
- [ ] Asks diagnostic questions
- [ ] Suggests systematic approach
- [ ] Recommends prevention
- [ ] Offers specific steps
- [ ] Proposes tracking method

#### Scoring Guide
| Score | Description |
|-------|-------------|
| 5 | Systematic approach with specific steps and prevention |
| 4 | Good framework with some specifics |
| 3 | Generic advice (restart, check logs) |
| 2 | Unhelpful or vague |
| 1 | Cannot assist |

---

### Script 6: Weekly Review
**Purpose:** Tests data synthesis & pattern recognition
**Weight:** Medium

#### Prompt
```
What did I accomplish this week and what should I carry forward to next week?
```

#### Follow-up
```
What patterns do you see in my work habits this week?
```

#### What to Look For
- [ ] Summarizes completed issues
- [ ] Uses Timeline data
- [ ] Identifies patterns
- [ ] Suggests continuations
- [ ] Notes stalled items

#### Scoring Guide
| Score | Description |
|-------|-------------|
| 5 | Detailed summary with specific accomplishments and patterns |
| 4 | Good summary with some patterns |
| 3 | Generic review without data |
| 2 | Incomplete/inaccurate |
| 1 | Cannot provide |

---

### Script 7: Ambiguity Handling
**Purpose:** Tests clarification skills & context inference
**Weight:** Low

#### Prompt
```
The thing we talked about - can you help with that?
```

#### What to Look For
- [ ] Acknowledges ambiguity
- [ ] Offers context-aware guesses
- [ ] Asks clarifying question
- [ ] Doesn't fabricate

#### Scoring Guide
| Score | Description |
|-------|-------------|
| 5 | Graceful handling, context-aware guesses, good questions |
| 4 | Acknowledges and asks for clarification |
| 3 | Takes reasonable guess |
| 2 | Wrong guess, runs with it |
| 1 | Refuses or irrelevant |

---

### Script 8: Multi-Project Coordination
**Purpose:** Tests cross-project awareness & strategic allocation
**Weight:** High

#### Prompt
```
I have work to do on [Project 1], [Project 2], and [Project 3]. How should I split my time this week?
```

*Example: "Alfie, the Curve AI Web App, and the Oklahoma Compliance setup"*

#### Follow-up
```
What if a client emergency comes up?
```

#### What to Look For
- [ ] References each project's status
- [ ] Considers deadlines
- [ ] Suggests allocation percentages
- [ ] Identifies synergies/conflicts
- [ ] Has contingency thinking

#### Scoring Guide
| Score | Description |
|-------|-------------|
| 5 | Strategic allocation with percentages, deadlines, contingency |
| 4 | Good allocation with reasoning |
| 3 | Generic time management |
| 2 | Ignores multiple projects |
| 1 | Cannot help |

---

## ⚡ Quick Test Commands

Copy-paste these for rapid capability checks:

### Context Awareness
```
What Linear issues do I have in progress right now?
```

### Memory Check
```
What have we discussed in our recent conversations?
```

### Prioritization
```
If I can only complete 3 things today, what should they be?
```

### Strategic Thinking
```
What's the most important thing I should be working on this month?
```

### Data Integration
```
Summarize my activity from the last 3 days.
```

### Problem Triage
```
I'm feeling overwhelmed with all my projects. Help me triage.
```

---

## 📈 Improvement Tracking

### Known Limitations
- [ ] 
- [ ] 
- [ ] 

### Feature Requests
- [ ] 
- [ ] 
- [ ] 

### Bugs to Fix
- [ ] 
- [ ] 
- [ ] 

---

## 🏆 Grade History

| Date | Score | Grade | Notes |
|------|-------|-------|-------|
| | | | |
| | | | |
| | | | |

---

## 📚 Resources

- [Alfie GitHub Repository](https://github.com/...)
- [Linear Workspace](https://linear.app/...)
- [Pieces Desktop App](https://pieces.app)

---

*Last Updated: {{date}}*


