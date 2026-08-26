import { app } from "./src/app.js";

const PORT = 3000;
const HOST = "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`NDPortX Server running on http://${HOST}:${PORT}`);
});

export default app;
