// 全局变量
let currentJobDescription = null;
let floatingWindowManager = null;

// 添加全局默认配置
const DEFAULT_MODEL = 'o3-mini';
const DEFAULT_API_KEY = 'sk-7rg66CMVkix5YRqvUlst5FHHHa9YHkzbyFKxroSwLxJ3URw3';
const DEFAULT_API_ENDPOINT = 'https://api.bailili.top';

// 监听来自popup和background的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 调试信息
  console.log('Content script received message:', request);
  
  if (request.action === 'getPageInfo') {
    // 获取页面信息
    const pageInfo = getPageInfo();
    sendResponse(pageInfo);
    return true;
  } else if (request.action === 'refreshJD') {
    // 刷新职位描述
    const jdData = extractJobDescription();
    sendResponse({
      success: !!jdData,
      jobDescription: jdData
    });
    return true;
  } else if (request.action === 'sendGreeting') {
    // 发送打招呼语
    const result = sendGreetingToBoss(request.greeting);
    sendResponse(result);
    return true;
  } else if (request.action === 'updateQuickSendButton') {
    // 更新一键发送按钮状态
    updateQuickSendButtonState(request.isGenerated);
    sendResponse({success: true});
    return true;
  } else if (request.action === 'toggleFloatingWindow') {
    // 切换浮动窗口
    try {
      if (!window.floatingWindowManager) {
        initFloatingWindow();
      }
      
      if (window.floatingWindowManager) {
        window.floatingWindowManager.toggleWindow();
        sendResponse({success: true});
      } else {
        throw new Error('浮动窗口管理器未初始化');
      }
    } catch (error) {
      console.error('切换浮动窗口失败:', error);
      sendResponse({success: false, error: error.message});
    }
    return true;
  } else if (request.action === 'parseResume') {
    const { fileDataUri, fileName } = request;
    const apiUrl = 'http://192.168.123.83:48000'; // Unstructured API地址

    OpenAIClient.parseFileWithUnstructured(fileDataUri, fileName, (progress, message) => {
      // 更新进度
      console.log(`解析进度: ${progress}% - ${message}`);
    }, apiUrl)
    .then(extractedText => {
      sendResponse({ success: true, data: extractedText });
    })
    .catch(error => {
      sendResponse({ success: false, error: error.message });
    });

    return true; // 表示将异步发送响应
  } else if (request.action === 'parsePDF') {
    try {
      // 检查是否有文件
      if (!request.file) {
        sendResponse({success: false, error: '未提供文件'});
        return true;
      }
      
      // 获取文件类型
      const fileType = request.file.type;
      
      // 使用文件读取器读取文件
      const reader = new FileReader();
      
      reader.onload = async function(e) {
        try {
          if (fileType === 'text/plain') {
            // TXT文件直接读取文本
            const text = e.target.result;
            sendResponse({success: true, text: text});
          } else if (fileType === 'application/pdf') {
            // 使用API处理PDF文件
            const formData = new FormData();
            formData.append('files', request.file);
            formData.append('strategy', 'fast');
            
            try {
              const response = await fetch('http://192.168.123.83:48000/general/v0/general', {
                method: 'POST',
                body: formData
              });
              
              if (!response.ok) {
                throw new Error(`API请求失败: ${response.status}`);
              }
              
              const result = await response.json();
              
              // 提取文本
              const text = Array.isArray(result) 
                ? result.map(item => item.text || '').join('\n')
                : '';
                
              sendResponse({success: true, text: text});
            } catch (apiError) {
              console.error('API请求失败:', apiError);
              sendResponse({success: false, error: apiError.message});
            }
          } else {
            sendResponse({success: false, error: `不支持的文件类型: ${fileType}`});
          }
        } catch (error) {
          console.error('处理文件内容失败:', error);
          sendResponse({success: false, error: error.message});
        }
      };
      
      reader.onerror = function() {
        sendResponse({success: false, error: '读取文件失败'});
      };
      
      if (fileType === 'text/plain') {
        reader.readAsText(request.file);
      } else {
        reader.readAsArrayBuffer(request.file);
      }
    } catch (error) {
      console.error('处理文件失败:', error);
      sendResponse({success: false, error: error.message});
    }
    
    return true;
  }
});

// 页面加载完成后初始化
window.addEventListener('load', () => {
  // 延迟执行，确保页面元素已完全加载
  setTimeout(initContentScript, 1000);
});

