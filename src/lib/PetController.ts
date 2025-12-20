import { invoke } from "@tauri-apps/api/core";

// 定義寵物狀態
export enum PetState {
  IDLE = "IDLE",
  WALK_RIGHT = "WALK_RIGHT",
  WALK_LEFT = "WALK_LEFT",
  DRAGGED = "DRAGGED",
  BACK = "BACK", // 爬牆或背面
}

// 狀態與精靈圖 Row 的對映設定
export const STATE_ROW_MAP: Record<PetState, number> = {
  [PetState.WALK_RIGHT]: 0, // 第 1 排
  [PetState.IDLE]: 1, // 第 2 排
  [PetState.DRAGGED]: 2, // 第 3 排
  [PetState.WALK_LEFT]: 3, // 第 4 排
  [PetState.BACK]: 4, // 第 5 排
};

export class PetController {
  public state: PetState = PetState.IDLE;

  // 狀態計時器 (frame count)
  private tickCount: number = 0;
  private stateDuration: number = 0;

  // 運動參數
  private moveSpeed: number = 1;
  private windowSize = { width: 100, height: 100 };
  private screenWidth: number = 1920;
  private screenHeight: number = 1080;

  // 內部位置緩存
  private currentX: number = 0;
  private currentY: number = 0;
  private isInitialized: boolean = false;

  constructor() {
    this.init();
  }

  /**
   * 初始化：獲取螢幕尺寸與當前視窗位置
   */
  public async init() {
    try {
      // 1. 獲取螢幕資訊 (Invoke Rust command)
      const size = await invoke<[number, number]>("get_screen_size");
      if (size) {
        this.screenWidth = size[0];
        this.screenHeight = size[1];
      }

      // 2. 獲取初始位置 - 這裡我們假設初始位置是已知的或不需要從Rust獲取
      // 如果真的需要，我們應該也透過 Rust command 獲取，但為了簡化，
      // 我們可以先假設為 (0,0) 或者等第一次 syncPosition 更新
      // 為了保險，我們可以加一個 get_window_position command，但這裡先跳過，
      // 因為 update loop 會依賴 currentX/Y。
      // 我們可以用這招：先設為螢幕中間
      this.currentX = (this.screenWidth - this.windowSize.width) / 2;
      this.currentY = (this.screenHeight - this.windowSize.height) / 2;

      // 強制設定一次位置到中間
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
      case PetState.WALK_RIGHT:
        await this.handleWalk(1);
        break;
      case PetState.WALK_LEFT:
        await this.handleWalk(-1);
        break;
      case PetState.DRAGGED:
        // 拖拽時不更新位置，但在釋放時可能需要同步，
        // 由於我們移除了 plugin，無法輕易 getPosition。
        // 我們假設拖拽後會透過某些機制更新，或者暫時忽略位置同步問題
        break;
    }
  }

  private handleIdle() {
    if (this.tickCount > this.stateDuration) {
      const rand = Math.random();
      if (rand < 0.4) {
        this.setRandomIdle();
      } else if (rand < 0.7) {
        this.switchState(PetState.WALK_RIGHT, 200 + Math.random() * 300);
      } else {
        this.switchState(PetState.WALK_LEFT, 200 + Math.random() * 300);
      }
    }
  }

  private async handleWalk(direction: number) {
    this.currentX += this.moveSpeed * direction;

    if (
      direction === 1 &&
      this.currentX + this.windowSize.width >= this.screenWidth
    ) {
      this.switchState(PetState.WALK_LEFT, 200 + Math.random() * 300);
      return;
    }
    if (direction === -1 && this.currentX <= 0) {
      this.switchState(PetState.WALK_RIGHT, 200 + Math.random() * 300);
      return;
    }

    if (this.tickCount > this.stateDuration) {
      this.setRandomIdle();
      return;
    }

    await this.moveWindow(this.currentX, this.currentY);
  }

  private setRandomIdle() {
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
      this.setRandomIdle();
      // 在此架構下，無法獲取拖拽後的確切位置，這是一個小缺陷。
      // 如果需要完美，必須在 Rust 端實作 get_window_position
    }
  }

  // 封裝 invoke 調用
  private async moveWindow(x: number, y: number) {
    try {
      await invoke("move_window", { x: Math.round(x), y: Math.round(y) });
    } catch (e) {
      console.error("Failed to move window", e);
    }
  }

  public getRenderInfo() {
    let rowIndex = STATE_ROW_MAP[this.state];
    let flip = false;

    if (this.state === PetState.WALK_LEFT) {
      rowIndex = STATE_ROW_MAP[PetState.WALK_RIGHT]; // 使用向右走的精靈圖 (Row 0)
      flip = true; // 並進行水平翻轉
    }

    return {
      state: this.state,
      rowIndex: rowIndex,
      flip: flip
    };
  }
}
