import { useEffect, useRef } from "react";
import {
  Menu,
  MenuItem,
  Submenu,
  PredefinedMenuItem,
} from "@tauri-apps/api/menu";
import { exit } from "@tauri-apps/plugin-process";
import { PetRenderer } from "./lib/PetRenderer";
import { PetController, PetState } from "./lib/PetController";
import shiroImg from "./assets/shiro.png"; // 確保您已經有這張圖，或者改成您的圖片路徑
import "./App.css";

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<PetRenderer | null>(null);
  const controllerRef = useRef<PetController | null>(null);
  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      // 1. 初始化 Renderer 和 Controller
      rendererRef.current = new PetRenderer(canvasRef.current, shiroImg);
      controllerRef.current = new PetController();

      // 2. 初始 Resize
      rendererRef.current.resize();

      // 3. 定義遊戲循環
      let frameCount = 0;
      const animate = () => {
        if (rendererRef.current && controllerRef.current) {
          // A. 邏輯更新
          controllerRef.current.update();

          // B. 畫面渲染
          if (rendererRef.current.loaded) {
            rendererRef.current.clear();

            const { rowIndex, flip } = controllerRef.current.getRenderInfo();

            // 動畫幀計算
            let frameIndex = 0;
            if (controllerRef.current.state === PetState.IDLE) {
              // IDLE/PAUSE 狀態使用較慢的循環動畫
              const idleSpeed = 60;
              frameIndex = Math.floor(frameCount / idleSpeed) % 3;
            } else {
              // 其他狀態則正常循環動畫
              const animationSpeed = 30;
              frameIndex = Math.floor(frameCount / animationSpeed) % 3;
            }

            rendererRef.current.draw(
              rowIndex,
              frameIndex,
              0,
              0,
              100,
              100, // 填滿 100x100 視窗
              flip
            );
          }
        }

        frameCount++;
        requestRef.current = requestAnimationFrame(animate);
      };

      // 4. 啟動循環
      requestRef.current = requestAnimationFrame(animate);

      // 清理函數
      return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
      };
    }
  }, []);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      controllerRef.current?.endDrag();
    };

    // 額外偵測 mousemove，以防 drag_window 吞掉 mouseup 事件
    // 當滑鼠移動且左鍵未按下 (buttons === 0) 時，強制結束拖拽
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (e.buttons === 0) {
        controllerRef.current?.endDrag();
      }
    };

    window.addEventListener("mouseup", handleGlobalMouseUp);
    window.addEventListener("mousemove", handleGlobalMouseMove);
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
      window.removeEventListener("mousemove", handleGlobalMouseMove);
    };
  }, []);

  useEffect(() => {
    let menu: Menu | null = null;

    const createMenu = async () => {
      // 1. 照顧小白 Submenu
      const feedItem = await MenuItem.new({
        id: "feed",
        text: "🍗 餵食 (Feed)",
        action: () => alert("小白吃飽了！(功能待實作)"),
      });
      const bathItem = await MenuItem.new({
        id: "bath",
        text: "🛁 洗澡 (Bath)",
        action: () => alert("小白變乾淨了！(功能待實作)"),
      });
      const careSubmenu = await Submenu.new({
        text: "🍖 照顧小白...",
        items: [feedItem, bathItem],
      });

      // 2. 動作切換 Submenu
      const actionItems = await Promise.all([
        MenuItem.new({
          text: "🚶 Row 0: 行走 (Walk)",
          action: () => controllerRef.current?.setAction(PetState.WALK),
        }),
        MenuItem.new({
          text: "🧘 Row 1: 待機 (Idle)",
          action: () => controllerRef.current?.setAction(PetState.IDLE),
        }),
        MenuItem.new({
          text: "✊ Row 2: 拖拽 (Drag)",
          action: () => controllerRef.current?.setAction(PetState.DRAGGED),
        }),
        MenuItem.new({
          text: "😴 Row 3: 睡覺 (Sleep)",
          action: () => controllerRef.current?.setAction(PetState.SLEEP),
        }),
        MenuItem.new({
          text: "🍑 Row 4: 背影 (Back)",
          action: () => controllerRef.current?.setAction(PetState.BACK),
        }),
      ]);
      const actionSubmenu = await Submenu.new({
        text: "🎭 動作切換...",
        items: actionItems,
      });

      // 3. 系統功能
      const sep1 = await PredefinedMenuItem.new({ item: "Separator" });

      const settingsItem = await MenuItem.new({
        id: "settings",
        text: "⚙️ 設定 (Settings)",
        // @ts-ignore
        icon: "Settings",
        action: () => alert("設定選單 (待實作)"),
      });

      const sep2 = await PredefinedMenuItem.new({ item: "Separator" });

      const quitItem = await MenuItem.new({
        id: "quit",
        text: "🏠 送小白回家 (關閉)",
        // @ts-ignore
        icon: "Close",
        action: () => {
          exit(0);
        },
      });

      // 4. 組合主選單
      menu = await Menu.new({
        items: [careSubmenu, actionSubmenu, sep1, settingsItem, sep2, quitItem],
      });
    };

    createMenu();

    const handleContextMenu = async (e: MouseEvent) => {
      e.preventDefault();
      if (menu) {
        await menu.popup();
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, []);

  // 處理滑鼠事件
  const handleMouseDown = () => {
    controllerRef.current?.startDrag();
  };

  return (
    <div
      className="container"
      style={{
        padding: 0,
        margin: 0,
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <canvas
        ref={canvasRef}
        width={100}
        height={100}
        style={{ width: "100px", height: "100px", cursor: "grab" }}
        onMouseDown={handleMouseDown}
        data-tauri-drag-region
      />{" "}
    </div>
  );
}

export default App;
