import { TrayIcon } from "@tauri-apps/api/tray";
import { Menu, CheckMenuItem, MenuItem } from "@tauri-apps/api/menu";
import { defaultWindowIcon } from "@tauri-apps/api/app";
import { Window } from "@tauri-apps/api/window";
import { exit } from "@tauri-apps/plugin-process";
import { Image } from "@tauri-apps/api/image";
import { isEnabled, enable, disable } from "@tauri-apps/plugin-autostart";
import shiroPath from "../assets/shiro.png";

const TRAY_ID = "desktop-pet-tray";
const MAIN_WINDOW_LABEL = "main"; // 請確保與 tauri.conf.json 中的 label 一致
let isInitializing = false;
let isInitialized = false;

export async function initSystemTray() {
  if (isInitializing || isInitialized) return;
  isInitializing = true;

  // 1. 檢查托盤是否已存在
  const existingTray = await TrayIcon.getById(TRAY_ID);
  if (existingTray) {
    isInitializing = false;
    isInitialized = true;
    return;
  }

  try {
    // 2. 獲取視窗實例
    const mainWin = await Window.getByLabel(MAIN_WINDOW_LABEL);
    if (!mainWin) throw new Error("找不到主視窗");

    // 3. 處理圖標
    let icon = await defaultWindowIcon();
    if (!icon) {
      console.warn("使用備用圖標");
      const response = await fetch(shiroPath);
      const arrayBuffer = await (await response.blob()).arrayBuffer();
      icon = await Image.fromBytes(new Uint8Array(arrayBuffer));
    }

    if (!icon) throw new Error("無法加載托盤圖標");

    // 4. 建立「開機自啟動」選單
    const autostartItem = await CheckMenuItem.new({
      text: "開機自啟動",
      checked: await isEnabled(),
      action: async () => {
        const active = await isEnabled();
        active ? await disable() : await enable();
      },
    });

    // 5. 建立「顯示寵物」選單 (核心邏輯修改處)
    const toggleVisibleItem = await CheckMenuItem.new({
      text: "顯示寵物",
      checked: await mainWin.isVisible(),
      action: async () => {
        // 重要：CheckMenuItem 被點擊時，其 checked 狀態會先自動翻轉
        // 我們根據「翻轉後」的狀態來決定視窗顯示或隱藏
        const isNowChecked = await toggleVisibleItem.isChecked();
        if (isNowChecked) {
          await mainWin.show();
          await mainWin.setFocus();
        } else {
          await mainWin.hide();
        }
      },
    });

    // 6. 建立退出選單
    const quitItem = await MenuItem.new({
      id: "quit",
      text: "完全退出",
      action: async () => {
        await exit(0);
      },
    });

    // 7. 組合選單
    const menu = await Menu.new({
      items: [
        toggleVisibleItem,
        { item: "Separator" },
        autostartItem,
        { item: "Separator" },
        quitItem,
      ],
    });

    // 8. 建立托盤圖標並綁定左鍵點擊
    await TrayIcon.new({
      id: TRAY_ID,
      icon,
      menu,
      tooltip: "Desktop Pet",
      action: async (event) => {
        // 處理左鍵點擊托盤：切換顯隱並同步選單勾選狀態
        if (event.type === "Click" && event.button === "Left") {
          const isVisible = await mainWin.isVisible();
          if (isVisible) {
            await mainWin.hide();
            await toggleVisibleItem.setChecked(false); // 手動同步選單勾選
          } else {
            await mainWin.show();
            await mainWin.setFocus();
            await toggleVisibleItem.setChecked(true); // 手動同步選單勾選
          }
        }
      },
    });

    console.log("系統托盤初始化成功");
    isInitialized = true;
  } catch (error) {
    console.error("系統托盤初始化失敗:", error);
  } finally {
    isInitializing = false;
  }
}

export async function destroySystemTray() {
  try {
    const tray = await TrayIcon.getById(TRAY_ID);
    if (tray) {
      await tray.close();
      console.log("系統托盤已銷毀");
    }
    isInitialized = false;
    isInitializing = false;
  } catch (err) {
    console.error("銷毀托盤失敗:", err);
  }
}
