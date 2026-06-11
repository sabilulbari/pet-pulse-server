const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const app = express();
const cors = require("cors");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

require("dotenv").config();
app.use(cors());
app.use(express.json());

const port = process.env.PORT;

const uri = process.env.MONGO_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const JWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));

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
    const { payload } = await jwtVerify(token, JWKS);
    next();
    console.log(payload, "payload");
  } catch (error) {
    return res.status(403).json({ message: "Unauthorized" });
  }
};

async function run() {
  try {
    // await client.connect();

    const db = client.db("pet-pulse");
    const allPetCollection = db.collection("All-added-pet");
    const allAdoptionReqCollection = db.collection("All-Adoption-req");

    //all delete request
    app.delete("/addPet/:id", verifyToken, async (req, res) => {
      const { id } = await req.params;
      const result = await allPetCollection.deleteOne({ _id: new ObjectId(id) });
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

    app.patch("/adoptnow/rejectReq/:id",verifyToken, async (req, res) => {
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

    app.get("/all-pets/my-listing/adoptReq/:petName",verifyToken, async (req, res) => {
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

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
