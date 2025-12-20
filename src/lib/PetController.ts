import { getCurrentWindow, PhysicalPosition } from '@tauri-apps/api/window';

// 定義寵物狀態
export enum PetState {
  IDLE = 'IDLE',
  WALK_RIGHT = 'WALK_RIGHT',
  WALK_LEFT = 'WALK_LEFT',
  DRAGGED = 'DRAGGED',
  BACK = 'BACK', // 爬牆或背面
}

// 狀態與精靈圖 Row 的對映設定
export const STATE_ROW_MAP: Record<PetState, number> = {
  [PetState.WALK_RIGHT]: 0, // 第 1 排
  [PetState.IDLE]: 1,       // 第 2 排
  [PetState.DRAGGED]: 2,    // 第 3 排
  [PetState.WALK_LEFT]: 3,  // 第 4 排 (若無此排，可在渲染層判斷並翻轉 Row 0)
  [PetState.BACK]: 4,       // 第 5 排
};

export class PetController {
  public state: PetState = PetState.IDLE;
  
  // 狀態計時器 (frame count)
  private tickCount: number = 0;
  private stateDuration: number = 0;

  // 運動參數
  private moveSpeed: number = 2; // 每次移動的像素
  private windowSize = { width: 100, height: 100 }; // 視窗大小 (需與 tauri.conf.json 一致)
  private screenWidth: number = 1920; // 預設值，會動態獲取
  private screenHeight: number = 1080;

  // 內部位置緩存 (避免頻繁 await 讀取視窗位置)
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
      const appWindow = getCurrentWindow();
      
      // 1. 獲取螢幕資訊
      const monitor = await appWindow.currentMonitor();
      if (monitor) {
        this.screenWidth = monitor.size.width;
        this.screenHeight = monitor.size.height;
      }

      // 2. 獲取初始位置
      const pos = await appWindow.innerPosition();
      this.currentX = pos.x;
      this.currentY = pos.y;
      
      this.isInitialized = true;
      this.setRandomIdle();
    } catch (e) {
      console.error("Failed to init PetController:", e);
    }
  }

  /**
   * 遊戲循環 Update：每一幀呼叫一次
   */
  public async update() {
    if (!this.isInitialized) return;

    this.tickCount++;

    // 狀態機邏輯
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
        // 拖拽中不自動移動，位置由滑鼠控制，但需更新內部緩存
        await this.syncPosition(); 
        break;
    }
  }

  /**
   * IDLE 狀態邏輯：等待計時結束後隨機切換
   */
  private handleIdle() {
    if (this.tickCount > this.stateDuration) {
      // 隨機決定下一個動作：繼續發呆、向左走、或向右走
      const rand = Math.random();
      if (rand < 0.4) {
        this.setRandomIdle();
      } else if (rand < 0.7) {
        this.switchState(PetState.WALK_RIGHT, 100 + Math.random() * 200);
      } else {
        this.switchState(PetState.WALK_LEFT, 100 + Math.random() * 200);
      }
    }
  }

  /**
   * 行走邏輯：移動視窗 + 邊界檢查
   * @param direction 1 為向右，-1 為向左
   */
  private async handleWalk(direction: number) {
    // 1. 更新 X 座標
    this.currentX += this.moveSpeed * direction;

    // 2. 邊界檢查 (自動轉向)
    if (direction === 1 && this.currentX + this.windowSize.width >= this.screenWidth) {
      this.switchState(PetState.WALK_LEFT, 100 + Math.random() * 200);
      return;
    }
    if (direction === -1 && this.currentX <= 0) {
      this.switchState(PetState.WALK_RIGHT, 100 + Math.random() * 200);
      return;
    }

    // 3. 狀態時間結束檢查 (走累了停下來)
    if (this.tickCount > this.stateDuration) {
      this.setRandomIdle();
      return;
    }

    // 4. 實際移動視窗 (使用 Tauri API)
    // 為了效能，不要每一幀都 await，這裡採用 "fire and forget" 風格或者依賴佇列
    // 但在 Tauri 2 中，頻繁 setPosition 通常是可以接受的
    await getCurrentWindow().setPosition(new PhysicalPosition(Math.round(this.currentX), Math.round(this.currentY)));
  }

  /**
   * 切換到隨機時長的 IDLE
   */
  private setRandomIdle() {
    // 發呆 60 ~ 180 幀 (約 1~3 秒)
    this.switchState(PetState.IDLE, 60 + Math.random() * 120);
  }

  /**
   * 通用狀態切換
   */
  private switchState(newState: PetState, duration: number = 0) {
    this.state = newState;
    this.stateDuration = duration;
    this.tickCount = 0;
  }

  /**
   * 用戶開始拖拽 (MouseDown)
   */
  public startDrag() {
    this.state = PetState.DRAGGED;
    const appWindow = getCurrentWindow();
    // 使用 Tauri 內建的拖拽功能，這是最流暢的
    appWindow.startDragging();
  }

  /**
   * 用戶結束拖拽 (MouseUp)
   */
  public endDrag() {
    if (this.state === PetState.DRAGGED) {
      this.setRandomIdle(); // 釋放後回到發呆狀態
      this.syncPosition();  // 確保內部座標與拖拽後的視窗位置同步
    }
  }

  /**
   * 同步視窗真實位置到內部變數 (用於拖拽後)
   */
  private async syncPosition() {
    try {
      const pos = await getCurrentWindow().innerPosition();
      this.currentX = pos.x;
      this.currentY = pos.y;
    } catch (error) {
       console.error(error);
    }
  }

  /**
   * 獲取當前渲染需要的資訊
   */
  public getRenderInfo() {
    const rowIndex = STATE_ROW_MAP[this.state];
    
    // 判斷是否需要水平翻轉
    // 如果是向左走，且你想使用鏡像翻轉 (假設第4排是空的，或者你想強制鏡像第1排)
    // 但根據需求，這裡預設使用 StateMap 對應的 Row。
    // 如果你希望 WALK_LEFT 使用 "Row 0 + Flip"，可以修改這裡的邏輯：
    /*
    if (this.state === PetState.WALK_LEFT) {
       return { rowIndex: 0, flip: true };
    }
    */

    // 這裡我們假設使用獨立的 Row 3 (第4排)
    const flip = false; 

    return {
      state: this.state,
      rowIndex: rowIndex,
      flip: flip
    };
  }
}
