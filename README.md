# ⚡ Athena — AI Personal Assistant

> Your own JARVIS. Voice-first. Built for your life.

Athena is a React Native / Expo personal AI assistant that lives on your phone. She talks, listens, remembers your schedule, tracks your habits and goals, logs finances, and takes notes — all driven by Claude AI.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🌐 **Animated Sphere** | JARVIS-style orb that reacts to voice in real-time |
| 🎙 **Voice I/O** | Hold to speak, Athena responds aloud (Whisper STT + expo-speech TTS) |
| 📅 **Smart Schedule** | Calendar events + task deadlines, voice-creatable |
| ✅ **Tasks** | Priority tasks with smart reminders |
| 💪 **Habit Tracker** | Streaks, daily completions, 7-day history |
| 💰 **Finance Log** | Income/expense tracking with monthly summary |
| 🎯 **Goal Tracker** | Progress tracking with milestones |
| 📝 **Notes** | Voice-added notes, searchable, pinnable |
| 🧠 **AI Memory** | Athena reads your context before every response |
| 🔔 **Reminders** | Local notifications for tasks and daily briefing |

---

## 🚀 Quick Start

### 1. Clone & install
```bash
git clone https://github.com/louiscmd/athena.git
cd athena
npm install
```

### 2. Start the dev server
```bash
npx expo start
```

Scan the QR code with **Expo Go** on your Android device.

### 3. First launch
On first launch, Athena will ask for:
- **Your name** (optional)
- **Anthropic API Key** — get one at [console.anthropic.com](https://console.anthropic.com)
- **OpenAI API Key** — optional, enables voice input via Whisper

---

## 🔌 Recommended Integrations (Phase 2)

| App | How to connect |
|-----|---------------|
| Google Calendar | OAuth via Google APIs |
| Gmail | OAuth via Google APIs |
| Spotify | Spotify Web API + SDK |
| Google Drive | Google Drive API |
| Notion | Notion API |
| WhatsApp | Not officially supported (use Telegram instead) |

---

## 📱 Build for Android (Google Play)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build APK for testing
eas build -p android --profile preview

# Build for Play Store
eas build -p android --profile production
```

---

## 🧱 Tech Stack

- **Framework**: Expo (React Native)
- **Navigation**: Expo Router
- **AI**: Anthropic Claude (claude-sonnet-5)
- **STT**: OpenAI Whisper
- **TTS**: expo-speech
- **Database**: expo-sqlite (local, on-device)
- **Animations**: react-native-reanimated + react-native-svg
- **Notifications**: expo-notifications

---

## 💡 Example Voice Commands

```
"Schedule a team meeting tomorrow at 2 PM"
"Add a habit: drink 2 liters of water daily 💧"
"I spent $45 on groceries"
"Set a goal: launch the app by end of month"
"Note: call dentist on Monday"
"What's on my schedule today?"
"How am I doing on my habits this week?"
"What's my financial balance this month?"
```

---

## 🗺 Roadmap

- [ ] Google Calendar sync
- [ ] Gmail integration (read/draft)
- [ ] Spotify control
- [ ] Custom wake word
- [ ] ElevenLabs voice (premium TTS)
- [ ] Widget (home screen quick add)
- [ ] Mac desktop companion app

---

Built with ⚡ by [louiscmd](https://github.com/louiscmd)
