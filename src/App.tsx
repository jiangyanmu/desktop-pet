import { useEffect, useRef } from "react";
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
              // IDLE 狀態時隨機選擇一個影格 (0, 1, or 2)
              frameIndex = Math.floor(Math.random() * 3);
            } else {
              // 其他狀態則正常循環動畫
              const animationSpeed = 20; // 將動畫速度調整為20 (每20幀換一張圖)
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

  // 處理滑鼠事件
  const handleMouseDown = () => {
    controllerRef.current?.startDrag();
  };

  const handleMouseUp = () => {
    controllerRef.current?.endDrag();
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
      onMouseUp={handleMouseUp} // 全局釋放偵測
    >
      <canvas
        ref={canvasRef}
        width={100}
        height={100}
        style={{ width: "100px", height: "100px", cursor: "grab" }}
        onMouseDown={handleMouseDown}
      />{" "}
    </div>
  );
}

export default App;
