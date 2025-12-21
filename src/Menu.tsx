import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./Menu.css";

export default function PetMenu() {
  useEffect(() => {
    const win = getCurrentWindow();

    // 失去焦點時隱藏選單 (模擬原生 Context Menu 行為)
    // const unlistenPromise = win.listen("tauri://blur", () => {
    //   win.hide();
    // });

    // return () => {
    //   unlistenPromise.then((unlisten) => unlisten());
    // };
  }, []);

  const handleQuit = async () => {
    // 隱藏選單讓 UI 反應更快
    await getCurrentWindow().hide();
    // 呼叫後端關閉程式
    await invoke("quit_app");
  };

  return (
    <div
      className="menu-container"
      // 阻止預設右鍵選單，避免在我們的選單上又跳出瀏覽器右鍵選單
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="menu-title">Desktop Pet</div>
      
      <button className="menu-item" onClick={() => alert("設定 (尚未實作)")}>
        設定...
      </button>
      
      <div className="menu-separator" />
      
      <button className="menu-item danger" onClick={handleQuit}>
        關閉小白
      </button>
    </div>
  );
}
