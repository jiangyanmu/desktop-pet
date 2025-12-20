export class PetRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private image: HTMLImageElement;
  private isLoaded: boolean = false;
  
  // 精靈圖設定
  private readonly rows: number = 5;
  private readonly cols: number = 3;
  private spriteWidth: number = 0;
  private spriteHeight: number = 0;

  constructor(canvas: HTMLCanvasElement, imageUrl: string) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not get 2D context from canvas');
    }
    this.ctx = context;

    // 初始化圖片
    this.image = new Image();
    this.image.src = imageUrl;
    this.image.onload = () => {
      this.isLoaded = true;
      // 計算單個 sprite 的寬高
      this.spriteWidth = this.image.width / this.cols;
      this.spriteHeight = this.image.height / this.rows;
      // 圖片加載完成後，執行一次 resize 確保解析度正確
      this.resize(); 
    };
  }

  /**
   * 處理高 DPI (Retina/4K) 螢幕適配
   * 這會調整 Canvas 的 buffer size，但保持 CSS display size 不變
   */
  public resize() {
    // 獲取視窗的 DPR，預設為 1
    const dpr = window.devicePixelRatio || 1;
    
    // 獲取 Canvas 在 CSS 中的顯示大小 (BoundingClientRect)
    // 如果 Canvas 還沒上 DOM，可能需要外部傳入寬高，這裡假設 Canvas 已經 layout
    const rect = this.canvas.getBoundingClientRect();
    
    // 如果 rect 為 0 (例如 display: none)，則不執行
    if (rect.width === 0 || rect.height === 0) return;

    // 設定 Canvas 的真實像素大小 (Buffer Size)
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;

    // 縮放繪圖上下文，讓我們後續的 draw 指令可以使用 CSS 像素坐標
    this.ctx.scale(dpr, dpr);

    // [抗鋸齒處理] 重要：每次調整 Canvas 大小後，Context 屬性會重置，需重新設定
    // 關閉圖片平滑處理，確保像素圖 (Pixel Art) 邊緣銳利
    this.ctx.imageSmoothingEnabled = false; 
  }

  /**
   * 清除畫布
   */
  public clear() {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);
    this.ctx.clearRect(0, 0, width, height);
  }

  /**
   * 繪製指定動作的指定影格
   * @param actionIndex 動作列索引 (0-4)
   * @param frameIndex 動畫幀索引 (0-2)
   * @param x 目標繪製位置 X
   * @param y 目標繪製位置 Y
   * @param width 目標繪製寬度
   * @param height 目標繪製高度
   * @param flip 是否水平翻轉 (例如向左走)
   */
  public draw(
    actionIndex: number, 
    frameIndex: number, 
    x: number, 
    y: number, 
    width: number, 
    height: number, 
    flip: boolean = false
  ) {
    if (!this.isLoaded) return;

    // 來源圖片的切片座標 (Source Rectangle)
    // 確保索引不超出範圍
    const safeActionIndex = Math.max(0, Math.min(actionIndex, this.rows - 1));
    const safeFrameIndex = Math.max(0, Math.min(frameIndex, this.cols - 1));

    const sx = safeFrameIndex * this.spriteWidth;
    const sy = safeActionIndex * this.spriteHeight;

    this.ctx.save(); // 保存當前狀態 (包含 transform)

    if (flip) {
      // [水平翻轉處理]
      // 1. 移動原點到圖片的右側邊緣 (x + width)
      this.ctx.translate(x + width, y);
      // 2. 水平縮放 -1，實現鏡像
      this.ctx.scale(-1, 1);
      // 3. 在 (0, 0) 繪製圖片。
      //    因為座標軸已經翻轉且移動，這裡的 (0,0) 其實是原來的右上角，
      //    向右畫 (width) 其實是向原來的左邊畫。
      this.ctx.drawImage(
        this.image,
        sx, sy, this.spriteWidth, this.spriteHeight, // Source
        0, 0, width, height                          // Dest (相對座標)
      );
    } else {
      // [正常繪製]
      this.ctx.drawImage(
        this.image,
        sx, sy, this.spriteWidth, this.spriteHeight, // Source
        x, y, width, height                          // Dest
      );
    }

    this.ctx.restore(); // 恢復狀態，避免影響下一次繪製
  }

  /**
   * 檢查圖片是否已加載
   */
  public get loaded(): boolean {
    return this.isLoaded;
  }
}
