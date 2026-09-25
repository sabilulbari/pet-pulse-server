const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

require("dotenv").config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    credentials: true,
  },
});

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json());

const port = process.env.PORT || 5000;
const uri = process.env.MONGO_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const JWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));

// Reusable JWT verification function
async function verifyJWT(token) {
  const { payload } = await jwtVerify(token, JWKS);
  return payload;
}

// REST JWT verification middleware
const verifyToken = async (req, res, next) => {
  const authHeader = req?.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const payload = await verifyJWT(token);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Unauthorized" });
  }
};

// Authorized chat users
const CHAT_USERS = [
  {
    userId: "6ab6a433dc9e927412ca2c42",
    email: "naruto@naruto.com",
    name: "Naruto",
  },
  {
    userId: "6ab6a4b1dc9e927412ca2c46",
    email: "hinata@hinata.com",
    name: "Hinata",
  },
];


// Deterministic conversation ID generator
function createConversationId(userId1, userId2) {
  return [userId1, userId2].sort().join("_");
}

const AUTHORIZED_CONVERSATION_ID = createConversationId(
  CHAT_USERS[0].userId,
  CHAT_USERS[1].userId
);

// Map to track active sockets per user: Map<userId, Set<socketId>>
const onlineUsers = new Map();

async function run() {
  try {
    const db = client.db("pet-pulse");
    const allPetCollection = db.collection("All-added-pet");
    const allAdoptionReqCollection = db.collection("All-Adoption-req");
    const chatMessagesCollection = db.collection("chat-messages");

    // Ensure compound index for message history performance: { conversationId: 1, createdAt: 1 }
    await chatMessagesCollection.createIndex({ conversationId: 1, createdAt: 1 });

    // --- Chat REST Endpoint: Message History ---
    app.get("/chat/messages/:conversationId", verifyToken, async (req, res) => {
      const { conversationId } = req.params;
      const verifiedUserId = req.user?.sub || req.user?.id;
      const verifiedEmail = req.user?.email;

      const isAuthorized = CHAT_USERS.some(
        (u) => u.userId === verifiedUserId && u.email === verifiedEmail
      );
      if (!isAuthorized) {
        return res.status(403).json({ message: "Forbidden: Not an authorized chat user" });
      }

      if (conversationId !== AUTHORIZED_CONVERSATION_ID) {
        return res.status(403).json({ message: "Forbidden: Invalid conversation ID" });
      }

      try {
        const messages = await chatMessagesCollection
          .find({ conversationId })
          .sort({ createdAt: 1 })
          .toArray();
        res.json(messages);
      } catch (error) {
        console.error("Error fetching chat messages:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // --- Socket.IO Authentication Middleware ---
    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token;
        if (!token) {
          return next(new Error("Unauthorized: Token missing"));
        }

        const payload = await verifyJWT(token);
        const verifiedUserId = payload.sub || payload.id;
        const verifiedEmail = payload.email;

        if (!verifiedUserId || !verifiedEmail) {
          return next(new Error("Unauthorized: Invalid token payload"));
        }

        const isAuthorized = CHAT_USERS.some(
          (u) => u.userId === verifiedUserId && u.email === verifiedEmail
        );

        if (!isAuthorized) {
          return next(new Error("Unauthorized: User not allowed to access chat"));
        }

        // Attach verified user identity derived directly from the cryptographic JWT
        socket.user = {
          id: verifiedUserId,
          email: verifiedEmail,
          name: payload.name || "",
        };

        next();
      } catch (error) {
        console.error("Socket authentication error:", error.message);
        next(new Error("Unauthorized"));
      }
    });

    // --- Socket.IO Connection & Events ---
    io.on("connection", (socket) => {
      const userId = socket.user.id;
      console.log(`Socket connected: ${socket.id} (User: ${userId}, Email: ${socket.user.email})`);

      // Track active sockets for this user
      if (!onlineUsers.has(userId)) {
        onlineUsers.set(userId, new Set());
      }
      const userSockets = onlineUsers.get(userId);
      const wasOffline = userSockets.size === 0;
      userSockets.add(socket.id);

      // If this was the user's first active connection, notify participants that they are online
      if (wasOffline) {
        io.to(AUTHORIZED_CONVERSATION_ID).emit("user_online", { userId });
      }

      // Send the current list of online users to the newly connected socket
      const activeUserIds = Array.from(onlineUsers.entries())
        .filter(([_, set]) => set.size > 0)
        .map(([uId]) => uId);
      socket.emit("online_users", activeUserIds);

      // Join private conversation room
      socket.on("join_conversation", (data) => {
        const { conversationId } = data || {};
        if (conversationId === AUTHORIZED_CONVERSATION_ID) {
          socket.join(conversationId);
          console.log(`User ${userId} joined room: ${conversationId}`);
        } else {
          console.warn(`User ${userId} attempted to join unauthorized room: ${conversationId}`);
        }
      });

      // Send message event
      socket.on("send_message", async (data, callback) => {
        try {
          const { conversationId, message } = data || {};

          // Backend validation
          if (!conversationId || conversationId !== AUTHORIZED_CONVERSATION_ID) {
            if (typeof callback === "function") {
              callback({ success: false, error: "Invalid conversation ID" });
            }
            return;
          }

          if (typeof message !== "string" || !message.trim()) {
            if (typeof callback === "function") {
              callback({ success: false, error: "Message cannot be empty" });
            }
            return;
          }

          if (message.length > 1000) {
            if (typeof callback === "function") {
              callback({ success: false, error: "Message exceeds 1000 characters limit" });
            }
            return;
          }

          // Determine receiver server-side from CHAT_USERS list
          const receiver = CHAT_USERS.find((u) => u.userId !== socket.user.id);
          if (!receiver) {
            if (typeof callback === "function") {
              callback({ success: false, error: "Receiver not found" });
            }
            return;
          }

          // Construct message document with server-derived identities and timestamp
          const messageDoc = {
            conversationId,
            senderId: socket.user.id,
            senderEmail: socket.user.email,
            receiverId: receiver.userId,
            receiverEmail: receiver.email,
            message: message.trim(),
            createdAt: new Date(),
          };

          // Save to MongoDB collection
          const result = await chatMessagesCollection.insertOne(messageDoc);
          messageDoc._id = result.insertedId;

          // Broadcast message to everyone in the private conversation room
          io.to(conversationId).emit("receive_message", messageDoc);

          if (typeof callback === "function") {
            callback({ success: true, message: messageDoc });
          }
        } catch (err) {
          console.error("Error processing send_message:", err);
          if (typeof callback === "function") {
            callback({ success: false, error: "Failed to send message" });
          }
        }
      });

      // Disconnect event
      socket.on("disconnect", () => {
        console.log(`Socket disconnected: ${socket.id} (User: ${userId})`);
        const userSockets = onlineUsers.get(userId);
        if (userSockets) {
          userSockets.delete(socket.id);
          // Only broadcast user_offline when all sockets for this user have closed
          if (userSockets.size === 0) {
            onlineUsers.delete(userId);
            io.to(AUTHORIZED_CONVERSATION_ID).emit("user_offline", { userId });
          }
        }
      });
    });

    // --- Existing REST Endpoints (Preserved Exactly) ---
    // all delete request
    app.delete("/addPet/:id", verifyToken, async (req, res) => {
      const { id } = await req.params;
      const result = await allPetCollection.deleteOne({ _id: new ObjectId(id) });
      res.json(result);
    });
    app.delete("/myrequest/cancleReq/:id", verifyToken, async (req, res) => {
      const { id } = await req.params;
      const result = await allAdoptionReqCollection.deleteOne({ _id: new ObjectId(id) });
      res.json(result);
    });

    // All post requests
    app.post("/addPet", verifyToken, async (req, res) => {
      const allPets = await req.body;
      const result = await allPetCollection.insertOne(allPets);
      res.json(result);
    });

    app.post("/adoptnow", verifyToken, async (req, res) => {
      const adoptReq = await req.body;
      const result = await allAdoptionReqCollection.insertOne(adoptReq);
      res.json(result);
    });

    // all patch request
    app.patch("/adoptnow/approveReq/:id", verifyToken, async (req, res) => {
      const { id } = await req.params;
      const petStatus = await allAdoptionReqCollection.findOne({ _id: new ObjectId(id) });
      const petData = await allPetCollection.updateOne({ _id: new ObjectId(petStatus.petId) }, { $set: { status: "Approved" } });
      console.log(petStatus);
      console.log(petData);
      const result = await allAdoptionReqCollection.updateOne({ _id: new ObjectId(id) }, { $set: { status: "Approved" } });
      res.json(result);
    });

    app.patch("/adoptnow/rejectReq/:id", verifyToken, async (req, res) => {
      const { id } = await req.params;
      const result = await allAdoptionReqCollection.updateOne({ _id: new ObjectId(id) }, { $set: { status: "Rejected" } });
      res.json(result);
    });

    app.patch("/addPet/:id", verifyToken, async (req, res) => {
      const { id } = await req.params;
      const updatedData = req.body;
      console.log(updatedData);
      const result = await allPetCollection.updateOne({ _id: new ObjectId(id) }, { $set: updatedData });
      res.json(result);
    });

    // all get request
    app.get("/adoptnow/my-request/:reqUserEmail", verifyToken, async (req, res) => {
      const { reqUserEmail } = await req.params;
      const result = await allAdoptionReqCollection.find({ reqUserEmail }).toArray();
      res.send(result);
    });

    app.get("/all-pets", async (req, res) => {
      const result = await allPetCollection.find().toArray();
      res.send(result);
    });

    app.get("/all-pets/:petId", verifyToken, async (req, res) => {
      const { petId } = await req.params;
      const result = await allPetCollection.findOne({ _id: new ObjectId(petId) });
      res.send(result);
    });

    app.get("/all-pets/my-listing/:ownerEmail", verifyToken, async (req, res) => {
      const { ownerEmail } = await req.params;
      const result = await allPetCollection.find({ ownerEmail }).toArray();
      res.send(result);
    });

    app.get("/all-pets/my-listing/adoptReq/:petName", verifyToken, async (req, res) => {
      console.log("Data");
      const { petName } = await req.params;
      const result = await allAdoptionReqCollection.find({ petName }).toArray();
      res.send(result, "all this pet request");
    });

    app.get("/", async (req, res) => {
      res.send("Server is ready");
    });
  } finally {
    //
  }
}
run().catch(console.dir);

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
