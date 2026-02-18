# Family Organizer App

## Project Vision
A Dockerized, RabbitMQ-based web application for organizing family activities, events, and chores. The system uses gamification (points & rewards) to motivate participation.

## Requirements

### General
- **License:** MIT or similar for all libraries.
- **Design Philosophy:** **Ultra-Modern UI/UX.**
  - Clean, minimalist aesthetic with high attention to detail.
  - Responsive, mobile-first design.
  - Interactive elements (animations, hover states).
  - **Desktop:** Persistent Navbar, User Avatar, Preferences, Logout.
  - **Visuals:** "Beautiful experience" - use of whitespace, modern typography, and consistent color palettes.

### Phase 1: Core Foundation (Completed)
- [x] Docker & Docker Compose setup.
- [x] FastAPI Backend (Python).
- [x] React Frontend (Vite/TS).
- [x] PostgreSQL Database.
- [x] RabbitMQ Message Broker.
- [x] Google OAuth 2.0 (SSO).
- [x] Basic Chore/Reward System.
- [x] Real-time Dashboard (WebSockets).

### Phase 2: Intelligent Agent (In Progress)
- [ ] **AI Agent:** A background service that manages calendars and events.
- [ ] **Proactive Warnings:** Agent detects conflicts or "too busy" days.
- [ ] **Learning:** Agent adapts to user feedback (Reinforcement Learning / Feedback loops).
- [ ] **Integration:** Two-way sync with Google Tasks/Calendar (Enhanced).

### Phase 3: Expansion (Future)
- [ ] Advanced metrics & visualization.
- [ ] Mobile native features (notifications).
