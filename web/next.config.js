/** @type {import('next').NextConfig} */
module.exports = {
  // The photo previews create and release blob URLs in effects; strict mode's double run would release them early.
  reactStrictMode: false,
  // A self-contained server in .next/standalone: what the Dockerfile's runtime stage copies.
  output: 'standalone',
  // Next 16 blocks its dev resources on a host it wasn't started as: the page renders blank with
  // no error in the browser. Add the LAN address here to open the dev server from a phone.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  agentRules: false,
};
