const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const app = express();
const cors = require("cors");

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

async function run() {
  try {
    await client.connect();

    const db = client.db("pet-pulse");
    const allPetCollection = db.collection("All-added-pet");
    const allAdoptionReqCollection = db.collection("All-Adoption-req");

    app.post("/addPet", async (req, res) => {
      const allPets = await req.body;
      const result = await allPetCollection.insertOne(allPets);
      res.json(result);
    });

    app.post("/adoptnow", async (req, res) => {
      const adoptReq = await req.body;
      const result = await allAdoptionReqCollection.insertOne(adoptReq);
      res.json(result);
    });

    app.patch("/adoptnow/approveReq/:id", async (req, res) => {
      const { id } = await req.params;
      const result = await allAdoptionReqCollection.updateOne({ _id: new ObjectId(id) }, { $set: { status: "Approved" } });
      res.json(result);
    });

    app.patch("/adoptnow/rejectReq/:id", async (req, res) => {
      const { id } = await req.params;
      const result = await allAdoptionReqCollection.updateOne({ _id: new ObjectId(id) }, { $set: { status: "Rejected" } });
      res.json(result);
    });

    // app.patch("/adoptnow/actionReq/:id", async (req, res) => {
    //   try {
    //     const { id } = req.params;
    //     const actionReq = req.body;
    //     console.log(actionReq, "from backend");

    //     const result = await allAdoptionReqCollection.updateOne({ _id: new ObjectId(id) }, { $set: { status: "Approve" } });

    //     res.json(result);
    //   } catch (error) {
    //     console.error(error);
    //     res.status(500).json({ error: "Something went wrong" });
    //   }
    // });

    app.get("/adoptnow/:ownerEmail", async (req, res) => {
      const { ownerEmail } = await req.params;
      const result = await allAdoptionReqCollection.find({ ownerEmail }).toArray();
      res.send(result);
    });

    app.get("/all-pets", async (req, res) => {
      const result = await allPetCollection.find().toArray();
      res.send(result);
    });

    app.get("/all-pets/:petId", async (req, res) => {
      const { petId } = await req.params;
      const result = await allPetCollection.findOne({ _id: new ObjectId(petId) });
      res.send(result);
    });

    app.get("/", async (req, res) => {
      res.send("Server is ready");
    });
    app.get("/add-pet", async (req, res) => {
      res.send("This api is working");
    });
  } finally {
    //
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