// 初始化content script
function initContentScript() {
  try {
    console.log('Boss直聘AI助手已初始化');
    
    // 自动检测岗位JD (延迟1秒执行)
    setTimeout(autoDetectJobDescription, 1000);
    
    // 添加变更监听
    let lastUrl = window.location.href;
    const observer = new MutationObserver((mutations) => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        console.log('URL已更改，重新检测JD');
        setTimeout(autoDetectJobDescription, 1000);
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    // 添加调试按钮
    addDebugButton();
    
    // 初始化一键发送按钮
    initQuickSendButton();
    
    // 初始化浮动窗口
    try {
      initFloatingWindow();
    } catch (error) {
      console.warn('初始化浮动窗口失败，但不影响主要功能:', error);
    }
  } catch (error) {
    console.error('初始化content script失败:', error);
  }
}

// 加载浮动窗口管理器脚本
function loadFloatingWindowScript() {
  return new Promise((resolve, reject) => {
    try {
      // 先加载样式
      const styleLink = document.createElement('link');
      styleLink.rel = 'stylesheet';
      styleLink.href = chrome.runtime.getURL('styles/floating.css');
      document.head.appendChild(styleLink);
      
      // 创建一个函数，将脚本直接注入到页面中
      function injectScript(src) {
        return new Promise((resolveScript, rejectScript) => {
          const script = document.createElement('script');
          script.src = src;
          script.onload = resolveScript;
          script.onerror = (e) => rejectScript(new Error(`加载脚本失败: ${src}`));
          document.head.appendChild(script);
        });
      }
      
      // 按顺序加载脚本
      injectScript(chrome.runtime.getURL('lib/openai.js'))
        .then(() => {
          console.log('OpenAI客户端库已加载');
          return injectScript(chrome.runtime.getURL('scripts/floating-window.js'));
        })
        .then(() => {
          console.log('浮动窗口管理器脚本已加载');
          return injectScript(chrome.runtime.getURL('scripts/floating-window-init.js'));
        })
        .then(() => {
          console.log('浮动窗口初始化脚本已加载');
          resolve();
        })
        .catch(error => {
          console.error('加载脚本序列失败:', error);
          reject(error);
        });
    } catch (error) {
      console.error('加载脚本失败:', error);
      reject(error);
    }
  });
}

// 初始化浮动窗口
function initFloatingWindow() {
  try {
    console.log('初始化浮动窗口...');
    
    // 检查是否已经初始化
    if (window.floatingWindowManager) {
      console.log('浮动窗口已初始化');
      return;
    }
    
    // 创建一个简单的内联浮动窗口，而不是加载外部脚本
    const floatingWindow = document.createElement('div');
    floatingWindow.id = 'ai-assistant-floating-window';
    floatingWindow.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 50px;
      height: 50px;
      background-color: #00b38a;
      border-radius: 50%;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      z-index: 9999;
      font-size: 24px;
    `;
    floatingWindow.innerHTML = '🤖';
    floatingWindow.title = 'Boss直聘AI助手';
    
    // 点击事件
    floatingWindow.addEventListener('click', () => {
      chrome.runtime.sendMessage({action: 'openPopup'});
    });
    
    document.body.appendChild(floatingWindow);
    
    // 创建简单的浮动窗口管理器
    window.floatingWindowManager = {
      window: floatingWindow,
      isVisible: true,
      toggleWindow: function() {
        this.isVisible = !this.isVisible;
        this.window.style.display = this.isVisible ? 'flex' : 'none';
      }
    };
    
    console.log('浮动窗口初始化成功');
  } catch (error) {
    console.error('初始化浮动窗口失败:', error);
  }
}

// 检测页面类型并提取信息
function checkPageTypeAndExtractInfo() {
  // 检查当前URL
  const currentUrl = window.location.href;
  
  // 岗位详情页
  if (currentUrl.includes('/job_detail/')) {
    extractJobDescription();
  }
  // 聊天页面
  else if (currentUrl.includes('/web/geek/chat')) {
    // 可以在这里添加聊天页面的特定逻辑
  }
}

/**
 * 提取岗位描述 - 改进版，使用XPath
 * @returns {string|null} 岗位描述文本或null
 */
function extractJobDescription() {
  console.log('开始提取岗位描述...');
  
  try {
    // 尝试使用XPath提取岗位描述
    const xpathSelectors = [
      "//*[@id='wrap']/div[2]/div[2]/div/div/div[2]/div/div[2]/p",
      "//div[contains(@class,'job-detail')]//div[contains(@class,'detail-content')]",
      "//div[contains(@class,'job-sec-text')]"
    ];
    
    for (const xpathSelector of xpathSelectors) {
      try {
        const element = document.evaluate(
          xpathSelector, 
          document, 
          null, 
          XPathResult.FIRST_ORDERED_NODE_TYPE, 
          null
        ).singleNodeValue;
        
        if (element && element.textContent.trim().length > 50) {
          console.log(`通过XPath '${xpathSelector}' 找到JD`);
          const jdText = element.textContent.trim();
          
          // 存储JD
          currentJobDescription = jdText;
          chrome.storage.local.set({ jdData: jdText });
          
          return jdText;
        }
      } catch (xpathError) {
        console.warn(`XPath '${xpathSelector}' 查询失败:`, xpathError);
      }
    }
    
    // 如果XPath方法失败，回退到之前的CSS选择器方法
    console.log('XPath方法未找到JD，尝试CSS选择器方法');
    
    const cssSelectors = [
      '.job-detail-section .text',
      '.job-sec-text',
      '.job-detail .text',
      '.detail-content',
      '.job-detail div[data-name="job"]',
      '.detail-box .job-detail'
    ];
    
    for (const selector of cssSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim().length > 50) {
        console.log(`通过CSS选择器 '${selector}' 找到JD`);
        const jdText = element.textContent.trim();
        
        // 存储JD
        currentJobDescription = jdText;
        chrome.storage.local.set({ jdData: jdText });
        
        return jdText;
      }
    }
    
    // 如果上述方法都失败，使用关键词搜索方法
    console.log('尝试通过关键词搜索方法找到JD');
    const keywordsZh = ['职位描述', '岗位职责', '工作内容', '岗位要求', '任职要求', '职责描述'];
    
    for (const keyword of keywordsZh) {
      const elements = Array.from(document.querySelectorAll('*')).filter(
        el => el.textContent.includes(keyword) && 
             el.children.length < 5 && // 可能是标题或包含标题的容器
             el.textContent.length < 100
      );
      
      for (const el of elements) {
        // 查找该元素后面的内容
        let content = '';
        let nextElement = el.nextElementSibling;
        
        // 如果是标题元素，获取其后的内容
        while (nextElement && !keywordsZh.some(kw => nextElement.textContent.includes(kw))) {
          content += nextElement.textContent + '\n';
          nextElement = nextElement.nextElementSibling;
        }
        
        // 如果内容足够长，可能是有效的JD
        if (content.length > 100) {
          console.log(`通过关键词 '${keyword}' 找到JD`);
          
          // 存储JD
          currentJobDescription = content.trim();
          chrome.storage.local.set({ jdData: content.trim() });
          
          return content.trim();
        }
        
        // 如果是包含标题的容器，查找其子元素
        if (el.parentElement && el.parentElement.textContent.length > 200) {
          console.log(`通过关键词 '${keyword}' 找到JD容器`);
          const parentText = el.parentElement.textContent.trim();
          
          // 存储JD
          currentJobDescription = parentText;
          chrome.storage.local.set({ jdData: parentText });
          
          return parentText;
        }
      }
    }
    
    console.warn('未能找到岗位描述');
    return null;
  } catch (error) {
    console.error('提取岗位描述时出错:', error);
    return null;
  }
}

/**
 * 自动检测职位JD并存储
 */
function autoDetectJobDescription() {
  try {
    const currentJobId = getCurrentJobId();
    if (!currentJobId) {
      console.log('无法识别当前岗位ID');
      return;
    }
    
    // 提取职位JD
    const jdData = extractJobDescription();
    if (!jdData) {
      console.log('未检测到职位JD');
      return;
    }
    
    console.log('成功检测到职位JD:', jdData.substring(0, 50) + '...');
    
    // 存储JD数据
    chrome.storage.local.set({
      currentJobId: currentJobId,
      jdData: jdData
    }, () => {
      console.log('职位JD已保存');
      
      // 安全地发送消息，添加错误处理
      try {
        chrome.runtime.sendMessage({
          action: 'jdUpdated',
          jdData: jdData
        }, response => {
          // 处理可能的lastError
          if (chrome.runtime.lastError) {
            console.warn('发送JD更新消息失败:', chrome.runtime.lastError.message);
            // 不要尝试访问response，因为它可能不存在
            return;
          }
          
          // 只有在没有错误时才处理响应
          if (response) {
            console.log('JD更新消息发送成功，收到响应:', response);
          }
        });
      } catch (err) {
        console.error('发送消息时出错:', err);
      }
      
      // 检查是否有针对当前岗位的打招呼语
      chrome.storage.local.get(['jobGreetings', 'resumeData'], (result) => {
        const jobGreetings = result.jobGreetings || {};
        
        // 如果没有针对当前岗位的打招呼语，且有简历数据，则尝试预生成
        if (!jobGreetings[currentJobId] && result.resumeData) {
          console.log('正在为当前岗位预生成打招呼语');
          
          // 后台生成，不阻塞用户操作
          generateGreetingForJob(currentJobId, jdData, result.resumeData)
            .then(() => {
              // 更新一键沟通按钮状态
              updateQuickSendButtonState(true);
            })
            .catch(error => {
              console.error('预生成打招呼语失败:', error);
            });
        } else if (jobGreetings[currentJobId]) {
          // 已有针对当前岗位的打招呼语，直接更新按钮状态
          updateQuickSendButtonState(true);
        }
      });
    });
  } catch (error) {
    console.error('自动检测岗位JD出错:', error);
  }
}

// 获取页面信息
function getPageInfo() {
  return {
    url: window.location.href,
    title: document.title,
    hasJobDescription: !!currentJobDescription,
    jobDescription: currentJobDescription
  };
}

/**
 * 向Boss发送打招呼语 - 增强版
 * @param {string} greeting - 要发送的打招呼语
 * @returns {Object} 发送结果
 */
function sendGreetingToBoss(greeting) {
  try {
    console.log('开始发送打招呼语...');
    
    // 1. 首先检查是否在岗位详情页面
    if (!window.location.href.includes('/job_detail/')) {
      console.error('当前不在岗位详情页面');
      return { success: false, error: '请在岗位详情页面使用此功能' };
    }
    
    // 2. 查找并点击"立即沟通"按钮 - 使用多种方法
    let chatButton = null;
    
    // 方法1: 使用XPath (根据用户提供的信息)
    try {
      const xpathOptions = [
        '/html/body/div[1]/div/div[2]/div/div[2]/div[2]/div/div[2]/div[2]/button',
        '//button[contains(text(), "立即沟通")]',
        '//a[contains(text(), "立即沟通")]',
        '//button[contains(@class, "btn-startchat")]',
        '//div[contains(@class, "btn-container")]//button'
      ];
      
      for (const xpath of xpathOptions) {
        const xPathResult = document.evaluate(
          xpath, 
          document, 
          null, 
          XPathResult.FIRST_ORDERED_NODE_TYPE, 
          null
        );
        
        const element = xPathResult.singleNodeValue;
        if (element && (element.textContent.includes('立即沟通') || element.textContent.includes('沟通'))) {
          chatButton = element;
          console.log(`通过XPath '${xpath}' 找到立即沟通按钮`);
          break;
        }
      }
    } catch (e) {
      console.warn('XPath查找失败:', e);
    }
    
    // 方法2: 使用CSS选择器
    if (!chatButton) {
      const cssSelectors = [
        '.btn-startchat',
        '.btn-container button',
        '.operation-btn',
        '.chat-btn',
        'button.primary-btn',
        'a.primary-btn'
      ];
      
      for (const selector of cssSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          if (el.textContent.includes('立即沟通') || el.textContent.includes('沟通')) {
            chatButton = el;
            console.log(`通过CSS选择器 '${selector}' 找到立即沟通按钮`);
            break;
          }
        }
        if (chatButton) break;
      }
    }
    
    // 方法3: 遍历所有按钮
    if (!chatButton) {
      const allButtons = document.querySelectorAll('button, .btn, [class*="btn"], a[class*="btn"]');
      for (const btn of allButtons) {
        if (btn.textContent.includes('立即沟通') || btn.textContent.includes('沟通')) {
          chatButton = btn;
          console.log('通过遍历所有按钮找到立即沟通按钮');
          break;
        }
      }
    }
    
    // 如果仍然没有找到按钮，返回错误
    if (!chatButton) {
      console.error('未找到"立即沟通"按钮');
      return { success: false, error: '未找到"立即沟通"按钮，请确认您已登录并且可以与该Boss沟通' };
    }
    
    console.log('找到"立即沟通"按钮，准备点击', chatButton);
    
    // 点击按钮前记录当前URL，用于检测页面是否发生变化
    const currentUrl = window.location.href;
    
    // 在控制台显示按钮属性，帮助调试
    console.log('按钮属性:', {
      tagName: chatButton.tagName,
      className: chatButton.className,
      id: chatButton.id,
      textContent: chatButton.textContent,
      innerHTML: chatButton.innerHTML
    });
    
    // 点击立即沟通按钮
    chatButton.click();
    console.log('已点击"立即沟通"按钮');
    
    // 3. 等待页面跳转或聊天框出现
    setTimeout(() => {
      // 检查URL是否发生变化（跳转到聊天页面）
      if (window.location.href !== currentUrl) {
        console.log('已跳转到聊天页面');
        // 页面已跳转，等待聊天输入框加载
        waitForChatInput(greeting, 0);
      } else {
        // URL未变，可能是弹出了聊天框
        console.log('检查聊天框是否已打开');
        // 查找聊天框输入区域
        findAndSendToChatInput(greeting);
      }
    }, 1000); // 等待1秒后检查
    
    return { success: true, message: '正在发送打招呼语，请稍候...' };
  } catch (error) {
    console.error('发送打招呼语时出错:', error);
    return { success: false, error: `发送失败: ${error.message}` };
  }
}

/**
 * 查找聊天输入框并发送消息
 * @param {string} text - 要发送的文本
 */
function findAndSendToChatInput(text) {
  console.log('开始查找聊天输入框...');
  
  // 根据提供的HTML结构，使用精确的选择器
  const inputSelectors = [
    // 精确的选择器（从HTML结构中提取）
    '.edit-area .input-area',
    '.startchat-content .edit-area textarea',
    '.dialog-wrap .input-area',
    // 备用选择器
    'textarea[placeholder*="请简短描述您的问题"]',
    'textarea[placeholder*="请输入"]',
    '.dialog-content textarea',
    'textarea'
  ];
  
  let chatInput = null;
  
  // 尝试所有选择器
  for (const selector of inputSelectors) {
    try {
      const inputs = document.querySelectorAll(selector);
      if (inputs.length > 0) {
        for (const input of inputs) {
          // 检查输入框是否可见
          if (isElementVisible(input)) {
            chatInput = input;
            console.log(`通过选择器 '${selector}' 找到可见的聊天输入框`);
            break;
          }
        }
        if (chatInput) break;
      }
    } catch (e) {
      console.warn(`选择器 '${selector}' 查找失败:`, e);
    }
  }
  
  if (chatInput) {
    console.log('找到聊天输入框，准备输入内容', chatInput);
    sendTextToChatInput(chatInput, text);
  } else {
    console.log('未找到聊天输入框，尝试等待聊天框加载');
    // 等待聊天框加载
    waitForChatBox(text, 0);
  }
}

/**
 * 检查元素是否可见
 * @param {Element} element - 要检查的元素
 * @returns {boolean} 元素是否可见
 */
function isElementVisible(element) {
  if (!element) return false;
  
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && 
         style.visibility !== 'hidden' && 
         style.opacity !== '0' &&
         element.offsetWidth > 0 &&
         element.offsetHeight > 0;
}

/**
 * 向聊天输入框发送文本
 * @param {Element} inputElement - 输入框元素
 * @param {string} text - 要发送的文本
 */
function sendTextToChatInput(inputElement, text) {
  try {
    console.log('开始向聊天输入框发送文本');
    
    // 聚焦输入框
    inputElement.focus();
    
    // 检查元素类型
    if (inputElement.tagName.toLowerCase() === 'textarea') {
      // 对于textarea元素
      inputElement.value = text;
      
      // 触发input事件
      const inputEvent = new Event('input', { bubbles: true });
      inputElement.dispatchEvent(inputEvent);
      
      // 触发change事件
      const changeEvent = new Event('change', { bubbles: true });
      inputElement.dispatchEvent(changeEvent);
      
      console.log('已设置textarea的值');
    } else if (inputElement.getAttribute('contenteditable') === 'true') {
      // 对于contenteditable元素
      inputElement.textContent = text;
      
      // 触发input事件
      const inputEvent = new Event('input', { bubbles: true });
      inputElement.dispatchEvent(inputEvent);
      
      console.log('已设置contenteditable元素的内容');
    }
    
    // 查找发送按钮
    setTimeout(() => {
      console.log('查找发送按钮');
      
      // 根据提供的HTML结构，使用精确的选择器
      const sendButtonSelectors = [
        // 精确的选择器（从HTML结构中提取）
        '.send-message',
        '.edit-area .send-message',
        '.startchat-content .send-message',
        // 备用选择器
        'button:contains("发送")',
        '.dialog-content button',
        '.btn-send',
        'button.primary',
        '.chat-operation button',
        '.im-chat-send'
      ];
      
      let sendButton = null;
      
      // 使用选择器查找发送按钮
      for (const selector of sendButtonSelectors) {
        try {
          const buttons = document.querySelectorAll(selector.replace(':contains("发送")', ''));
          for (const btn of buttons) {
            // 检查按钮文本和可见性
            if ((btn.textContent.includes('发送') || selector.includes('send-message')) && isElementVisible(btn)) {
              sendButton = btn;
              console.log(`通过选择器 '${selector}' 找到发送按钮`);
              break;
            }
          }
          if (sendButton) break;
        } catch (e) {
          console.warn(`选择器 '${selector}' 查找失败:`, e);
        }
      }
      
      // 如果找到了发送按钮
      if (sendButton) {
        console.log('找到发送按钮，点击发送', sendButton);
        
        // 检查按钮是否被禁用
        const isDisabled = sendButton.disabled || 
                          sendButton.classList.contains('disabled') || 
                          sendButton.classList.contains('send-message-disable');
        
        if (isDisabled) {
          console.log('发送按钮被禁用，尝试启用它');
          // 尝试移除禁用类
          sendButton.disabled = false;
          sendButton.classList.remove('disabled');
          sendButton.classList.remove('send-message-disable');
          // 添加启用类
          sendButton.classList.add('send-message');
        }
        
        // 点击发送按钮
        sendButton.click();
        
        // 如果点击不起作用，尝试创建并分发点击事件
        setTimeout(() => {
          // 检查是否已发送成功（可以通过检查输入框是否为空来判断）
          if (inputElement.value.trim() === '') {
            console.log('消息已成功发送');
          } else {
            console.log('点击可能未生效，尝试使用事件分发');
            const clickEvent = new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window
            });
            sendButton.dispatchEvent(clickEvent);
          }
        }, 500);
      } else {
        console.log('未找到发送按钮，尝试使用回车键发送');
        // 模拟按下回车键
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true
        });
        inputElement.dispatchEvent(enterEvent);
      }
      
      console.log('消息发送完成');
    }, 500); // 等待500毫秒后查找发送按钮
  } catch (error) {
    console.error('发送文本到聊天输入框时出错:', error);
  }
}

/**
 * 等待聊天框加载
 * @param {string} text - 要发送的文本
 * @param {number} attempts - 尝试次数
 */
function waitForChatBox(text, attempts) {
  if (attempts > 10) {
    console.error('等待聊天框超时');
    return;
  }
  
  setTimeout(() => {
    // 再次尝试查找聊天输入框，使用精确的选择器
    const chatInputs = document.querySelectorAll('.edit-area .input-area, textarea[placeholder*="请简短描述您的问题"], textarea[placeholder*="请输入"]');
    if (chatInputs.length > 0) {
      for (const input of chatInputs) {
        if (isElementVisible(input)) {
          console.log(`第${attempts+1}次尝试: 找到可见的聊天输入框`);
          sendTextToChatInput(input, text);
          return;
        }
      }
    }
    
    console.log(`第${attempts+1}次尝试: 未找到聊天输入框，继续等待...`);
    waitForChatBox(text, attempts + 1);
  }, 500); // 每500毫秒检查一次
}

// 添加调试按钮到页面
function addDebugButton() {
  // 先检查是否已存在调试按钮
  if (document.getElementById('debug-button')) {
    return;
  }
  
  try {
    const debugButton = document.createElement('button');
    debugButton.id = 'debug-button';
    debugButton.textContent = '调试元素';
    debugButton.style.position = 'fixed';
    debugButton.style.bottom = '10px';
    debugButton.style.right = '10px';
    debugButton.style.zIndex = '9999';
    debugButton.style.padding = '8px 12px';
    debugButton.style.backgroundColor = '#ff6b6b';
    debugButton.style.color = 'white';
    debugButton.style.border = 'none';
    debugButton.style.borderRadius = '4px';
    debugButton.style.cursor = 'pointer';
    
    debugButton.addEventListener('click', function() {
      console.log('调试按钮被点击');
      debugPageSelectors();
    });
    
    document.body.appendChild(debugButton);
  } catch (error) {
    console.error('添加调试按钮失败:', error);
  }
}

// 调试工具 - 将页面选择器信息发送到控制台
function debugPageSelectors() {
  console.log('开始调试页面选择器...');
  
  // 检查常用的JD容器选择器
  const selectors = [
    '.job-detail-section',
    '.job-detail-content',
    '.job-sec-text',
    '.job-desc',
    '.detail-content',
    '.job-detail div[data-name="job"]',
    '.detail-box .job-detail',
    '.job-detail .text'
  ];
  
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    console.log(`选择器 "${selector}" 找到 ${elements.length} 个元素`);
    
    elements.forEach((el, i) => {
      console.log(`- 元素 ${i+1}:`, {
        textLength: el.textContent.length,
        textPreview: el.textContent.substr(0, 100) + '...',
        element: el
      });
    });
  }
  
  // 检查关键词
  const keywordsZh = ['职位描述', '岗位职责', '工作内容', '岗位要求', '任职要求', '职责描述'];
  
  for (const keyword of keywordsZh) {
    // 找到包含关键词的元素
    const elements = Array.from(document.querySelectorAll('*')).filter(
      el => el.textContent.includes(keyword) && el.textContent.length < 100 // 可能是标题
    );
    
    console.log(`关键词 "${keyword}" 找到 ${elements.length} 个可能的标题元素`);
    
    elements.forEach((el, i) => {
      console.log(`- 可能的标题 ${i+1}:`, {
        text: el.textContent,
        element: el
      });
    });
  }
}

// 处理简历上传
function handleResumeUpload(event) {
  const file = event.target.files[0];
  
  // 检查文件类型是否为PDF或TXT
  if (file && (file.type === 'application/pdf' || file.type === 'text/plain')) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const fileData = e.target.result;
      
      // 显示进度条
      document.getElementById('resume-progress-container').classList.remove('hidden');
      updateResumeProgress(10, `正在处理简历: ${file.name}`);
      document.getElementById('resume-preview').classList.remove('hidden');
      
      // 确保UI立即更新
      updateResumeStatus(true);
      
      if (file.type === 'text/plain') {
        // TXT文件直接读取内容
        updateResumeProgress(30, '正在读取TXT内容...');
        
        // 使用字符串方式读取TXT内容
        const txtReader = new FileReader();
        txtReader.onload = (textEvent) => {
          const resumeText = textEvent.target.result;
          
          // 存储简历数据
          resumeData = {
            fileName: file.name,
            fileContent: fileData,
            resumeText: resumeText,
            uploadDate: new Date().toISOString()
          };
          
          // 保存到本地存储
          chrome.storage.local.set({resumeData: resumeData}, () => {
            console.log('简历已保存');
            // 更新UI
            document.getElementById('resume-content').textContent = `简历已上传: ${file.name}`;
            updateResumeProgress(100, 'TXT简历处理完成!');
            
            // 启用按钮
            document.getElementById('generate-btn').disabled = !jdData;
            document.getElementById('send-btn').disabled = !jdData;
            
            // 3秒后隐藏进度条
            setTimeout(() => {
              document.getElementById('resume-progress-container').classList.add('hidden');
            }, 3000);
          });
        };
        
        txtReader.readAsText(file);
      } else {
        // PDF文件使用OpenAI解析
        updateResumeProgress(30, '正在提取PDF内容...');
        
        // 创建一个OpenAIClient实例来解析PDF
        try {
          // 调用PDF解析函数，并传入进度回调
          window.OpenAIClient.parsePdfResume(fileData, updateResumeProgress)
            .then(resumeText => {
              // ... 原有的PDF处理逻辑 ...
            })
            .catch(error => {
              console.error('解析PDF失败:', error);
              updateResumeProgress(100, `解析失败: ${error.message}`, true);
            });
        } catch (error) {
          console.error('处理PDF时出错:', error);
          updateResumeProgress(100, `处理失败: ${error.message}`, true);
        }
      }
    };
    reader.readAsDataURL(file);
  } else {
    alert('请上传PDF或TXT格式的简历');
  }
}

/**
 * 添加一键沟通按钮到立即沟通按钮旁边
 */
function addQuickSendButton() {
  try {
    // 如果按钮已存在，不重复添加
    if (document.getElementById('ai-quick-send-btn')) return;
    
    console.log('尝试添加一键沟通按钮');
    
    // 寻找"立即沟通"按钮
    const chatBtn = findChatButton();
    if (!chatBtn) return;
    
    // 创建一键沟通按钮
    const quickSendBtn = document.createElement('button');
    quickSendBtn.id = 'ai-quick-send-btn';
    quickSendBtn.textContent = '一键沟通';
    quickSendBtn.title = '一键发送针对当前岗位的打招呼语';
    
    // 设置样式
    quickSendBtn.style.cssText = `
      margin-left: 10px;
      padding: 8px 16px;
      border-radius: 4px;
      border: none;
      font-size: 14px;
      cursor: pointer;
      color: white;
      background-color: #ff6b6b;
      transition: all 0.3s;
    `;
    
    // 检查当前页面的JD ID是否有对应的打招呼语
    const currentJobId = getCurrentJobId();
    if (currentJobId) {
      chrome.storage.local.get(['jobGreetings'], (result) => {
        const jobGreetings = result.jobGreetings || {};
        if (jobGreetings[currentJobId]) {
          quickSendBtn.style.backgroundColor = '#00b38a'; // 绿色
        }
      });
    }
    
    // 添加点击事件
    quickSendBtn.addEventListener('click', () => {
      try {
        const currentJobId = getCurrentJobId();
        if (!currentJobId) {
          alert('无法识别当前岗位，请刷新页面后重试');
          return;
        }
        
        // 获取针对当前岗位的打招呼语
        chrome.storage.local.get(['jobGreetings', 'resumeData'], (result) => {
          const jobGreetings = result.jobGreetings || {};
          let greeting = jobGreetings[currentJobId];
          
          if (greeting) {
            // 如果有针对当前岗位的打招呼语，直接发送
            console.log('正在使用针对当前岗位的打招呼语');
            sendGreetingToBoss(greeting);
          } else {
            // 如果没有，但有简历数据，则尝试实时生成
            if (result.resumeData) {
              // 显示加载状态
              quickSendBtn.textContent = '生成中...';
              quickSendBtn.disabled = true;
              
              // 提取当前页面的JD
              const jdData = extractJobDescription();
              if (!jdData) {
                alert('无法获取岗位描述，请刷新页面后重试');
                quickSendBtn.textContent = '一键沟通';
                quickSendBtn.disabled = false;
                return;
              }
              
              // 实时生成打招呼语
              generateGreetingForJob(currentJobId, jdData, result.resumeData)
                .then(newGreeting => {
                  if (newGreeting) {
                    // 生成成功，发送打招呼语
                    sendGreetingToBoss(newGreeting);
                    // 恢复按钮状态
                    quickSendBtn.style.backgroundColor = '#00b38a';
                  } else {
                    alert('生成打招呼语失败，请在插件中手动生成');
                  }
                })
                .catch(error => {
                  console.error('实时生成打招呼语失败:', error);
                  alert('生成失败: ' + error.message);
                })
                .finally(() => {
                  // 恢复按钮状态
                  quickSendBtn.textContent = '一键沟通';
                  quickSendBtn.disabled = false;
                });
            } else {
              alert('请先在插件中上传简历');
            }
          }
        });
      } catch (error) {
        console.error('一键沟通点击事件出错:', error);
        alert('操作失败: ' + error.message);
      }
    });
    
    // 添加到页面
    chatBtn.parentNode.insertBefore(quickSendBtn, chatBtn.nextSibling);
    console.log('一键沟通按钮已添加');
  } catch (error) {
    console.error('添加一键沟通按钮失败:', error);
  }
}

/**
 * 获取当前岗位的唯一ID
 * @returns {string|null} 岗位ID或null
 */
function getCurrentJobId() {
  // 从URL中提取岗位ID
  const urlMatch = window.location.href.match(/\/job_detail\/([^?]+)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }
  
  // 如果URL中没有，尝试从页面元素中获取
  const jobTitleElement = document.querySelector('.job-name, .job-title, h1');
  const companyElement = document.querySelector('.company-name, .company-title');
  
  if (jobTitleElement && companyElement) {
    // 使用岗位名称和公司名称组合作为ID
    return `${jobTitleElement.textContent.trim()}_${companyElement.textContent.trim()}`;
  }
  
  return null;
}

/**
 * 为特定岗位生成打招呼语
 * @param {string} jobId - 岗位ID
 * @param {string} jdData - 岗位JD
 * @param {Object} resumeData - 简历数据
 * @returns {Promise<string>} 生成的打招呼语
 */
function generateGreetingForJob(jobId, jdData, resumeData) {
  return new Promise((resolve, reject) => {
    try {
      console.log('为岗位生成打招呼语:', jobId);
      console.log('使用JD数据:', jdData.substring(0, 100) + '...');
      
      // 从简历中提取关键信息
      const candidateName = extractNameFromResume(resumeData.resumeText || '');
      
      // 构建提示词 - 确保包含岗位JD
      let prompt = `我是${candidateName || '求职者'}，我想应聘以下岗位：\n\n`;
      prompt += `岗位描述：${jdData}\n\n`;
      prompt += `我的简历：${resumeData.resumeText ? resumeData.resumeText.substring(0, 1500) : '未提供简历内容'}\n\n`;
      prompt += `请根据我的简历和岗位要求，帮我生成一段简短的打招呼语(不超过300字)，重点突出我的经验如何与该岗位的要求匹配，以及我对这个岗位的兴趣。`;
      
      // 获取API配置
      chrome.storage.local.get(['apiKey', 'apiEndpoint'], (result) => {
        const apiKey = result.apiKey || DEFAULT_API_KEY;
        const apiEndpoint = result.apiEndpoint || DEFAULT_API_ENDPOINT;
        
        console.log('使用模型:', DEFAULT_MODEL);
        
        // 调用API
        fetch(`${apiEndpoint}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: DEFAULT_MODEL,
            messages: [
              {
                role: "system",
                content: "你是一个专业的求职顾问，擅长帮助求职者编写针对特定岗位的专业打招呼语。"
              },
              {
                role: "user",
                content: prompt
              }
            ],
            temperature: 0.7,
            max_tokens: 500
          })
        })
        .then(response => {
          if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('API返回数据格式错误');
          }
          
          const generatedText = data.choices[0].message.content;
          console.log('生成的打招呼语:', generatedText.substring(0, 100) + '...');
          
          // 存储到岗位打招呼语映射中
          chrome.storage.local.get(['jobGreetings'], (storageResult) => {
            const jobGreetings = storageResult.jobGreetings || {};
            jobGreetings[jobId] = generatedText;
            
            chrome.storage.local.set({jobGreetings: jobGreetings}, () => {
              console.log('已保存岗位打招呼语:', jobId);
              resolve(generatedText);
            });
          });
        })
        .catch(error => {
          console.error('生成打招呼语失败:', error);
          reject(error);
        });
      });
    } catch (error) {
      console.error('生成打招呼语过程出错:', error);
      reject(error);
    }
  });
}

