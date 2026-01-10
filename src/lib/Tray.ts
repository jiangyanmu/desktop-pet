import { TrayIcon } from "@tauri-apps/api/tray";
import { Menu } from "@tauri-apps/api/menu";
import { defaultWindowIcon } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { exit } from "@tauri-apps/plugin-process";
import { Image } from "@tauri-apps/api/image";
// @ts-ignore
import shiroPath from "../assets/shiro.png";

const TRAY_ID = "desktop-pet-tray";
let isInitializing = false;
let isInitialized = false;

export async function initSystemTray() {
  if (isInitializing || isInitialized) return;
  isInitializing = true;

  // Prevent duplicate tray icons via API check as a secondary measure
  const existingTray = await TrayIcon.getById(TRAY_ID);
  if (existingTray) {
    isInitializing = false;
    isInitialized = true;
    return;
  }

  try {
    let icon = await defaultWindowIcon();

    if (!icon) {
      console.warn(
        "defaultWindowIcon() returned null. Falling back to local asset."
      );
      // Fallback: Load local image manually
      const response = await fetch(shiroPath);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      icon = await Image.fromBytes(uint8Array);
    }

    if (!icon) {
      throw new Error("Failed to load any icon for tray.");
    }

    // Create Menu Items
    const menu = await Menu.new({
      items: [
        {
          id: "show",
          text: "顯示寵物",
          action: async () => {
            const win = getCurrentWindow();
            await win.show();
            await win.setFocus();
          },
        },
        {
          id: "hide",
          text: "隱藏寵物",
          action: async () => {
            const win = getCurrentWindow();
            await win.hide();
          },
        },
        {
          item: "Separator",
        },
        {
          id: "quit",
          text: "完全退出",
          action: async () => {
            await exit(0);
          },
        },
      ],
    });

    // Create Tray Icon
    await TrayIcon.new({
      id: TRAY_ID,
      icon,
      menu,
      tooltip: "Desktop Pet",
      action: async (event) => {
        // Handle Left Click for Toggle
        if (event.type === "Click" && event.button === "Left") {
          const win = getCurrentWindow();
          const isVisible = await win.isVisible();
          if (isVisible) {
            await win.hide();
          } else {
            await win.show();
            await win.setFocus();
          }
        }
      },
    });

    console.log("System Tray initialized successfully");
    isInitialized = true;
  } catch (error) {
    console.error("Failed to initialize system tray:", error);
  } finally {
    isInitializing = false;
  }
}

export async function destroySystemTray() {
  try {
    const tray = await TrayIcon.getById(TRAY_ID);
    if (tray) {
      await tray.close();
      console.log("System Tray destroyed");
    }
    isInitialized = false;
    isInitializing = false;
  } catch (err) {
    console.error("Failed to destroy tray:", err);
  }
}
