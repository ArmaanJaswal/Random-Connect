import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

const App = () => {

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [cameraOn, setCameraOn] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnection = useRef(null);

  // =========================
  // CREATE PEER CONNECTION
  // =========================
  const createPeerConnection = () => {

    peerConnection.current = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },
      ],
    });

    // RECEIVE REMOTE STREAM
    peerConnection.current.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    // SEND ICE CANDIDATES
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

      // =====================
      // STOP CAMERA
      // =====================
      if (cameraOn) {

        const stream = localVideoRef.current?.srcObject;

        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }

        localVideoRef.current.srcObject = null;
        remoteVideoRef.current.srcObject = null;

        peerConnection.current?.close();

        createPeerConnection();

        setCameraOn(false);

        console.log("Camera Stopped");

        return;
      }

      // =====================
      // START CAMERA
      // =====================
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localVideoRef.current.srcObject = stream;

      // REMOVE OLD TRACKS
      peerConnection.current.getSenders().forEach((sender) => {
        peerConnection.current.removeTrack(sender);
      });

      // ADD TRACKS
      stream.getTracks().forEach((track) => {
        peerConnection.current.addTrack(track, stream);
      });

      setCameraOn(true);

      console.log("Camera Started");

      // =====================
      // FIX: If remote already sent an offer while our
      // camera was off, just answer it.
      // Otherwise we are the initiator — send an offer.
      // =====================
      if (
        peerConnection.current.remoteDescription &&
        peerConnection.current.remoteDescription.type
      ) {
        // Answer the pending offer
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        socket.emit("answer", answer);
        console.log("Answered pending offer");
      } else {
        // Initiate — create offer
        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);
        socket.emit("offer", offer);
        console.log("Offer Sent");
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

    // CLEAR REMOTE VIDEO
    remoteVideoRef.current.srcObject = null;

    // STOP LOCAL STREAM
    const stream = localVideoRef.current?.srcObject;

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    localVideoRef.current.srcObject = null;

    // CLOSE CONNECTION
    peerConnection.current?.close();

    // CREATE NEW PEER
    createPeerConnection();

    setCameraOn(false);

    socket.emit("next-user");
  };

  // =========================
  // SEND MESSAGE
  // =========================
  const sendMessage = () => {

    if (message.trim() === "") return;

    socket.emit("send-message", { text: message });

    setMessage("");
  };

  // =========================
  // FORM SUBMIT
  // =========================
  const onSubmit = (e) => {
    e.preventDefault();
    sendMessage();
  };

  // =========================
  // EFFECTS
  // =========================
  useEffect(() => {

    createPeerConnection();

    // RECEIVE MESSAGE
    socket.on("receive-message", (data) => {
      setMessages((prev) => [...prev, data]);
    });

    // =====================
    // RECEIVE OFFER
    // FIX: Do NOT auto-start camera here.
    // Only set remote description and answer
    // if our camera is already running.
    // If camera is off, the remote description
    // is stored on the peer connection and will
    // be answered when the user clicks Start Camera.
    // =====================
    socket.on("offer", async (offer) => {

      try {

        await peerConnection.current.setRemoteDescription(
          new RTCSessionDescription(offer)
        );

        // Only answer if we already have a local stream
        if (localVideoRef.current?.srcObject) {

          const answer = await peerConnection.current.createAnswer();
          await peerConnection.current.setLocalDescription(answer);
          socket.emit("answer", answer);
          console.log("Answered offer (camera already on)");

        } else {
          // Camera is off — remote description is set on peerConnection.
          // startCamera() will detect remoteDescription and answer it
          // when the user clicks Start Camera.
          console.log("Offer received, waiting for user to start camera");
        }

      } catch (error) {
        console.error(error);
      }
    });

    // =====================
    // RECEIVE ANSWER
    // =====================
    socket.on("answer", async (answer) => {

      try {

        await peerConnection.current.setRemoteDescription(
          new RTCSessionDescription(answer)
        );

      } catch (error) {
        console.error(error);
      }
    });

    // =====================
    // RECEIVE ICE
    // =====================
    socket.on("receiveCandidate", async (candidate) => {

      try {

        await peerConnection.current.addIceCandidate(
          new RTCIceCandidate(candidate)
        );

      } catch (error) {
        console.error(error);
      }
    });

    // =====================
    // PARTNER LEFT
    // =====================
    socket.on("partner-disconnected", () => {

      remoteVideoRef.current.srcObject = null;

      setMessages([
        {
          text: "Partner disconnected",
          senderId: "system",
        },
      ]);
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

  return (
    <div className="
      h-screen
      w-screen
      bg-white
      flex
      p-6
      gap-6
    ">

      {/* VIDEO SECTION */}
      <div className="
        h-full
        w-[65%]
        bg-white
        rounded-3xl
        shadow-xl
        p-5
        flex
        flex-col
      ">

        {/* VIDEOS */}
        <div className="
          flex-1
          flex
          gap-5
        ">

          {/* LOCAL VIDEO */}
          <div className="
            flex-1
            bg-gray-100
            rounded-3xl
            overflow-hidden
          ">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          </div>

          {/* REMOTE VIDEO */}
          <div className="
            flex-1
            bg-gray-100
            rounded-3xl
            overflow-hidden
          ">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          </div>

        </div>

        {/* BUTTONS */}
        <div className="
          flex
          items-center
          justify-center
          gap-4
          pt-5
        ">

          {/* CAMERA BUTTON */}
          <button
            onClick={startCamera}
            className="
              px-6
              py-3
              rounded-2xl
              bg-gray-100
              hover:bg-gray-200
              transition
              font-medium
            "
          >
            {cameraOn ? "Stop Camera" : "Start Camera"}
          </button>

          {/* NEXT BUTTON */}
          <button
            onClick={nextUser}
            className="
              px-6
              py-3
              rounded-2xl
              bg-blue-500
              hover:bg-blue-600
              text-white
              transition
              font-medium
            "
          >
            Next
          </button>

        </div>

      </div>

      {/* CHAT SECTION */}
      <div className="
        w-[35%]
        min-w-[350px]
        max-w-[500px]
        h-full
        bg-white
        rounded-3xl
        shadow-xl
        flex
        flex-col
        overflow-hidden
      ">

        {/* HEADER */}
        <div className="px-6 py-5">
          <h1 className="text-2xl font-semibold text-gray-800">
            Chat
          </h1>
        </div>

        {/* MESSAGES */}
        <div className="
          flex-1
          overflow-y-auto
          px-5
          py-4
          flex
          flex-col
          gap-3
        ">
          {messages.map((msg, i) => {

            const isMe = msg.senderId === socket.id;

            return (
              <div
                key={i}
                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`
                    px-4
                    py-3
                    rounded-2xl
                    max-w-[75%]
                    break-words
                    ${isMe
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-800"
                    }
                  `}
                >
                  {msg.text}
                </div>
              </div>
            );
          })}
        </div>

        {/* INPUT */}
        <form
          onSubmit={onSubmit}
          className="p-5"
        >
          <div className="
            flex
            items-center
            gap-3
            bg-gray-100
            rounded-2xl
            px-3
            py-2
          ">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              type="text"
              placeholder="Type a message..."
              className="
                flex-1
                bg-transparent
                outline-none
                px-2
                py-2
              "
            />
            <button
              type="submit"
              className="
                bg-blue-500
                hover:bg-blue-600
                text-white
                px-5
                py-2
                rounded-xl
                transition
              "
            >
              Send
            </button>
          </div>
        </form>

      </div>

    </div>
  );
};

export default App;