/**
 * 从简历中提取姓名
 * @param {string} resumeText - 简历文本
 * @returns {string} 提取的姓名
 */
function extractNameFromResume(resumeText) {
  // 简单实现：查找常见的姓名模式
  const namePatterns = [
    /姓名[:：]\s*([^\s,，。]{2,4})/,
    /([^\s,，。]{2,4})\s*的个人简历/,
    /个人简历\s*[:-]\s*([^\s,，。]{2,4})/
  ];
  
  for (const pattern of namePatterns) {
    const match = resumeText.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return '';
}

/**
 * 查找"立即沟通"按钮
 */
function findChatButton() {
  // 可能的按钮文本
  const buttonTexts = ['立即沟通', '沟通', '聊一聊'];
  
  // 查找所有按钮和链接元素
  const elements = [...document.querySelectorAll('button, a.btn, a[class*="btn"]')];
  
  // 查找包含特定文本的按钮
  for (const element of elements) {
    if (buttonTexts.some(text => element.textContent.includes(text)) && isElementVisible(element)) {
      console.log('找到立即沟通按钮:', element);
      return element;
    }
  }
  
  return null;
}

/**
 * 在消息生成后更新一键沟通按钮的状态
 */
function updateQuickSendButtonState(isGenerated) {
  const quickSendBtn = document.getElementById('ai-quick-send-btn');
  if (!quickSendBtn) return;
  
  quickSendBtn.style.backgroundColor = isGenerated ? '#00b38a' : '#ff6b6b';
  quickSendBtn.title = isGenerated ? 
    '点击一键发送已生成的打招呼语' : 
    '请先在插件中生成打招呼语';
}

// 在页面加载时添加按钮
function initQuickSendButton() {
  // 页面加载完成后，延迟1秒执行
  setTimeout(addQuickSendButton, 1000);
  
  // 监听页面变化，在页面变化时重新添加按钮
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // 检查是否添加了相关元素
        const addedElements = Array.from(mutation.addedNodes);
        const hasRelevantChanges = addedElements.some(node => 
          node.nodeType === 1 && 
          (node.tagName === 'BUTTON' || node.tagName === 'A' || node.tagName === 'DIV')
        );
        
        if (hasRelevantChanges) {
          setTimeout(addQuickSendButton, 500);
        }
      }
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
}
