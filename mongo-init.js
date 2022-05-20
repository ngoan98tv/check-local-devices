db.people.insertMany([
  {
    mac: "e4:aa:ec:25:f7:9e",
    ip: "192.168.1.102",
    lastOnline: null,
    isOnline: false,
    name: "",
    displayName: "Administrator",
  },
]);

db.people.createIndex({ mac: 1 });
