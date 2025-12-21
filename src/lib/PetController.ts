import { invoke } from "@tauri-apps/api/core";

// 定義寵物狀態
export enum PetState {
  IDLE = "IDLE",
  WALK = "WALK",
  DRAGGED = "DRAGGED",
  SLEEP = "SLEEP",
  BACK = "BACK",
}

// 狀態與精靈圖 Render Info 對映
export const STATE_RENDER_MAP: Record<
  PetState,
  { rowIndex: number; flip: boolean }
> = {
  [PetState.WALK]: { rowIndex: 0, flip: false },
  [PetState.IDLE]: { rowIndex: 1, flip: false },
  [PetState.DRAGGED]: { rowIndex: 2, flip: false },
  [PetState.SLEEP]: { rowIndex: 3, flip: false },
  [PetState.BACK]: { rowIndex: 4, flip: false },
};

export class PetController {
  public state: PetState = PetState.IDLE;

  private tickCount: number = 0;
  private stateDuration: number = 0;

  private vx: number = 0; // X軸速度
  private vy: number = 0; // Y軸速度
  private targetSpeed: number = 0; // 目標速度
  private speedSmooth: number = 0.05; // 緩動因子
  private directionAngle: number = 0; // 移動方向角度

  private windowSize = { width: 100, height: 100 };
  private screenWidth: number = 1920;
  private screenHeight: number = 1080;

  private currentX: number = 0;
  private currentY: number = 0;
  private isInitialized: boolean = false;

  private dragInterval: number | null = null; // 拖拽同步定時器

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
      case PetState.WALK:
        this.updateVelocitySmooth();
        await this.handleMove();
        break;
      case PetState.DRAGGED:
        // 拖拽期間由 dragInterval 更新位置
        break;
    }
  }

  private handleIdle() {
    if (this.tickCount > this.stateDuration) {
      if (Math.random() < 0.3) {
        this.setRandomIdle();
      } else {
        this.startRandomMove();
      }
    }
  }

  // 隨機移動方向 + 目標速度
  private startRandomMove() {
    this.directionAngle = Math.random() * Math.PI * 2;
    this.targetSpeed = 0.5 + Math.random() * 3.0;
    this.vx = Math.cos(this.directionAngle) * 0;
    this.vy = Math.sin(this.directionAngle) * 0;

    this.switchState(PetState.WALK, 120 + Math.random() * 240);
  }

  // 平滑逼近目標速度
  private updateVelocitySmooth() {
    const currentSpeed = Math.sqrt(this.vx ** 2 + this.vy ** 2);
    const speedDiff = this.targetSpeed - currentSpeed;
    const speedChange = speedDiff * this.speedSmooth;
    const newSpeed = currentSpeed + speedChange;

    this.vx = Math.cos(this.directionAngle) * newSpeed;
    this.vy = Math.sin(this.directionAngle) * newSpeed;
  }

  private async handleMove() {
    this.currentX += this.vx;
    this.currentY += this.vy;

    // X軸邊界反彈
    if (this.currentX <= 0) {
      this.currentX = 0;
      this.vx = -this.vx;
      this.directionAngle = Math.atan2(this.vy, this.vx);
    } else if (this.currentX + this.windowSize.width >= this.screenWidth) {
      this.currentX = this.screenWidth - this.windowSize.width;
      this.vx = -this.vx;
      this.directionAngle = Math.atan2(this.vy, this.vx);
    }

    // Y軸邊界反彈
    if (this.currentY <= 0) {
      this.currentY = 0;
      this.vy = -this.vy;
      this.directionAngle = Math.atan2(this.vy, this.vx);
    } else if (this.currentY + this.windowSize.height >= this.screenHeight) {
      this.currentY = this.screenHeight - this.windowSize.height;
      this.vy = -this.vy;
      this.directionAngle = Math.atan2(this.vy, this.vx);
    }

    // 時間結束
    if (this.tickCount > this.stateDuration) {
      this.setRandomIdle();
      return;
    }

    await this.moveWindow(this.currentX, this.currentY);
  }

  private setRandomIdle() {
    this.vx = 0;
    this.vy = 0;
    this.targetSpeed = 0;
    this.switchState(PetState.IDLE, 180 + Math.random() * 300);
  }

  private switchState(newState: PetState, duration: number = 0) {
    this.state = newState;
    this.stateDuration = duration;
    this.tickCount = 0;
  }

  public setAction(newState: PetState) {
    this.vx = 0;
    this.vy = 0;
    this.targetSpeed = 0;
    this.switchState(newState);
    console.log(`Action switched to: ${newState}`);
  }

  // 拖拽開始
  public startDrag() {
    if (this.dragInterval) return; // 已經在拖拽，直接返回

    this.state = PetState.DRAGGED;

    // 同步視窗位置
    this.dragInterval = setInterval(async () => {
      try {
        const pos: [number, number] = await invoke("get_window_position");
        if (pos) {
          this.currentX = pos[0];
          this.currentY = pos[1];
        }
        console.log("Dragging, position:", pos);
      } catch (e) {
        console.error("Failed to get window position during drag:", e);
      }
    }, 16);

    // 全局監聽滑鼠放開，結束拖拽
    const onMouseUp = async () => {
      await this.endDrag();
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mouseup", onMouseUp);
  }

  // 拖拽結束
  // 修改為 async，因為我們需要等待 invoke 的結果
  public async endDrag() {
    if (this.state === PetState.DRAGGED) {
      // 1. 在結束拖曳時，強制獲取一次視窗的「最終真實位置」
      try {
        const pos: [number, number] = await invoke("get_window_position");
        if (pos) {
          this.currentX = pos[0];
          this.currentY = pos[1];
          console.log("Drag ended, position synced to:", pos);
        }
      } catch (e) {
        console.error("Failed to sync window position on drag end:", e);
      }

      // 2. 清除定時器
      if (this.dragInterval) {
        clearInterval(this.dragInterval);
        this.dragInterval = null;
      }

      // 3. 恢復狀態
      this.setRandomIdle();
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
    const renderInfo = { ...STATE_RENDER_MAP[this.state] };

    if (this.state === PetState.WALK) {
      // 垂直方向：往上用背面圖
      if (this.vy < -0.1) {
        renderInfo.rowIndex = STATE_RENDER_MAP[PetState.BACK].rowIndex;
      } else {
        renderInfo.rowIndex = STATE_RENDER_MAP[PetState.WALK].rowIndex;
      }

      // 水平方向翻轉
      if (this.vx < 0) renderInfo.flip = true;
      else if (this.vx > 0) renderInfo.flip = false;
    }

    return renderInfo;
  }
}
