import express from "express";
import { MongoClient } from "mongodb";
import { appConfig } from "./config.js";

const client = new MongoClient(appConfig.MONGO_URI);

const main = async () => {
  console.log(appConfig);

  const app = express();
  const port = 3000;

  app.use(express.static("src/public"));

  app.get("/visit", async (req, res) => {
    const ip = req.ip.slice(req.ip.lastIndexOf(":") + 1);
    const displayName = req.query["nickname"];

    await client.connect();
    console.log("Connected successfully to database");

    const db = client.db(appConfig.MONGO_DB);

    const people = db.collection("people");

    const result = await people.updateOne(
      {
        ip,
      },
      { $set: { displayName } },
      {
        upsert: true,
      }
    );

    console.log({ updated: result.acknowledged, ip, displayName });

    res.redirect("/welcome.html");
  });

  app.listen(port, () => {
    console.log(`App listening on port ${port}`);
  });
};

main()
  .then(console.log)
  .catch(console.error)
  .finally(() => client.close());
