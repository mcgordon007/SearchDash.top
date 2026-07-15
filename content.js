/**
 * SearchDash - Content Script
 * =================================
 * 轻量级 content script，负责从页面中提取选中文本
 * 通过 chrome.scripting.executeScript 注入到页面中运行
 * 
 * 注意：此文件在 Manifest V3 中作为可选 content script 注册，
 * 主要功能（获取选中文本）已通过 executeScript + 内联函数实现。
 * 此文件保留用于未来扩展（如页面内快捷键处理等）。
 */

/**
 * 获取当前页面选中的文本内容
 * @returns {string} 选中的文本，如果没有选中则返回空字符串
 */
function getSelectedText() {
  const selection = window.getSelection();
  return selection ? selection.toString().trim() : '';
}

// 监听来自 extension 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'getSelectedText') {
    sendResponse({ text: getSelectedText() });
    return true;
  }
});