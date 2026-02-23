# Mobile Integration Guide

This document provides a checklist and instructions for isolating the interview feature and preparing it for Expo integration.

## 1. Directory Structure
Create a dedicated folder (e.g., `mobile-feature-pack`) to keep everything isolated.
```text
/mobile-feature-pack
  /pages
    SelectionPage.tsx
    PracticePage.tsx
    AnalysisPage.tsx
  App.tsx
  backend.ts
  constants.ts
```

## 2. Refactoring Tasks

### 🛠️ Backend Consolidation (`backend.ts`)
Move all API calls from `index.tsx` into a service layer. Use environment variables for base URLs.
- `fetchQuestions()`
- `transcribeAudio(audioBlob)`
- `analyzeResponse(params)`

### 🛠️ Constants & Config (`constants.ts`)
Extract roles, question types, and time limits.
- `ROLES = [...]`
- `QUESTION_TYPES = [...]`

### 🛠️ Page Extraction
Break `App.tsx` into smaller components to simplify the Expo migration:
- **SelectionPage**: Filters questions and sets timer.
- **PracticePage**: Handles audio recording (`MediaRecorder` -> will need `expo-av` in React Native).
- **AnalysisPage**: Displays gauge charts and feedback.

## 3. UI/UX Changes for Mobile
- **Touch Targets**: Ensure buttons are at least 44x44px.
- **Typography**: Use responsive font sizes.
- **Scroll Management**: Ensure the filtering list is scrollable within a fixed screen height.
- **Keyboard Handling**: Prevent the query box or buttons from being hidden by the on-screen keyboard.

## 4. Expo Integration Cheat Sheet
For your teammate:
| Feature | React (Web) | React Native (Expo) |
| :--- | :--- | :--- |
| Icons | `lucide-react` | `@expo/vector-icons` |
| Audio | `MediaRecorder` | `expo-av` |
| Navigation | State-based | `expo-router` / `react-navigation` |
| Styling | CSS / Tailwind | `StyleSheet` / `nativewind` |

## 5. Implementation Steps
1. [ ] Move `questions.json` to the pack folder.
2. [ ] Extract `backend.ts` logic.
3. [ ] Create `SelectionPage.tsx` from `App.tsx` (selection step).
4. [ ] Create `PracticePage.tsx` from `App.tsx` (practice step).
5. [ ] Create `AnalysisPage.tsx` from `App.tsx` (analysis step).
6. [ ] Update `App.tsx` to simply switch between these pages.
