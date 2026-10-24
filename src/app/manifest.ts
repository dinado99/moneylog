import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "머니로그",
    short_name: "머니로그",
    description: "개인 가계부",
    start_url: "/",
    display: "standalone",
    background_color: "#fde8f0",
    theme_color: "#f4f5f7",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
