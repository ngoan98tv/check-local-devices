import { MongoClient } from "mongodb";
import find from "local-devices";
import { appConfig } from "./config";
import { execSync } from "child_process";

const client = new MongoClient(appConfig.MONGO_URI);

async function notifyChange(message) {
  const payload = {
    text: message,
    icon_emoji: ":robot_face:",
    username: "ARP Bot",
  };
  let retried = 0;
  let error = true;
  while (error && retried < 5) {
    try {
      const result = execSync(
        `curl -s -X POST --data-urlencode \
      'payload=${JSON.stringify(payload)}' ${appConfig.SLACK_HOOK}`
      );
      console.log(result.toString());
      error = false;
    } catch (error) {
      console.log("failed to send notification, retry...");
      error = true;
    }
    retried++;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

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
            isOnline: {
              $in: [false, null],
            },
            mac: { $in: onlineMacs },
          })
          .toArray()
          .then((result) => {
            if (!result || !result[0]) return;
            const nameString = result
              ?.map((person) => person.displayName || person.mac)
              ?.join(", ");
            notifyChange(`:radio_button: ${nameString} just online`);
          });

        // Update online status
        people.updateMany(
          {
            isOnline: {
              $in: [false, null],
            },
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
            if (!result || !result[0]) return;
            const nameString = result
              ?.map((person) => person.displayName || person.mac)
              ?.join(", ");
            notifyChange(`:red_circle: ${nameString} just offline`);
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
                  `:warning: ${person.displayName} change ${key} from ${previousValue} to ${currentValue}`
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
