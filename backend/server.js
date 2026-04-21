import dotenv from "dotenv";
dotenv.config();

import app from "./src/app.js";

app.listen(process.env.PORT, () => {
  console.log("🚀 Servidor en puerto " + process.env.PORT);
});

console.log(process.env.DB_SERVER);