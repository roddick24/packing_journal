# 行李手帳 · GitHub Pages 雲端同步版

奶茶色與藍綠色的家庭行李清單，支援電腦與手機版面。純 HTML / CSS / JavaScript，不需安裝 npm 或建置。

## 功能

- 多趟旅程、家人分類與分類改名。
- 物品名稱、數量、已裝好勾選、當天再放。
- 分區：媽媽包、隨身行李、託運行李、未分配，可搭配家人與待裝條件篩選。
- 沿用舊旅程的物品與分區，勾選重新開始。加入時同名、同分類、同分區略過，或確認後取代。
- Google 登入、Firebase Firestore 跨裝置同步。
- 下載 JSON 備份（目前不含備份還原介面）。

## 先看這裡

此套程式已寫好同步流程，但沒有填入你的 Firebase 專案設定，所以**尚未連接你的雲端，也尚未實測你的帳號登入與兩台裝置同步**。完成以下設定後才會同步。未設定 Firebase 時只提供各裝置獨立的本機模式。

GitHub Pages 上的程式碼與網頁可公開，但行李資料不放在 GitHub：資料放在 Firestore，必須透過下方安全規則限制讀寫。登入按鈕本身不構成資料存取保護。

建議為行李手帳建立獨立 Firebase 專案，避免影響原本旅色手帳的資料與規則。

## 1. 設定 Firebase

1. 前往 https://console.firebase.google.com/ 建立獨立專案。
2. 在專案設定新增「網頁應用程式」，複製 `firebaseConfig` 裡的欄位，填到 `firebase-config.js`。不需啟用 Analytics。
3. Authentication → 登入方式 → 啟用 Google，選擇支援電子郵件。
4. Firestore Database → 建立預設資料庫，選擇正式環境模式。
5. 打開本套的 `firestore.rules`，把 `YOUR_GOOGLE_EMAIL@gmail.com` 改成你實際使用的 Google 信箱。將整份規則貼入此獨立專案的 Firestore → 規則，按發布。
6. Authentication → 設定 → 授權網域，加入你的 GitHub Pages 主機名稱，例如 `你的帳號.github.io`。只填主機名稱，不含 https 或專案路徑。

`firebase-config.js` 只放網頁應用程式的設定。**不要放服務帳戶 JSON、私鑰或 GitHub Token。**

如果使用既有 Firebase 專案，請勿直接覆蓋原本規則：需將 `/packingUsers/{uid}` 的限制合併，並檢查是否有其他較寬鬆的規則同時允許讀寫。正式使用前應測試其他帳號無法讀取。

## 2. 上傳到 GitHub Pages

1. 建立新的 GitHub repository，例如 `packing-journal`。
2. 解壓縮本 ZIP，進入資料夾，把裡面的檔案上傳到 repository 根目錄。`index.html` 必須在根目錄，不要多包一層資料夾。
3. GitHub repository → Settings → Pages。
4. Source 選 Deploy from a branch，Branch 選 main、資料夾選 / (root)，按 Save。
5. 等 GitHub 完成部署，使用 Pages 顯示的網址開啟網站。
6. 電腦與手機使用**相同網址、相同 Google 帳號**登入。Google 登入若被阻擋，請在 Safari 或 Chrome 外部瀏覽器開啟，並允許登入視窗。

這一套不需要 GitHub Actions，也不需要將 Sites 的 .openai 設定上傳。

## 3. 第一次使用與移轉

- 填好 Firebase 後，未登入時會暫停編輯，登入後讀取帳號的雲端清單。
- 舊 Sites 網址、本機 HTML 與 GitHub Pages 是不同來源，瀏覽器資料不會自動搬過去。若舊網址已有重要清單，請先保留舊網址與資料；本包不會自行讀取它們。
- 「匯入原本本機清單」僅能匯入**相同網址來源**舊版 `packing_journal_v1` 內的清單。按下前會確認，同 ID 旅程不覆蓋。
- 原本本機資料會保留。登入帳號資料與訪客模式使用不同儲存鍵，登出時清空畫面。

## 4. 同步方式與限制

- 連線正常時，修改會寫入雲端，另一個已登入的裝置會接收更新。
- 每次操作同步期間暫停下一次修改，避免累積尚未寫入的變更。
- 交易檢查版本，另一台裝置先更新時會暫停寫入，避免直接覆蓋。
- 連線中斷或失敗時，請先「下載備份」保留本機修改，再按「重新讀取雲端」。尚未同步的本機修改不會自動合併。
- 不提供離線編輯；需連線後操作。操作完請確認上方出現「已同步」再關閉頁面。
- 每個帳號目前以一份 Firestore 文件保存全部清單，受 Firestore 單文件 1 MiB 上限限制，適合個人使用，請避免在清單塞入大量長文。
- 手機可用瀏覽器的「加入主畫面」捷徑；此包沒有離線快取或獨立 PWA 安裝機制。

## 5. 兩台裝置驗收

1. 在電腦登入，新增「同步測試」清單，加入奶瓶 1 個，放媽媽包。
2. 在手機登入相同帳號，確認同一清單、分區、數量出現。
3. 手機勾選奶瓶，等待「已同步」，電腦確認進度更新。
4. 電腦編輯另一件物品為託運行李，在手機按「託運行李」確認。
5. 重新整理兩邊，確認資料保留。
6. 登出，確認畫面沒有帳號行李資料；使用非允許帳號登入，確認讀取遭拒。

## 檔案

| 檔案 | 用途 |
| --- | --- |
| index.html | 入口與雲端狀態列 |
| style.css | 桌機、平板與手機排版 |
| app.js | 行李清單操作 |
| cloud.js | 登入、同步、版本衝突處理 |
| firebase-config.js | 你的 Firebase 網頁設定 |
| firestore.rules | 專屬帳號存取規則 |

## 參考文件

- https://firebase.google.com/docs/web/alt-setup
- https://firebase.google.com/docs/auth/web/google-signin
- https://firebase.google.com/docs/firestore/manage-data/transactions
- https://firebase.google.com/docs/rules/basics
