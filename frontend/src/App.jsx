import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

// ✅ Use env variable for deployment — falls back to localhost for dev
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

const socket = io(BACKEND_URL, { autoConnect: false });

// =========================
// STATUS COMPONENT
// =========================
const StatusBadge = ({ status }) => {
  if (!status) return null;

  const styles = {
    loading: "bg-yellow-100 text-yellow-800 border border-yellow-300",
    success: "bg-green-100 text-green-800 border border-green-300",
    error:   "bg-red-100 text-red-800 border border-red-300",
  };

  const icons = {
    loading: (
      <svg className="animate-spin w-4 h-4 mr-2 inline-block" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
    ),
    success: <span className="mr-2">✅</span>,
    error:   <span className="mr-2">❌</span>,
  };

  return (
    <div className={`flex items-center px-4 py-3 rounded-2xl text-sm font-medium ${styles[status.type]}`}>
      {icons[status.type]}
      {status.message}
    </div>
  );
};

const App = () => {

  // =========================
  // AUTH STATES
  // =========================
  const [email, setEmail]       = useState("");
  const [otp, setOtp]           = useState("");
  const [otpSent, setOtpSent]   = useState(false);
  const [verified, setVerified] = useState(false);

  // ✅ Status replaces alert()
  const [otpStatus, setOtpStatus]     = useState(null); // { type: 'loading'|'success'|'error', message }
  const [verifyStatus, setVerifyStatus] = useState(null);

  // =========================
  // CHAT STATES
  // =========================
  const [message, setMessage]   = useState("");
  const [messages, setMessages] = useState([]);
  const [cameraOn, setCameraOn] = useState(false);

  // =========================
  // REFS
  // =========================
  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnection = useRef(null);

  // =========================
  // SEND OTP
  // =========================
  const sendOTP = async () => {
    if (!email.trim()) {
      setOtpStatus({ type: "error", message: "Please enter a valid email." });
      return;
    }

    setOtpStatus({ type: "loading", message: "Sending OTP to your email…" });

    try {
      const response = await fetch(`${BACKEND_URL}/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.success) {
        setOtpStatus({ type: "success", message: "OTP sent! Check your inbox." });
        setTimeout(() => setOtpSent(true), 800);
      } else {
        setOtpStatus({ type: "error", message: data.message || "Failed to send OTP." });
      }
    } catch (error) {
      console.error(error);
      setOtpStatus({ type: "error", message: "Network error. Is the server running?" });
    }
  };

  // =========================
  // VERIFY OTP
  // =========================
  const verifyOTP = async () => {
    if (!otp.trim()) {
      setVerifyStatus({ type: "error", message: "Please enter the OTP." });
      return;
    }

    setVerifyStatus({ type: "loading", message: "Verifying OTP…" });

    try {
      const response = await fetch(`${BACKEND_URL}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();

      if (data.success) {
        setVerifyStatus({ type: "success", message: "Verified! Connecting you…" });

        setTimeout(() => {
          setVerified(true);
          socket.connect();
        }, 800);
      } else {
        setVerifyStatus({ type: "error", message: data.message || "Invalid OTP." });
      }
    } catch (error) {
      console.error(error);
      setVerifyStatus({ type: "error", message: "Network error. Try again." });
    }
  };

  // =========================
  // CREATE PEER CONNECTION
  // =========================
  const createPeerConnection = () => {
    peerConnection.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peerConnection.current.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("sendCandidate", event.candidate);
      }
    };
  };

  // =========================
  // START / STOP CAMERA
  // =========================
  const startCamera = async () => {
    try {
      if (cameraOn) {
        const stream = localVideoRef.current?.srcObject;
        if (stream) stream.getTracks().forEach((t) => t.stop());
        localVideoRef.current.srcObject  = null;
        remoteVideoRef.current.srcObject = null;
        peerConnection.current?.close();
        createPeerConnection();
        setCameraOn(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideoRef.current.srcObject = stream;

      peerConnection.current.getSenders().forEach((s) => peerConnection.current.removeTrack(s));
      stream.getTracks().forEach((track) => peerConnection.current.addTrack(track, stream));

      setCameraOn(true);

      if (peerConnection.current.remoteDescription?.type) {
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        socket.emit("answer", answer);
      } else {
        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);
        socket.emit("offer", offer);
      }
    } catch (error) {
      console.error(error);
    }
  };

  // =========================
  // NEXT USER
  // =========================
  const nextUser = async () => {
    setMessages([]);
    remoteVideoRef.current.srcObject = null;

    const stream = localVideoRef.current?.srcObject;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    localVideoRef.current.srcObject = null;

    peerConnection.current?.close();
    createPeerConnection();
    setCameraOn(false);
    socket.emit("next-user");
  };

  // =========================
  // SEND MESSAGE
  // =========================
  const sendMessage = () => {
    if (!message.trim()) return;
    socket.emit("send-message", { text: message });
    setMessage("");
  };

  const onSubmit = (e) => {
    e.preventDefault();
    sendMessage();
  };

  // =========================
  // EFFECTS
  // =========================
  useEffect(() => {
    createPeerConnection();

    socket.on("receive-message", (data) => {
      setMessages((prev) => [...prev, data]);
    });

    socket.on("offer", async (offer) => {
      try {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
        if (localVideoRef.current?.srcObject) {
          const answer = await peerConnection.current.createAnswer();
          await peerConnection.current.setLocalDescription(answer);
          socket.emit("answer", answer);
        }
      } catch (err) { console.error(err); }
    });

    socket.on("answer", async (answer) => {
      try {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (err) { console.error(err); }
    });

    socket.on("receiveCandidate", async (candidate) => {
      try {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) { console.error(err); }
    });

    socket.on("partner-disconnected", () => {
      remoteVideoRef.current.srcObject = null;
      setMessages([{ text: "Partner disconnected", senderId: "system" }]);
    });

    return () => {
      peerConnection.current?.close();
      socket.off("receive-message");
      socket.off("offer");
      socket.off("answer");
      socket.off("receiveCandidate");
      socket.off("partner-disconnected");
    };
  }, []);

  // =========================
  // RENDER
  // =========================
  return (
    <>
      {/* ── LOGIN PAGE ── */}
      {!otpSent && !verified && (
        <div className="h-screen w-screen flex items-center justify-center bg-gray-100">
          <div className="w-[400px] bg-white p-8 rounded-3xl shadow-xl flex flex-col gap-5">
            <h1 className="text-3xl font-bold text-center">Login</h1>

            <input
              type="email"
              placeholder="Enter Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendOTP()}
              className="border p-4 rounded-2xl outline-none"
            />

            {/* ✅ Status badge instead of alert */}
            <StatusBadge status={otpStatus} />

            <button
              onClick={sendOTP}
              disabled={otpStatus?.type === "loading"}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white py-3 rounded-2xl transition"
            >
              {otpStatus?.type === "loading" ? "Sending…" : "Send OTP"}
            </button>
          </div>
        </div>
      )}

      {/* ── OTP PAGE ── */}
      {otpSent && !verified && (
        <div className="h-screen w-screen flex items-center justify-center bg-gray-100">
          <div className="w-[400px] bg-white p-8 rounded-3xl shadow-xl flex flex-col gap-5">
            <h1 className="text-3xl font-bold text-center">Verify OTP</h1>
            <p className="text-sm text-gray-500 text-center">
              Sent to <span className="font-medium text-gray-700">{email}</span>
            </p>

            <input
              type="text"
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && verifyOTP()}
              maxLength={6}
              className="border p-4 rounded-2xl outline-none tracking-widest text-center text-xl font-mono"
            />

            {/* ✅ Status badge instead of alert */}
            <StatusBadge status={verifyStatus} />

            <button
              onClick={verifyOTP}
              disabled={verifyStatus?.type === "loading"}
              className="bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white py-3 rounded-2xl transition"
            >
              {verifyStatus?.type === "loading" ? "Verifying…" : "Verify OTP"}
            </button>

            <button
              onClick={() => { setOtpSent(false); setOtpStatus(null); }}
              className="text-sm text-gray-400 hover:text-gray-600 text-center"
            >
              ← Change email
            </button>
          </div>
        </div>
      )}

      {/* ── MAIN APP ── */}
      {verified && (
        <div className="h-screen w-screen bg-white flex p-6 gap-6">

          {/* VIDEO SECTION */}
          <div className="h-full w-[65%] bg-white rounded-3xl shadow-xl p-5 flex flex-col">
            <div className="flex-1 flex gap-5">
              <div className="flex-1 bg-gray-100 rounded-3xl overflow-hidden">
                <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 bg-gray-100 rounded-3xl overflow-hidden">
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 pt-5">
              <button
                onClick={startCamera}
                className="px-6 py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 transition font-medium"
              >
                {cameraOn ? "Stop Camera" : "Start Camera"}
              </button>
              <button
                onClick={nextUser}
                className="px-6 py-3 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white transition font-medium"
              >
                Next
              </button>
            </div>
          </div>

          {/* CHAT SECTION */}
          <div className="w-[35%] min-w-[350px] max-w-[500px] h-full bg-white rounded-3xl shadow-xl flex flex-col overflow-hidden">
            <div className="px-6 py-5 border-b">
              <h1 className="text-2xl font-semibold text-gray-800">Chat</h1>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
              {messages.map((msg, i) => {
                const isMe     = msg.senderId === socket.id;
                const isSystem = msg.senderId === "system";

                if (isSystem) {
                  return (
                    <div key={i} className="text-center text-xs text-gray-400 py-1">
                      {msg.text}
                    </div>
                  );
                }

                return (
                  <div key={i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`px-4 py-3 rounded-2xl max-w-[75%] break-words ${isMe ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-800"}`}>
                      {msg.text}
                    </div>
                  </div>
                );
              })}
            </div>

            <form onSubmit={onSubmit} className="p-5">
              <div className="flex items-center gap-3 bg-gray-100 rounded-2xl px-3 py-2">
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  type="text"
                  placeholder="Type a message…"
                  className="flex-1 bg-transparent outline-none px-2 py-2"
                />
                <button
                  type="submit"
                  className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2 rounded-xl transition"
                >
                  Send
                </button>
              </div>
            </form>
          </div>

        </div>
      )}
    </>
  );
};

export default App;