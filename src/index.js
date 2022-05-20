import { MongoClient } from "mongodb";
import find from "local-devices";
import { appConfig } from "./config";

const client = new MongoClient(appConfig.MONGO_URI);

async function notifyChange(message) {}

async function main() {
  console.log(appConfig);
  await client.connect();
  console.log("Connected successfully to database");
  const db = client.db(appConfig.MONGO_DB);

  const people = db.collection("people");
  
  await new Promise(() => {
    console.log(`Start interval`);
    setInterval(() => {
      console.log(`Checking...`);
      find().then(async (devices) => {
        const timestamp = new Date();
        const onlineMacs = devices.map((device) => device.mac);

        console.log(
          `${timestamp.toLocaleString()} Found ${devices.length} devices online`
        );

        // Check newly online people
        people
          .find({
            isOnline: false,
            mac: { $in: onlineMacs },
          })
          .toArray()
          .then((result) => {
            const nameString = result
              ?.map((person) => person.displayName)
              ?.join(", ");
            notifyChange(`Just online: ${nameString}`);
          });

        // Update online status
        people.updateMany(
          {
            isOnline: false,
            mac: { $in: onlineMacs },
          },
          {
            $set: {
              isOnline: true,
            },
          }
        );

        // Check people just offline
        people
          .find({
            isOnline: true,
            mac: { $nin: onlineMacs },
          })
          .toArray()
          .then((result) => {
            const nameString = result
              ?.map((person) => person.displayName)
              ?.join(", ");
            notifyChange(`Just offline: ${nameString}`);
          });

        // Update online status
        people.updateMany(
          {
            isOnline: true,
            mac: { $nin: onlineMacs },
          },
          {
            $set: {
              isOnline: false,
            },
          }
        );

        // Check other changes
        devices.forEach(async (device) => {
          const person = await people.findOne({ mac: device.mac });
          for (const key in device) {
            if (person && Object.hasOwnProperty.call(person, key)) {
              const currentValue = device[key];
              const previousValue = person[key];
              if (currentValue !== previousValue) {
                notifyChange(
                  `${person.displayName} changed ${key} from ${previousValue} to ${currentValue}`
                );
              }
            }
          }
          await people.updateOne(
            { mac: device.mac },
            { $set: device },
            { upsert: true }
          );
        });
      });
    }, appConfig.CHECK_INTERVAL);
  });

  return "done!";
}

main()
  .then(console.log)
  .catch(console.error)
  .finally(() => client.close());
