import { PttSite } from './ptt.js';

const MENU_CAPTIONS = new Set([
  '主功能表',
  '系統維護',
  '電子郵件',
  '聊天說話',
  '個人設定',
  '工具程式',
  '休閒遊樂',
  '量販商店',
  '休閒棋院',
  '天使公會',
  '熱門話題',
  '統計資訊',
  '金錢管理',
  '記錄管理',
  '個人檔案',
  '個人記錄',
  '名單編輯',
]);

const LIST_CAPTIONS = new Set([
  '分類看板',
  '我的最愛',
  '看板列表',
  '文章列表',
  '信件列表',
  '文摘列表',
  '系列文章',
  '精華列表',
  '精華管理',
  '標記項目',
  '休閒聊天',
  '頁面瀏覽',
  '編輯歷史',
  '已刪檔案',
  '推文管理',
  '系統檔案',
  '看板設定',
  '看板資訊',
  '偏好設定',
  '瀏覽資料',
  '註冊審核',
  '操作說明',
]);

function getFooterCaption(rowText) {
  if (!rowText) return null;
  const m = /^ (\S{2,6}) /.exec(rowText);
  return m ? m[1] : null;
}

/**
 * PTT New UI Site Profile (used by PTT2 / modern pttbbs).
 *
 * State detection checks only the left caption of the bottom footer bar.
 */
export class Ptt2Site extends PttSite {
  constructor() {
    super();
    this.name = 'ptt2';
  }

  isMenuScreen(termBuf) {
    if (!termBuf || this.isCursorParked(termBuf)) return false;
    const lastRowText = termBuf.getRowText(this.getLastRowNum(termBuf), 0, termBuf.cols);
    return MENU_CAPTIONS.has(getFooterCaption(lastRowText));
  }

  isListScreen(termBuf) {
    if (!termBuf || this.isCursorParked(termBuf)) return false;
    const lastRowNum = this.getLastRowNum(termBuf);
    if (termBuf.cur_x !== undefined && termBuf.cur_x >= 19 && termBuf.cur_y !== lastRowNum) {
      return false;
    }
    const lastRowText = termBuf.getRowText(lastRowNum, 0, termBuf.cols);
    return LIST_CAPTIONS.has(getFooterCaption(lastRowText));
  }

  isEditingScreen(termBuf) {
    const lastRowText = termBuf.getRowText(this.getLastRowNum(termBuf), 0, termBuf.cols);
    return getFooterCaption(lastRowText) === '編輯文章';
  }
}
