import { invoke } from "@tauri-apps/api/core";

// 定義寵物狀態
export enum PetState {
  IDLE = "IDLE",
  WALK = "WALK", // 統一行走狀態，方向由速度向量決定
  DRAGGED = "DRAGGED",
  BACK = "BACK", // 爬牆或背面
}

// 狀態與精靈圖 Render Info 的對映設定
// 這裡定義了每個狀態對應的基礎渲染資訊，翻轉邏輯將在 getRenderInfo 中根據速度動態判斷
export const STATE_RENDER_MAP: Record<
  PetState,
  { rowIndex: number; flip: boolean }
> = {
  [PetState.WALK]: { rowIndex: 0, flip: false }, // 第 1 排 (基礎行走圖)
  [PetState.IDLE]: { rowIndex: 1, flip: false }, // 第 2 排
  [PetState.DRAGGED]: { rowIndex: 2, flip: false }, // 第 3 排
  [PetState.BACK]: { rowIndex: 4, flip: false }, // 第 5 排
};

export class PetController {
  public state: PetState = PetState.IDLE;

  // 狀態計時器
  private tickCount: number = 0;
  private stateDuration: number = 0;

  // 運動參數
  private speed: number = 1.5; // 移動總速度 (像素/幀)
  private vx: number = 0; // X軸速度分量
  private vy: number = 0; // Y軸速度分量

  private windowSize = { width: 100, height: 100 };
  private screenWidth: number = 1920;
  private screenHeight: number = 1080;

  // 內部位置
  private currentX: number = 0;
  private currentY: number = 0;
  private isInitialized: boolean = false;

  constructor() {
    this.init();
  }

  public async init() {
    try {
      const size = await invoke<[number, number]>("get_screen_size");
      if (size) {
        this.screenWidth = size[0];
        this.screenHeight = size[1];
      }

      // 初始位置設在螢幕中心
      this.currentX = (this.screenWidth - this.windowSize.width) / 2;
      this.currentY = (this.screenHeight - this.windowSize.height) / 2;

      await this.moveWindow(this.currentX, this.currentY);

      this.isInitialized = true;
      console.log(
        "PetController initialized. Screen:",
        this.screenWidth,
        "x",
        this.screenHeight
      );
      this.setRandomIdle();
    } catch (e) {
      console.error("Failed to init PetController:", e);
    }
  }

  public async update() {
    if (!this.isInitialized) return;

    this.tickCount++;

    switch (this.state) {
      case PetState.IDLE:
        this.handleIdle();
        break;
      case PetState.WALK: // 使用新的 WALK 狀態
        await this.handleMove();
        break;
      case PetState.DRAGGED:
        // 拖拽時不自動更新位置，但結束拖拽後會透過 setRandomIdle 重新定位並重啟運動
        break;
    }
  }

  private handleIdle() {
    if (this.tickCount > this.stateDuration) {
      // 隨機決策：30% 繼續發呆，70% 開始移動
      if (Math.random() < 0.3) {
        this.setRandomIdle();
      } else {
        this.startRandomMove(); // 進入多角度移動
      }
    }
  }

  // 設定隨機移動方向和速度向量
  private startRandomMove() {
    // 隨機角度 0 ~ 2PI (0 ~ 360度)
    const angle = Math.random() * Math.PI * 2;

    // 隨機速度：0.5 ~ 3.5 (忽快忽慢)
    const currentSpeed = 0.5 + Math.random() * 3.0;

    this.vx = Math.cos(angle) * currentSpeed;
    this.vy = Math.sin(angle) * currentSpeed;

    // 移動 2 ~ 6 秒
    this.switchState(PetState.WALK, 120 + Math.random() * 240);
  }

  // 處理 2D 移動與碰撞反彈
  private async handleMove() {
    // 1. 更新位置
    this.currentX += this.vx;
    this.currentY += this.vy;

    // 2. X軸 邊界反彈
    if (this.currentX <= 0) {
      this.currentX = 0;
      this.vx = -this.vx; // 速度反轉
    } else if (this.currentX + this.windowSize.width >= this.screenWidth) {
      this.currentX = this.screenWidth - this.windowSize.width;
      this.vx = -this.vx;
    }

    // 3. Y軸 邊界反彈
    if (this.currentY <= 0) {
      this.currentY = 0;
      this.vy = -this.vy;
    } else if (this.currentY + this.windowSize.height >= this.screenHeight) {
      this.currentY = this.screenHeight - this.windowSize.height;
      this.vy = -this.vy;
    }

    // 4. 時間結束檢查
    if (this.tickCount > this.stateDuration) {
      this.setRandomIdle();
      return;
    }

    await this.moveWindow(this.currentX, this.currentY);
  }

  private setRandomIdle() {
    this.vx = 0; // 停止移動
    this.vy = 0;
    this.switchState(PetState.IDLE, 180 + Math.random() * 300);
  }

  private switchState(newState: PetState, duration: number = 0) {
    this.state = newState;
    this.stateDuration = duration;
    this.tickCount = 0;
  }

  public startDrag() {
    this.state = PetState.DRAGGED;
    invoke("drag_window");
  }

  public endDrag() {
    if (this.state === PetState.DRAGGED) {
      this.setRandomIdle(); // 拖拽結束後回到發呆，並等待新的隨機移動
    }
  }

  private async moveWindow(x: number, y: number) {
    try {
      await invoke("move_window", { x: Math.round(x), y: Math.round(y) });
    } catch (e) {
      console.error("Failed to move window", e);
    }
  }

  public getRenderInfo() {
    const renderInfo = { ...STATE_RENDER_MAP[this.state] }; // 複製一份基礎資訊

    // 處理行走時的朝向與圖片選擇
    if (this.state === PetState.WALK) {
      // 1. 垂直方向判斷：如果向上移動 (vy < 0)，使用背面圖 (BACK)
      //    我們可以設一個閾值，避免幾乎水平移動時閃爍，例如 vy < -0.1
      if (this.vy < -0.1) {
        renderInfo.rowIndex = STATE_RENDER_MAP[PetState.BACK].rowIndex;
      } else {
        // 向下或水平，維持 WALK (Row 0)
        renderInfo.rowIndex = STATE_RENDER_MAP[PetState.WALK].rowIndex;
      }

      // 2. 水平方向判斷：如果往左移，則翻轉圖片
      if (this.vx < 0) {
        renderInfo.flip = true;
      } else if (this.vx > 0) {
        renderInfo.flip = false;
      }
    }

    return renderInfo;
  }
}
