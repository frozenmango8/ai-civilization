import { createServer } from "node:http";
import { handle } from "./http.js";
createServer((req, res) => {
  void handle(req, res);
}).listen(3001, "127.0.0.1", () =>
  console.log("Development API listening on port 3001"),
);
