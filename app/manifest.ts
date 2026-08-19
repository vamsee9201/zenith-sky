import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zenith Sky",
    short_name: "Zenith",
    description: "Find bright satellites overhead and visible tonight.",
    start_url: "/",
    display: "standalone",
    background_color: "#050b13",
    theme_color: "#07101c",
    orientation: "portrait-primary",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
