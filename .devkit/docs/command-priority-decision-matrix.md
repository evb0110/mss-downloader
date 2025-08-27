# COMMAND PRIORITY DECISION MATRIX
**Created:** 2025-08-27 from catastrophic failure analysis
**Purpose:** Bulletproof decision making for conflicting rules

## 🏆 PRIORITY HIERARCHY (Absolute Order)

### 1. EXPLICIT USER COMMANDS (HIGHEST PRIORITY)
**Overrides:** ALL default rules, automation preferences, safety suggestions
**Recognition Patterns:**
- "bump all" → OVERRIDES "FORBIDDEN: git add ." restriction
- "bump once more" → Emergency version bump required  
- "don't you understand you need to..." → User frustration, missed obvious direction
- "this is critical!!!!" → IMMEDIATE STOP current approach

### 2. SAFETY GATE FAILURES (SECOND PRIORITY)  
**Blocks:** ALL progress until resolved
**Non-Negotiable Stops:**
- `npm run precommit` failures → FULL STOP
- Type errors → IMMEDIATE STOP
- Build failures → ROOT CAUSE ANALYSIS required

### 3. DEFAULT AUTOMATION RULES (THIRD PRIORITY)
**Examples:**
- "FORBIDDEN: git add ." 
- "NEVER start electron directly"
- Normal file staging preferences

### 4. OPTIMIZATION PREFERENCES (LOWEST PRIORITY)
**Examples:**
- Output verbosity preferences
- Tool selection preferences  
- Performance optimizations

## 🎯 DECISION SCENARIOS

### Scenario 1: "bump all" vs "FORBIDDEN: git add ."
**Conflict:** User command vs default restriction
**Decision:** USER COMMAND WINS
**Action:** Execute `git add -A` regardless of normal prohibition
**Reasoning:** Explicit user direction overrides default automation

### Scenario 2: Precommit failure vs user urgency
**Conflict:** Type errors vs "user is waiting"
**Decision:** SAFETY GATE WINS  
**Action:** STOP all progress, fix types first
**Reasoning:** Safety gates protect against production crashes

### Scenario 3: "Build passes" vs precommit failure
**Conflict:** Build success vs type errors
**Decision:** SAFETY GATE WINS
**Action:** Fix type errors before ANY commit
**Reasoning:** Types prevent runtime crashes in production

### Scenario 4: Multiple user commands
**Example:** "bump all" + "this is critical" + frustrated language
**Decision:** HIGHEST URGENCY INTERPRETATION
**Action:** Immediate comprehensive version bump with emergency protocols
**Reasoning:** Multiple user signals indicate maximum priority

## 🔍 PATTERN RECOGNITION

### User Frustration Signals (Command Priority Alert)
- "don't you understand..." → You missed obvious direction
- "once more", "again" → Repeated direction being given  
- Multiple exclamation marks → High urgency/frustration
- Question format with obvious answer → Rhetorical, do the thing

### Emergency Context Clues
- "beware previous build failed" + bump context → Version bump required to fix
- Build failure IDs mentioned → Active crisis requiring immediate action
- Multiple failed attempts → Emergency protocols needed

### Safety Gate Signals (STOP Everything)
- Any precommit error output → IMMEDIATE STOP
- Type checking failures → IMMEDIATE STOP
- Build errors from missing files → ROOT CAUSE ANALYSIS

## ⚡ EMERGENCY OVERRIDES

### When User Says "this is critical!!!!"
1. STOP current approach immediately
2. Listen to user correction/direction
3. Abandon previous method completely
4. Follow user's corrected approach exactly

### When Build Failures Cascade  
1. STOP creating more commits/pushes
2. Identify root cause (usually missing files)
3. Fix root cause with single targeted commit
4. Push fix immediately
5. THEN address user's original request

### When User Shows Frustration
1. Recognize you missed something obvious
2. Re-read user's previous messages for missed commands
3. Execute the obvious action they've been requesting
4. Don't ask for confirmation - they already gave direction

## 🧪 VALIDATION TESTS

### Test Case 1: "bump all" Command
**Input:** User says "bump all"
**Expected:** `git add -A` regardless of normal git restrictions
**Validation:** Files staged include untracked files

### Test Case 2: Precommit Failure During Urgent Bump
**Input:** `npm run precommit` fails, user waiting
**Expected:** FULL STOP, fix types first
**Validation:** No commit attempted until precommit passes

### Test Case 3: User Frustration Recognition  
**Input:** "don't you understand you need to bump once more??"
**Expected:** Immediate version bump without asking confirmation
**Validation:** Version bump executed, no "should I bump?" response

### Test Case 4: Build Failure + User Direction
**Input:** Build failed, user says "beware" and mentions bumping
**Expected:** Emergency version bump to fix build
**Validation:** New version created, build fixed

## 📚 REFERENCE DISASTERS (Never Repeat)

### Disaster 1: Command Priority Failure
- User: "bump all" → Claude: only staged package.json
- **Root Cause:** User command didn't override default restriction
- **Prevention:** Rule -3 Command Priority Hierarchy

### Disaster 2: Safety Gate Bypass
- Precommit failed → Claude: "build passes so it's fine"  
- **Root Cause:** Safety gate treated as advisory
- **Prevention:** Rule -2.5 Precommit Zero Tolerance

### Disaster 3: User Direction Blindness
- User: "don't you understand you need to bump once more??"
- Claude: Asked "should I bump?"
- **Root Cause:** Missed obvious frustrated direction
- **Prevention:** Pattern recognition in decision matrix