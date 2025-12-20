這是一份為你的「小白桌面寵物」項目量身打造的 `README.md` 內容。它結合了你目前的開發進度、使用的 5x3 精靈圖資產，以及 Tauri 2.0 的技術架構。

---

# Shiro Desktop Pet (小白桌面寵物)

這是一個基於 **Tauri 2.0** 與 **TypeScript** 開發的高保真 2D 桌面寵物項目，形象採用《蠟筆小新》中的經典角色「小白」。本項目旨在實現低系統佔用、無鋸齒視覺效果以及靈動的交互行為。

## 🚀 項目架構

本項目採用現代化的桌面應用架構，將高性能後端與靈活的前端渲染相結合：

* **容器層 (Tauri 2.0)**：利用 Rust 構建，負責視窗管理、透明度處理及底層系統交互（如滑鼠穿透），相比 Electron 可節省約 80% 的內存佔用 。


* **渲染層 (TypeScript + HTML5 Canvas)**：使用 Canvas API 進行每一幀的精確繪製，並透過 `window.devicePixelRatio` 進行高 DPI 適配，消除 2D 線條鋸齒 。


* **行為層 (有限狀態機, FSM)**：管理小白的行為邏輯（如隨機漫遊、待機、被抓起），確保動作過渡的邏輯一致性 。



## 🖼️ 資產說明

本項目使用由 **Nano Banana Pro** (Gemini 2.5) 生成的 5x3 動作精靈圖 (Sprite Sheet)：

* **格式**：透明 PNG (需經去背處理)。
* **佈局**：
* Row 0: 向右行走 (Walk Right)。
* Row 1: 待機動畫 (Idle/Blink)。
* Row 2: 抓起/驚嚇狀態 (Dragged/Scared)。
* Row 3: 向左行走 (透過程式碼鏡像翻轉 Row 0)。
* Row 4: 背面視角 (Back View)。



## 🛠️ 開發清單 (To-Do List)

### 1. 資產預處理

* [ ] **精靈圖對齊**：確保 15 個動作幀在網格內中心對齊，避免播放動畫時產生不自然抖動。

### 2. 前端開發 (TypeScript)

* [ ] **高 DPI Canvas 渲染**：實施以下縮放公式以確保 4K 螢幕下的清晰度：

 。


* [ ] **動作播放器**：撰寫切圖邏輯，根據當前狀態索引 (Row) 與幀計數器 (Column) 進行裁剪繪製。
* [ ] **狀態機實施**：定義 `IDLE`、`WALK`、`DRAGGED` 等狀態，並設置隨機計時器驅動小白的桌面行為 。



### 3. Tauri 核心功能 (Rust & Config)

* [ ] **視窗透明化**：在 `tauri.conf.json` 中配置 `"transparent": true` 與 `"decorations": false` 。


* [ ] **動態點擊穿透**：實施像素級命中檢測。當滑鼠位於透明區域時，調用 `set_ignore_cursor_events(true)`；當位於小白身體時則關閉穿透，允許用戶拖拽 。


* [ ] **螢幕邊界限制**：根據用戶顯示器區域 (Work Area) 設定小白的移動邊界，防止其跑出螢幕外 。



## 📦 安裝與運行

```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run tauri dev

# 打包正式版本
npm run tauri build

```

## ⚖️ 許可聲明

本項目僅供技術學習與個人娛樂使用。小白形象版權歸原作者及版權方所有。