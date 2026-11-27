// For phone development when Docker publishes only on 127.0.0.1.
// Bind the public API and playback cache to the selected private LAN address.
import { createServer, connect, isIPv4 } from "node:net";
import { createSocket } from "node:dgram";
import { once } from "node:events";

async function localAddress() {
  const route = createSocket("udp4");
  try {
    // Ask the OS for the interface of its default route without sending data.
    route.connect(9, "192.0.2.1");
    await once(route, "connect");
    return route.address().address;
  } finally {
    route.close();
  }
}

const host = process.argv[2] || await localAddress();
if (!isIPv4(host) || !/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
  throw new Error("Pass the Mac’s private Wi-Fi IPv4 address after npm run lan:bridge --");
}
for (const port of [3001, 8080]) {
  const server = createServer((client) => {
    const upstream = connect(port, "127.0.0.1");
    const close = () => { client.destroy(); upstream.destroy(); };
    client.on("error", close).on("close", close);
    upstream.on("error", close).on("close", close);
    client.pipe(upstream).pipe(client);
  });
  server.on("error", (error) => {
    console.error(`Couldn’t forward ${host}:${port}: ${error.message}`);
    process.exit(1);
  });
  server.listen(port, host, () => console.log(`Wi-Fi ${host}:${port} → localhost:${port}`));
}
