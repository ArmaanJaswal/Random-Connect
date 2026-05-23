# 🎲 Random Connect

A real-time random video and text chat app — like Omegle. Users verify their identity via OTP email, then get matched with a random stranger for live video and text chat powered by WebRTC and Socket.IO.

---

## ✨ Features

- 📧 Email OTP verification before entering the chat
- 🎥 Live video chat via WebRTC (peer-to-peer)
- 💬 Real-time text chat via Socket.IO
- 🔀 "Next" button to skip to a new stranger instantly
- 🔒 No accounts, no passwords — just verify and chat

---

## 🗂️ Project Structure

```
Random-Connect/
├── backend/          # Node.js + Express + Socket.IO server
│   ├── index.js
│   ├── package.json
│   └── .env          # (not committed — create this yourself)
└── frontend/         # React + Vite app
    ├── src/
    │   └── App.jsx
    ├── package.json
    └── .env          # (not committed — create this yourself)
```

---

## ⚙️ Prerequisites

Make sure you have these installed:

- [Node.js](https://nodejs.org/) v18 or higher
- npm (comes with Node.js)
- A Gmail account with [App Password](https://myaccount.google.com/apppasswords) enabled (requires 2FA)

---

## 🚀 Running Locally

### 1. Clone the repository

```bash
git clone https://github.com/ArmaanJaswal/Random-Connect.git
cd Random-Connect
```

### 2. Setup the Backend

```bash
cd backend
npm install
```

Create a `.env` file inside the `backend` folder:

```env
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-gmail-app-password
PORT=3000
```

> **How to get a Gmail App Password:**
> 1. Go to your [Google Account](https://myaccount.google.com/)
> 2. Enable **2-Step Verification** if not already on
> 3. Go to [App Passwords](https://myaccount.google.com/apppasswords)
> 4. Generate a password for **Mail** and paste it as `EMAIL_PASS`

Start the backend server:

```bash
node index.js
```

You should see:
```
Server running on port 3000
Mail server ready
```

### 3. Setup the Frontend

Open a **new terminal**, then:

```bash
cd frontend
npm install
```

Create a `.env` file inside the `frontend` folder:

```env
VITE_BACKEND_URL=http://localhost:3000
```

Start the frontend dev server:

```bash
npm run dev
```

Open your browser at `http://localhost:5173`

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS |
| Backend | Node.js, Express |
| Real-time | Socket.IO |
| Video | WebRTC |
| Email | Nodemailer + Gmail SMTP |

---

## 📜 How It Works

1. User enters their email → server sends a 6-digit OTP via Gmail
2. User verifies the OTP → socket connection is established
3. Server adds the user to a queue and matches them with the next available stranger
4. Both users are placed in a private Socket.IO room
5. WebRTC peer connection is negotiated via offer/answer/ICE candidates through the server
6. Video and audio stream directly peer-to-peer; text messages go through the server
7. Clicking **Next** disconnects from the current stranger and re-queues for a new match

---

## 🔒 Environment Variables Reference

### Backend `.env`

| Variable | Description |
|---|---|
| `EMAIL_USER` | Your Gmail address used to send OTPs |
| `EMAIL_PASS` | Gmail App Password (not your real password) |
| `PORT` | Port the server listens on (default: 3000) |

### Frontend `.env`

| Variable | Description |
|---|---|
| `VITE_BACKEND_URL` | Full URL of your backend (no trailing slash) |

---

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

---

## 📄 License

[MIT](LICENSE)
