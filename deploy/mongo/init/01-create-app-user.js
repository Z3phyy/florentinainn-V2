// Runs only on first start with an empty mongo-data volume.
const dbName = process.env.MONGO_APP_DATABASE || "florentinaInn";
db.getSiblingDB(dbName).createUser({
  user: process.env.MONGO_APP_USERNAME,
  pwd: process.env.MONGO_APP_PASSWORD,
  roles: [
    { role: "readWrite", db: dbName },
    { role: "dbAdmin", db: dbName },
  ],
});
