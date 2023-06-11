const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
// middleware
app.use(express.json());
app.use(cors());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  // bearer token
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jufslxs.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const database = client.db("Photograph");
    const userCollection = database.collection("users");
    const classCollection = database.collection("class");

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });

      res.send({ token });
    });

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    // POST USER
    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log(user);
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);

      console.log("existing user", existingUser);

      if (existingUser) {
        return res.send({ message: "user already exists" });
      }

      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // GET USER
    app.get("/users", verifyJWT, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // USER EMAIL
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      console.log(email);

      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      console.log(email);

      if (req.decoded.email !== email) {
        res.send({ instructor: false });
      } else {
        const query = { email: email };
        const user = await userCollection.findOne(query);
        const result = { instructor: user?.role === "instructor" };
        res.send(result);
      }
    });

    app.get("/users/student/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      console.log(email);

      if (req.decoded.email !== email) {
        res.send({ student: false });
      } else {
        const query = { email: email };
        const user = await userCollection.findOne(query);
        const result = { student: user?.role === "student" };
        res.send(result);
      }
    });

    // UPDATE ROLE
    app.patch("/users/role/:id", async (req, res) => {
      const id = req.params.id;
      const { role } = req.body;

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: role,
        },
      };

      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.get("/instructors", async (req, res) => {
      try {
        const instructors = await userCollection
          .find({ role: "instructor" })
          .toArray();
        // const instructorIds = instructors.map((instructor) => instructor._id);

        res.send(instructors);
      } catch (error) {
        console.error("Error fetching instructor IDs:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // Class collection
    app.get("/class", async (req, res) => {
      const result = await classCollection.find().toArray();

      res.send(result);
    });

    app.post("/class", async (req, res) => {
      const newItem = req.body;
      const result = await classCollection.insertOne(newItem);
      res.send(result);
    });

    app.patch("/class/:id", async (req, res) => {
      const classId = req.params.id;
      const { status } = req.body;

      const filter = { _id: new ObjectId(classId) };
      const updateDoc = {
        $set: {
          status: status,
        },
      };

      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.post("/class/:id", async (req, res) => {
      const classId = req.params.id;
      const { feedback } = req.body;

      const filter = { _id: new ObjectId(classId) };
      const updateDoc = {
        $set: {
          feedback: feedback,
        },
      };

      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/class/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server route");
});

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`Server run on ${port}...`);
});
