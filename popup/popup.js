import { 
  DEFAULT_MODEL,
  DEFAULT_API_KEY,
  DEFAULT_API_ENDPOINT,
  DEFAULT_STYLE_PROMPTS,
  getVersion
} from '../lib/env.js';

// 全局变量
let resumeData = null;
let jdData = null;

// 在popup.js顶部添加调试日志函数
function logDebug(message, data) {
  const timestamp = new Date().toISOString().substring(11, 23);
  console.log(`[${timestamp}] ${message}`, data || '');
}

/**
 * 安全地向标签页发送消息，处理可能的错误
 */
function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.sendMessage(tabId, message, response => {
        if (chrome.runtime.lastError) {
          console.warn('消息发送失败:', chrome.runtime.lastError.message);
          resolve({error: chrome.runtime.lastError.message});
        } else {
          resolve(response);
        }
      });
    } catch (err) {
      console.error('发送消息出错:', err);
      resolve({error: err.message});
    }
  });
}

// 这里只保留一个初始化UI的函数，合并所有功能
function initUI() {
  console.log('初始化UI...');
  
  // 初始化版本号显示
  const version = getVersion();
  const versionDisplay = document.getElementById('version-display');
  if (versionDisplay) {
    versionDisplay.textContent = `v${version}`;
  }
  
  // 初始化关于页面的版本号
  const aboutVersion = document.getElementById('about-version');
  if (aboutVersion) {
    aboutVersion.textContent = version;
  }
  
  // 上传简历按钮
  document.getElementById('upload-btn').addEventListener('click', () => {
    document.getElementById('resume-upload').click();
  });
  
  // 简历文件上传处理
  document.getElementById('resume-upload').addEventListener('change', handleResumeUpload);
  
  // 刷新JD按钮
  document.getElementById('refresh-jd-btn').addEventListener('click', refreshJobDescription);
  
  // 生成打招呼语按钮
  const generateBtn = document.getElementById('generate-btn');
  generateBtn.addEventListener('click', generateGreeting);
  // 根据是否有简历和JD数据来设置按钮状态
  generateBtn.disabled = !(resumeData && jdData);
  
  // 发送按钮
  document.getElementById('send-btn').addEventListener('click', sendGreeting);
  
  // 设置按钮
  document.getElementById('settings-btn').addEventListener('click', showSettings);
  
  // 关闭设置模态框
  document.querySelector('.close-btn').addEventListener('click', hideSettings);
  
  // 保存设置表单
  document.getElementById('settings-form').addEventListener('submit', saveSettings);
  
  // 添加文本提交按钮事件监听
  document.getElementById('submit-text-btn').addEventListener('click', handleResumeTextSubmit);
  
  // API测试按钮
  document.getElementById('test-api-btn').addEventListener('click', testApiConnection);
  
  // 模型名称输入框监听
  document.getElementById('model-name').addEventListener('input', function(e) {
    const newModel = e.target.value.trim();
    if (newModel) {
      document.getElementById('current-model').textContent = `将更改为: ${newModel}`;
    } else {
      // 如果输入框为空，显示当前存储的模型
      chrome.storage.local.get(['model'], (result) => {
        const currentModel = result.model || "o3-mini";
        document.getElementById('current-model').textContent = `当前模型: ${currentModel}`;
      });
    }
  });
  
  // 初始化风格提示词
  initializeStylePrompts();
  
  // 设置选项卡切换
  const tabButtons = document.querySelectorAll('.settings-tab-btn');
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      console.log('选项卡切换:', this.getAttribute('data-tab'));
      // 移除所有活动状态
      tabButtons.forEach(btn => btn.classList.remove('active'));
      
      // 隐藏所有内容
      document.querySelectorAll('.settings-tab-content').forEach(content => {
        content.style.display = 'none';
      });
      
      // 激活当前选项卡
      this.classList.add('active');
      const tabId = this.getAttribute('data-tab');
      
      // 显示对应内容
      document.getElementById(`${tabId}-tab`).style.display = 'block';
      
      // 加载风格设置
      if (tabId === 'styles') {
        loadStylePrompts();
      }
    });
  });
  
  // 保存风格按钮
  document.getElementById('save-styles-btn').addEventListener('click', saveStylePrompts);
  
  // 添加恢复默认按钮事件监听
  document.getElementById('reset-styles-btn')?.addEventListener('click', resetStylePrompts);
  
  // 设置风格圆点点击事件
  document.querySelectorAll('.style-dot').forEach(dot => {
    dot.addEventListener('click', function() {
      // 移除所有活动状态
      document.querySelectorAll('.style-dot').forEach(d => d.classList.remove('active'));
      // 添加当前活动状态
      this.classList.add('active');
      
      const selectedIndex = parseInt(this.dataset.index);
      // 更新当前编辑的风格索引
      document.getElementById('current-style-name').dataset.index = selectedIndex;
      // 加载并显示选中的风格
      loadAndDisplayStylePrompts();
    });
  });
  
  // 添加恢复默认设置按钮事件监听
  document.getElementById('factory-reset-btn')?.addEventListener('click', factoryReset);
  
  // 监听消息内容变化
  const messageContent = document.getElementById('message-content');
  const sendBtn = document.getElementById('send-btn');
  
  messageContent.addEventListener('input', function() {
    const text = this.value.trim();
    // 如果文本少于5个字,禁用发送按钮
    sendBtn.disabled = text.length < 5;
    
    // 更新按钮样式
    if (text.length < 5) {
      sendBtn.title = '打招呼语至少需要5个字';
      sendBtn.style.opacity = '0.5';
    } else {
      sendBtn.title = '发送打招呼语';
      sendBtn.style.opacity = '1';
    }
    
    // 保存当前编辑的内容
    chrome.storage.local.set({
      messageContent: text,
      currentJobGreeting: text
    });
  });
  
  // 加载已保存的消息内容
  chrome.storage.local.get(['messageContent'], (result) => {
    if (result.messageContent) {
      messageContent.value = result.messageContent;
      // 触发input事件以更新按钮状态
      messageContent.dispatchEvent(new Event('input'));
    }
  });
  
  // 监听来自content script的消息更新
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateMessageContent' && request.content) {
      messageContent.value = request.content;
      // 触发input事件以更新按钮状态
      messageContent.dispatchEvent(new Event('input'));
    }
  });
  
  // 在initUI函数中添加风格选择器的事件监听
  const styleSelector = document.getElementById('message-style');
  if (styleSelector) {
    // 加载保存的风格选择
    chrome.storage.local.get(['selectedStyle'], (result) => {
      if (result.selectedStyle) {
        styleSelector.value = result.selectedStyle;
      }
    });

    // 监听风格选择变化
    styleSelector.addEventListener('change', function() {
      const selectedStyle = this.value;
      // 保存选择的风格
      chrome.storage.local.set({ selectedStyle: selectedStyle }, () => {
        console.log('已保存选中的风格:', selectedStyle);
      });
    });
  }
  
  console.log('UI初始化完成');
}

// 确保在DOM完全加载后初始化UI
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM已加载，正在初始化...');
  initUI();
  
  // 延迟执行可能需要与content script通信的操作
  setTimeout(() => {
    loadStoredData();
    checkCurrentPage();
  }, 500);
});

// 加载存储的数据
function loadStoredData() {
  chrome.storage.local.get(['resumeData', 'jdData', 'apiKey', 'apiEndpoint', 'model'], (result) => {
    // 加载简历数据
    if (result.resumeData) {
      resumeData = result.resumeData;
      updateResumeStatus(true, result.resumeData.resumeText);
      document.getElementById('resume-content').textContent = 
        `简历已加载: ${result.resumeData.fileName || '手动输入的简历'}`;
    }
    
    // 加载JD数据
    if (result.jdData) {
      jdData = result.jdData;
      updateJdStatus(true);
      document.getElementById('jd-content').textContent = result.jdData;
    }
    
    // 更新生成按钮状态
    const generateBtn = document.getElementById('generate-btn');
    if (generateBtn) {
      generateBtn.disabled = !(resumeData && jdData);
    }
    
    // 设置默认模型（仅当没有保存的模型时）
    if (!result.model) {
      // 将默认模型设置为o3-mini
      chrome.storage.local.set({ model: DEFAULT_MODEL });
    }
    
    // 更新主界面的模型显示
    const currentModel = result.model || DEFAULT_MODEL;
    if (document.getElementById('model-badge')) {
      document.getElementById('model-badge').textContent = `模型: ${currentModel}`;
    }
  });
}

/**
 * 检查当前页面是否为Boss直聘岗位页面
 */
function checkCurrentPage() {
  chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
    if (!tabs[0]) return;
    
    const tab = tabs[0];
    
    // 检查URL是否为Boss直聘网站
    if (!tab.url || !tab.url.includes('zhipin.com')) {
      document.getElementById('not-boss-warning').classList.remove('hidden');
      return;
    }
    
    try {
      // 使用改进的消息发送函数
      const response = await sendMessageToTab(tab.id, {action: 'getPageInfo'});
      
      if (response && response.error) {
        console.warn('无法获取页面信息:', response.error);
        // 即使有错误也不显示警告，因为可能只是content script还没加载
        return;
      }
      
      if (response && response.isJobPage) {
        document.getElementById('job-page-detected').classList.remove('hidden');
        
        // 如果有JD数据，自动刷新
        if (!jdData) {
          refreshJobDescription();
        }
      }
    } catch (error) {
      console.error('检查当前页面时出错:', error);
    }
  });
}

// 处理简历上传
function handleResumeUpload(event) {
  const file = event.target.files[0];
  if (!file) {
    console.log('没有选择文件');
    return;
  }
  
  console.log('处理上传文件:', file.name, '类型:', file.type);
  
  // 显示进度条
  document.getElementById('resume-progress-container').classList.remove('hidden');
  updateResumeProgress(10, '正在处理简历...');
  document.getElementById('resume-preview').classList.remove('hidden');
  
  // 如果是TXT文件，直接在popup中处理
  if (file.type === 'text/plain') {
    try {
      updateResumeProgress(30, '正在读取TXT文件...');
      
      const reader = new FileReader();
      
      reader.onload = function(e) {
        try {
          const text = e.target.result;
          console.log('TXT文件读取成功，长度:', text.length);
          
          updateResumeProgress(60, '正在保存简历数据...');
          
          // 存储简历数据
          resumeData = {
            fileName: file.name,
            fileContent: null, // 不存储文件内容
            resumeText: text,
            uploadDate: new Date().toISOString()
          };
          
          // 保存到本地存储
          chrome.storage.local.set({resumeData: resumeData}, () => {
            if (chrome.runtime.lastError) {
              console.error('保存简历失败:', chrome.runtime.lastError);
              updateResumeProgress(0, '保存失败: ' + chrome.runtime.lastError.message, true);
              return;
            }
            
            console.log('简历已保存');
            // 更新UI
            document.getElementById('resume-content').textContent = `简历已上传: ${file.name}`;
            updateResumeProgress(100, '简历处理完成!');
            updateResumeStatus(true, text);
            
            // 更新生成按钮状态
            const generateBtn = document.getElementById('generate-btn');
            if (generateBtn) {
              generateBtn.disabled = !(jdData && resumeData);
            }
            
            // 3秒后隐藏进度条
            setTimeout(() => {
              document.getElementById('resume-progress-container').classList.add('hidden');
            }, 3000);
          });
        } catch (innerError) {
          console.error('处理文件内容失败:', innerError);
          updateResumeProgress(0, '处理失败: ' + innerError.message, true);
        }
      };
      
      reader.onerror = function(e) {
        console.error('读取文件失败:', e);
        updateResumeProgress(0, '读取文件失败', true);
      };
      
      reader.readAsText(file);
    } catch (error) {
      console.error('处理TXT文件失败:', error);
      updateResumeProgress(0, '处理文件失败: ' + error.message, true);
    }
    return;
  }
  
  // 其他文件类型处理逻辑...
  alert('目前仅支持TXT格式的简历');
  updateResumeProgress(0, '不支持的文件格式', true);
}

/**
 * 刷新岗位描述，添加更强大的错误处理和重试机制
 */
function refreshJobDescription(retryCount = 0) {
  const maxRetries = 5; // 增加最大重试次数
  
  // 安全地更新DOM
  const jdStatus = document.getElementById('jd-status');
  const jdStatusDot = document.getElementById('jd-status-dot');
  
  if (jdStatus) jdStatus.textContent = '正在获取岗位描述...';
  if (jdStatusDot) jdStatusDot.className = 'status-dot pending';
  
  chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
    if (!tabs || !tabs[0]) {
      if (jdStatus) jdStatus.textContent = '无法获取当前标签页';
      if (jdStatusDot) jdStatusDot.className = 'status-dot error';
      return;
    }
    
    try {
      // 检查是否是Boss直聘页面
      if (!tabs[0].url || !tabs[0].url.includes('zhipin.com')) {
        if (jdStatus) jdStatus.textContent = '当前不是Boss直聘页面';
        if (jdStatusDot) jdStatusDot.className = 'status-dot error';
        
        // 显示警告
        const warningBox = document.getElementById('not-boss-warning');
        if (warningBox) warningBox.classList.remove('hidden');
        
        return;
      }
      
      // 使用增强的消息发送函数
      const response = await sendMessageWithRetry(tabs[0].id, {action: 'refreshJD'}, 3);
      
      if (response && response.error) {
        console.warn('刷新JD失败:', response.error);
        
        // 如果是连接错误且未超过最大重试次数，则重试
        if ((response.error.includes('connection') || 
             response.error.includes('port closed')) && 
            retryCount < maxRetries) {
          
          console.log(`尝试重新刷新JD (${retryCount + 1}/${maxRetries})...`);
          
          if (jdStatus) {
            jdStatus.textContent = `重试中 (${retryCount + 1}/${maxRetries})...`;
          }
          
          // 增加重试延迟时间
          setTimeout(() => refreshJobDescription(retryCount + 1), 800);
          return;
        }
        
        // 最终失败
        if (jdStatus) jdStatus.textContent = '获取失败，请刷新页面后重试';
        if (jdStatusDot) jdStatusDot.className = 'status-dot error';
        return;
      }
      
      if (response && response.success && response.jobDescription) {
        updateJobDescription(response.jobDescription);
      } else {
        if (jdStatus) jdStatus.textContent = '未能获取岗位JD';
        if (jdStatusDot) jdStatusDot.className = 'status-dot error';
      }
    } catch (error) {
      console.error('刷新JD时出错:', error);
      
      if (jdStatus) jdStatus.textContent = '获取过程出错';
      if (jdStatusDot) jdStatusDot.className = 'status-dot error';
      
      // 添加详细错误日志
      console.log('详细错误信息:', {
        message: error.message,
        stack: error.stack,
        tabInfo: tabs[0].url
      });
    }
  });
}

/**
 * 增强的消息发送函数，支持多次重试
 */
function sendMessageWithRetry(tabId, message, maxRetries = 3, delay = 500) {
  let retryCount = 0;
  
  return new Promise((resolve) => {
    function attemptSend() {
      try {
        chrome.tabs.sendMessage(tabId, message, response => {
          if (chrome.runtime.lastError) {
            console.warn(`发送消息失败 (尝试 ${retryCount+1}/${maxRetries}):`, chrome.runtime.lastError.message);
            
            if (retryCount < maxRetries) {
              retryCount++;
              // 延迟重试
              setTimeout(attemptSend, delay * retryCount);
            } else {
              // 达到最大重试次数
              resolve({error: chrome.runtime.lastError.message});
            }
          } else {
            // 成功收到响应
            resolve(response || {success: true});
          }
        });
      } catch (err) {
        console.error('发送消息时发生异常:', err);
        
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(attemptSend, delay * retryCount);
        } else {
          resolve({error: err.message});
        }
      }
    }
    
    // 首次尝试
    attemptSend();
  });
}

// 生成打招呼语
function generateGreeting() {
  const messageContent = document.getElementById('message-content');
  const progressContainer = document.getElementById('message-progress-container');
  const messageStyle = document.getElementById('message-style').value;
  
  if (!resumeData) {
    alert('请先上传简历');
    return;
  }
  
  if (!jdData) {
    alert('请先获取岗位JD');
    return;
  }
  
  // 显示进度条
  progressContainer.classList.remove('hidden');
  updateMessageProgress(10, '正在生成打招呼语...');
  
  // 从简历中提取关键信息
  const candidateName = extractNameFromResume(resumeData.resumeText || '');
  
  // 获取选择的风格
  const styleId = document.getElementById('message-style').value;
  
  // 从存储中获取对应的提示词
  chrome.storage.local.get(['stylePrompts'], async function(result) {
    const stylePrompts = result.stylePrompts || DEFAULT_STYLE_PROMPTS;
    const selectedStyle = stylePrompts.find(style => style.id === styleId) || stylePrompts[0];
    
    // 构建提示词
    const prompt = `
      职位描述: ${jdData}
      
      我的简历: ${resumeData.resumeText}
      
      风格要求: ${selectedStyle.prompt}
      
      请根据我的简历和职位描述，生成一段打招呼语，帮助我与招聘者建立联系。
    `;
    
    console.log('生成打招呼语，提示词长度:', prompt.length);
    updateMessageProgress(20, '正在连接API...');
    
    // 获取API配置
    chrome.storage.local.get(['apiKey', 'apiEndpoint'], (result) => {
      const apiKey = result.apiKey || DEFAULT_API_KEY;
      const apiEndpoint = result.apiEndpoint || DEFAULT_API_ENDPOINT;
      
      console.log('使用模型:', DEFAULT_MODEL, '，API端点:', apiEndpoint);
      updateMessageProgress(30, '正在发送请求...');
      
      // 添加超时处理
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('请求超时，请检查网络连接')), 30000)
      );
      
      // 调用API - 使用统一的模型变量
      const fetchPromise = fetch(`${apiEndpoint}/v1/chat/completions`, {
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
              content: "你是一个专业的求职顾问，擅长帮助求职者编写专业的打招呼语。"
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 800
        })
      });
      
      // 使用Promise.race来处理超时
      Promise.race([fetchPromise, timeoutPromise])
        .then(response => {
          if (!response.ok) {
            updateMessageProgress(50, `API响应错误: ${response.status}`, true);
            console.error('API响应错误:', response.status, response.statusText);
            throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
          }
          updateMessageProgress(60, '正在处理响应...');
          return response.json();
        })
        .then(data => {
          console.log('API响应成功:', data);
          updateMessageProgress(80, '生成完成，正在处理结果...');
          
          if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('API返回数据格式错误');
          }
          
          const generatedText = data.choices[0].message.content;
          messageContent.value = generatedText;
          messageContent.placeholder = '生成的打招呼语将显示在这里...';
          updateMessageProgress(100, '生成完成!');
          
          // 保存生成的内容到存储 - 同时保存为当前岗位的打招呼语
          chrome.storage.local.get(['currentJobId', 'jobGreetings'], (result) => {
            // 保存通用打招呼语
            chrome.storage.local.set({messageContent: generatedText}, () => {
              console.log('已保存打招呼语到存储');
              
              // 如果有当前岗位ID，也保存为该岗位的专用打招呼语
              if (result.currentJobId) {
                const jobGreetings = result.jobGreetings || {};
                jobGreetings[result.currentJobId] = generatedText;
                
                chrome.storage.local.set({jobGreetings: jobGreetings}, () => {
                  console.log('已保存为当前岗位的打招呼语:', result.currentJobId);
                });
              }
              
              // 通知内容脚本更新按钮状态
              chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                if (tabs[0]) {
                  try {
                    chrome.tabs.sendMessage(tabs[0].id, {
                      action: 'updateQuickSendButton',
                      isGenerated: true
                    }, response => {
                      // 处理可能的错误
                      if (chrome.runtime.lastError) {
                        console.warn('更新按钮消息发送失败:', chrome.runtime.lastError.message);
                      }
                    });
                  } catch (err) {
                    console.error('发送消息时出错:', err);
                  }
                }
              });
            });
          });
          
          // 3秒后隐藏进度条
          setTimeout(() => {
            progressContainer.classList.add('hidden');
          }, 3000);
          
          // 启用发送按钮
          const sendBtn = document.getElementById('send-btn');
          if (generatedText.length >= 5) {
            sendBtn.disabled = false;
            sendBtn.title = '发送打招呼语';
            sendBtn.style.opacity = '1';
          }
        })
        .catch(error => {
          console.error('生成打招呼语时出错:', error);
          updateMessageProgress(100, `生成失败: ${error.message}`, true);
          
          // 显示错误信息
          messageContent.value = `生成失败: ${error.message}\n\n请检查API设置或网络连接。`;
          
          // 10秒后隐藏进度条
          setTimeout(() => {
            progressContainer.classList.add('hidden');
          }, 10000);
        });
    });
  });
}

// 从简历文本中提取姓名
function extractNameFromResume(resumeText) {
  if (!resumeText) return '';
  
  // 尝试匹配常见的名字格式
  const namePatterns = [
    /姓\s*名[：:]\s*([^\s,，。,\.]{2,4})/,
    /([^\s,，。,\.]{2,4})\s*[|丨]\s*(?:男|女)/,
    /^([^\s,，。,\.]{2,4})\s*[|丨]/m,
    /^([^\s,，。,\.]{2,4})\s*简历/m,
    /个人信息[\s\S]{0,30}?([^\s,，。,\.]{2,4})/
  ];
  
  for (const pattern of namePatterns) {
    const match = resumeText.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return '';  // 如果没找到，返回空字符串
}

// 获取风格描述
function getStyleDescription(style) {
  switch (style) {
    case 'professional':
      return '专业正式，突出专业能力和经验';
    case 'enthusiastic':
      return '热情积极，表达对岗位的强烈兴趣';
    case 'concise':
      return '简洁明了，直接表达核心优势和匹配点';
    case 'friendly':
      return '友好亲切，表达对岗位的兴趣和热情';
    default:
      return '专业正式，突出专业能力和经验';
  }
}

// 发送打招呼语到Boss直聘
function sendGreeting() {
  const messageContent = document.getElementById('message-content').value;
  
  if (!messageContent) {
    alert('请先生成打招呼语');
    return;
  }
  
  chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
    if (!tabs[0]) {
      alert('无法获取当前标签页');
      return;
    }
    
    try {
      const response = await sendMessageToTab(tabs[0].id, {
        action: 'sendGreeting',
        greeting: messageContent
      });
      
      if (response && response.error) {
        alert('发送失败: ' + response.error);
        return;
      }
      
      if (response && response.success) {
        alert('发送成功！');
      } else {
        alert('发送失败，请确保您在Boss直聘岗位页面');
      }
    } catch (error) {
      console.error('发送打招呼语时出错:', error);
      alert('发送过程出错: ' + error.message);
    }
  });
}

// 更新简历状态UI
function updateResumeStatus(isLoaded, resumeText) {
  const statusDot = document.getElementById('resume-status-dot');
  const statusText = document.getElementById('resume-status');
  
  if (statusDot) {
    statusDot.className = isLoaded ? 'status-dot success' : 'status-dot pending';
  }
  
  if (statusText) {
    if (isLoaded && resumeText) {
      const wordCount = resumeText.length;
      statusText.textContent = `已上传简历 (${wordCount}字)`;
    } else {
      statusText.textContent = '未上传简历';
    }
  }
  
  // 如果提供了简历文本，添加字数显示
  if (isLoaded && resumeText && resumeData) {
    const wordCount = resumeText.length;
    const resumeContent = document.getElementById('resume-content');
    
    if (resumeContent) {
      // 添加字数显示
      const resumeWordCount = document.createElement('div');
      resumeWordCount.className = 'word-count';
      resumeWordCount.textContent = `字数: ${wordCount}`;
      resumeWordCount.style.color = '#757575';
      resumeWordCount.style.fontSize = '12px';
      resumeWordCount.style.marginTop = '5px';
      resumeWordCount.style.textAlign = 'right';
      resumeContent.parentNode.insertBefore(resumeWordCount, resumeContent.nextSibling);
    }
  }
}

// 更新JD状态UI
function updateJdStatus(isLoaded) {
  const statusDot = document.getElementById('jd-status-dot');
  const statusText = document.getElementById('jd-status');
  
  if (isLoaded && jdData) {
    statusDot.className = 'status-dot success';
    const wordCount = jdData.length;
    statusText.textContent = `已获取岗位JD (${wordCount}字)`;
  } else {
    statusDot.className = 'status-dot pending';
    statusText.textContent = '未获取岗位JD';
  }
}

// 更新简历进度条
function updateResumeProgress(percent, message, isError = false) {
  console.log(`进度更新: ${percent}% - ${message}`);
  
  const progressBar = document.getElementById('resume-progress-bar');
  const progressText = document.getElementById('resume-progress-text');
  
  if (!progressBar || !progressText) {
    console.error('进度条元素不存在');
    return;
  }
  
  progressBar.style.width = `${percent}%`;
  progressText.textContent = message;
  
  if (isError) {
    progressBar.style.backgroundColor = '#ff6b6b';
    progressText.classList.add('error-text');
  } else {
    progressBar.style.backgroundColor = '#4caf50';
    progressText.classList.remove('error-text');
  }
}

// 更新消息进度条
function updateMessageProgress(percent, message, isError = false) {
  const progressBar = document.getElementById('message-progress-bar');
  const progressText = document.getElementById('message-progress-text');
  
  progressBar.style.width = `${percent}%`;
  progressText.textContent = message;
  
  if (isError) {
    progressText.classList.add('error-text');
  } else {
    progressText.classList.remove('error-text');
  }
}

// 显示设置模态框
function showSettings() {
  document.getElementById('settings-modal').classList.add('show');
  
  // 确保默认显示API设置选项卡
  document.querySelectorAll('.settings-tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelectorAll('.settings-tab-content').forEach(content => {
    content.style.display = 'none';
  });
  
  // 激活API设置选项卡
  document.querySelector('.settings-tab-btn[data-tab="api"]').classList.add('active');
  document.getElementById('api-tab').style.display = 'block';
  
  // 加载API设置
  loadApiSettings();
  
  // 直接加载风格设置数据，即使当前不显示风格设置选项卡
  // 这样可以确保数据已准备好，用户切换到风格设置选项卡时能立即看到
  setTimeout(() => {
    loadStylePrompts();
  }, 100);
  
  console.log('设置对话框已显示');
}

// 隐藏设置模态框
function hideSettings() {
  document.getElementById('settings-modal').classList.remove('show');
}

// 保存设置
function saveSettings(event) {
  event.preventDefault();
  
  const apiKey = document.getElementById('api-key').value;
  const apiEndpoint = document.getElementById('api-endpoint').value || DEFAULT_API_ENDPOINT;
  let model = document.getElementById('model-name').value.trim();
  
  // 如果模型名称为空，使用默认值
  if (!model) {
    model = DEFAULT_MODEL;
    // 更新输入框显示
    document.getElementById('model-name').value = DEFAULT_MODEL;
  }
  
  // 保存设置 - 使用用户输入的模型名称
  chrome.storage.local.set({
    apiKey,
    apiEndpoint,
    model
  }, () => {
    console.log('设置已保存，使用模型:', model);
    
    // 更新当前模型显示
    if (document.getElementById('current-model')) {
      document.getElementById('current-model').textContent = `当前模型: ${model}`;
    }
    
    // 更新主界面的模型显示
    if (document.getElementById('model-badge')) {
      document.getElementById('model-badge').textContent = `模型: ${model}`;
    }
    
    // 显示保存成功消息
    const saveResult = document.createElement('div');
    saveResult.textContent = `✅ 设置已保存，当前模型: ${model}`;
    saveResult.style.color = '#00b38a';
    saveResult.style.marginTop = '10px';
    saveResult.style.fontWeight = 'bold';
    
    const settingsForm = document.getElementById('settings-form');
    settingsForm.appendChild(saveResult);
    
    // 3秒后移除消息
    setTimeout(() => {
      saveResult.remove();
      hideSettings();
    }, 2000);
  });
}

// 处理简历文本提交
function handleResumeTextSubmit() {
  const textArea = document.getElementById('resume-text-input');
  const resumeText = textArea.value.trim();
  
  if (!resumeText) {
    alert('请输入简历文本内容');
    return;
  }
  
  console.log('处理简历文本，长度:', resumeText.length);
  
  // 显示进度条
  document.getElementById('resume-progress-container').classList.remove('hidden');
  updateResumeProgress(10, '正在处理简历文本...');
  document.getElementById('resume-preview').classList.remove('hidden');
  
  try {
    // 存储简历数据
    resumeData = {
      fileName: '手动输入的简历.txt',
      fileContent: null, // 没有文件内容
      resumeText: resumeText,
      uploadDate: new Date().toISOString()
    };
    
    // 更新进度
    updateResumeProgress(50, '正在保存简历...');
    
    // 保存到本地存储
    chrome.storage.local.set({resumeData: resumeData}, () => {
      if (chrome.runtime.lastError) {
        console.error('保存简历失败:', chrome.runtime.lastError);
        updateResumeProgress(0, '保存失败: ' + chrome.runtime.lastError.message, true);
        return;
      }
      
      console.log('简历已保存');
      // 更新UI
      document.getElementById('resume-content').textContent = `简历已保存: 手动输入的文本`;
      updateResumeProgress(100, '简历文本处理完成!');
      updateResumeStatus(true, resumeText);
      
      // 更新生成按钮状态
      const generateBtn = document.getElementById('generate-btn');
      if (generateBtn) {
        generateBtn.disabled = !(jdData && resumeData);
      }
      
      // 3秒后隐藏进度条
      setTimeout(() => {
        document.getElementById('resume-progress-container').classList.add('hidden');
      }, 3000);
    });
  } catch (error) {
    console.error('处理简历文本失败:', error);
    updateResumeProgress(0, '处理失败: ' + error.message, true);
  }
}

// 更新JD信息
async function updateJobDescription(newJdData) {
  const oldHash = jdData ? getJobHash(jdData) : null;
  const newHash = getJobHash(newJdData);
  
  // 如果hash变化了,清除缓存的打招呼语
  if (oldHash !== newHash) {
    chrome.storage.local.remove(['cachedGreeting', 'cachedJobHash']);
  }
  
  jdData = newJdData;
  
  // 计算字数
  const wordCount = newJdData ? newJdData.length : 0;
  
  // 安全地更新DOM
  const jdContent = document.getElementById('jd-content');
  if (jdContent) {
    jdContent.textContent = newJdData;
  }
  
  // 安全地更新状态指示器
  const jdStatus = document.getElementById('jd-status');
  const jdStatusDot = document.getElementById('jd-status-dot');
  
  if (jdStatus) {
    jdStatus.textContent = `已获取岗位JD (${wordCount}字)`;
  }
  if (jdStatusDot) {
    jdStatusDot.className = 'status-dot success';
  }
  
  updateJdStatus(true);
  
  // 更新生成按钮状态
  const generateBtn = document.getElementById('generate-btn');
  if (generateBtn) {
    generateBtn.disabled = !(resumeData && newJdData);
  }
  
  // 如果有简历数据,自动生成打招呼语
  if (resumeData) {
    try {
      // 检查是否已有缓存的打招呼语
      chrome.storage.local.get(['cachedGreeting', 'cachedJobHash'], async (result) => {
        if (result.cachedGreeting && result.cachedJobHash === newHash) {
          console.log('使用缓存的打招呼语');
          // 使用缓存的打招呼语更新UI
          const messageContent = document.getElementById('message-content');
          if (messageContent) {
            messageContent.value = result.cachedGreeting;
            messageContent.placeholder = '生成的打招呼语将显示在这里...';
          }
          return;
        }
        
        console.log('正在自动生成打招呼语...');
        
        // 获取第一个风格的提示词
        const stylePrompts = await new Promise(resolve => {
          chrome.storage.local.get(['stylePrompts'], (result) => {
            resolve(result.stylePrompts || DEFAULT_STYLE_PROMPTS);
          });
        });
        
        const firstStyle = stylePrompts[0];
        
        // 构建提示词
        const prompt = `
          职位描述: ${newJdData}
          
          我的简历: ${resumeData.resumeText}
          
          风格要求: ${firstStyle.prompt}
          
          请根据我的简历和职位描述，生成一段打招呼语，帮助我与招聘者建立联系。
        `;
        
        // 获取API配置
        const settings = await new Promise(resolve => {
          chrome.storage.local.get(['apiKey', 'apiEndpoint'], (result) => {
            resolve({
              apiKey: result.apiKey || DEFAULT_API_KEY,
              apiEndpoint: result.apiEndpoint || DEFAULT_API_ENDPOINT
            });
          });
        });
        
        // 调用API生成打招呼语
        const response = await fetch(`${settings.apiEndpoint}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`
          },
          body: JSON.stringify({
            model: DEFAULT_MODEL,
            messages: [
              {
                role: "system",
                content: "你是一个专业的求职顾问，擅长帮助求职者编写专业的打招呼语。"
              },
              {
                role: "user",
                content: prompt
              }
            ],
            temperature: 0.7,
            max_tokens: 800
          })
        });
        
        if (!response.ok) {
          throw new Error(`API请求失败: ${response.status}`);
        }
        
        const data = await response.json();
        const generatedText = data.choices[0].message.content.trim();
        
        // 缓存生成的打招呼语和hash
        chrome.storage.local.set({
          cachedGreeting: generatedText,
          cachedJobHash: newHash
        });
        
        // 更新UI
        const messageContent = document.getElementById('message-content');
        if (messageContent) {
          messageContent.value = generatedText;
          messageContent.placeholder = '生成的打招呼语将显示在这里...';
        }
        
        console.log('自动生成打招呼语完成');
      });
    } catch (error) {
      console.error('自动生成打招呼语失败:', error);
    }
  }
}

// 添加一个工具函数来生成岗位hash
function getJobHash(jdText) {
  return btoa(jdText).slice(0, 32);
}

// 测试API连接
function testApiConnection() {
  const resultDiv = document.getElementById('api-test-result');
  resultDiv.textContent = '正在测试API连接...';
  resultDiv.style.color = '#333';
  
  const apiKey = document.getElementById('api-key').value;
  const apiEndpoint = document.getElementById('api-endpoint').value || DEFAULT_API_ENDPOINT;
  
  if (!apiKey) {
    resultDiv.textContent = '请输入API密钥';
    resultDiv.style.color = '#ff6b6b';
    return;
  }
  
  // 简单的测试请求 - 使用统一的模型变量
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
          role: "user",
          content: "你好，这是一个API测试。请回复'API连接正常'"
        }
      ],
      temperature: 0.7,
      max_tokens: 50
    })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }
    return response.json();
  })
  .then(data => {
    console.log('API测试响应:', data);
    resultDiv.textContent = '✅ API连接正常';
    resultDiv.style.color = '#00b38a';
  })
  .catch(error => {
    console.error('API测试失败:', error);
    resultDiv.textContent = `❌ API测试失败: ${error.message}`;
    resultDiv.style.color = '#ff6b6b';
  });
}

/**
 * 安全地设置元素文本内容
 * @param {string} id - 元素ID
 * @param {string} text - 要设置的文本
 * @returns {boolean} - 操作是否成功
 */
function safeSetTextContent(id, text) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = text;
    return true;
  }
  console.warn(`无法找到元素: ${id}`);
  return false;
}

/**
 * 安全地设置元素类名
 * @param {string} id - 元素ID
 * @param {string} className - 要设置的类名
 * @returns {boolean} - 操作是否成功
 */
function safeSetClassName(id, className) {
  const element = document.getElementById(id);
  if (element) {
    element.className = className;
    return true;
  }
  console.warn(`无法找到元素: ${id}`);
  return false;
}

// 初始化风格提示词
function initializeStylePrompts() {
  console.log('初始化风格提示词...');
  chrome.storage.local.get(['stylePrompts'], function(result) {
    if (!result.stylePrompts) {
      // 首次使用,从env.js获取默认值并保存
      saveStylePromptsToStorage(DEFAULT_STYLE_PROMPTS);
    }
    // 无论是否首次使用,都从storage加载并更新UI
    loadAndDisplayStylePrompts();
  });
}

// 保存风格提示词到storage
function saveStylePromptsToStorage(stylePrompts) {
  chrome.storage.local.set({ 'stylePrompts': stylePrompts }, function() {
    console.log('风格提示词已保存到storage');
    // 保存后更新UI
    loadAndDisplayStylePrompts();
    // 更新下拉菜单
    updateMessageStyleSelector();
  });
}

// 设置风格名称双击编辑功能
function setupStyleNameEditing() {
  const styleNameElement = document.getElementById('current-style-name');
  if (!styleNameElement) {
    console.error('找不到风格名称元素');
    return;
  }
  
  // 双击开始编辑
  styleNameElement.addEventListener('dblclick', function() {
    const currentText = this.textContent;
    this.classList.add('editing');
    
    // 创建输入框
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.style.cssText = `
      width: 100%;
      padding: 7px;
      border: 1px solid #1e88e5;
      border-radius: 4px;
      font-size: 14px;
      box-sizing: border-box;
    `;
    
    // 替换文本为输入框
    this.textContent = '';
    this.appendChild(input);
    input.focus();
    
    // 处理输入框失焦或回车事件
    function finishEditing() {
      const newName = input.value.trim();
      if (newName) {
        styleNameElement.textContent = newName;
      } else {
        styleNameElement.textContent = currentText;
      }
      styleNameElement.classList.remove('editing');
    }
    
    input.addEventListener('blur', finishEditing);
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        finishEditing();
        e.preventDefault();
      } else if (e.key === 'Escape') {
        styleNameElement.textContent = currentText;
        styleNameElement.classList.remove('editing');
        e.preventDefault();
      }
    });
  });
}

// 修改 loadAndDisplayStylePrompts 函数，在更新显示后设置编辑功能
function loadAndDisplayStylePrompts() {
  chrome.storage.local.get(['stylePrompts'], function(result) {
    const stylePrompts = result.stylePrompts;
    if (!stylePrompts) {
      console.error('未找到风格提示词配置');
      return;
    }

    // 更新当前显示的风格
    const currentIndex = parseInt(document.getElementById('current-style-name')?.dataset.index || '0');
    const currentStyle = stylePrompts[currentIndex];
    
    if (currentStyle) {
      document.getElementById('current-style-name').textContent = currentStyle.name;
      document.getElementById('current-style-prompt').value = currentStyle.prompt;
      
      // 设置双击编辑功能
      setupStyleNameEditing();
    }
  });
}

// 恢复默认风格提示词
function resetStylePrompts() {
  if (confirm('确定要恢复默认风格设置吗？这将覆盖您的自定义设置。')) {
    // 从env.js获取默认值并保存
    saveStylePromptsToStorage(DEFAULT_STYLE_PROMPTS);
  }
}

// 修改保存风格按钮的处理函数
function saveStylePrompts() {
  console.log('保存风格提示词...');
  chrome.storage.local.get(['stylePrompts'], function(result) {
    let stylePrompts = result.stylePrompts || DEFAULT_STYLE_PROMPTS;
    
    // 获取当前编辑的风格索引
    const currentIndex = parseInt(document.getElementById('current-style-name').dataset.index || 0);
    const newName = document.getElementById('current-style-name').textContent;
    const newPrompt = document.getElementById('current-style-prompt').value.trim();
    
    // 确保索引有效
    if (currentIndex >= 0 && currentIndex < stylePrompts.length) {
      // 更新风格信息
      stylePrompts[currentIndex] = {
        ...stylePrompts[currentIndex],
        name: newName || `风格${currentIndex + 1}`,
        prompt: newPrompt || DEFAULT_STYLE_PROMPTS[currentIndex].prompt
      };
      
      // 保存到storage
      saveStylePromptsToStorage(stylePrompts);
      alert('风格设置已保存！');
    } else {
      console.error('无效的风格索引:', currentIndex);
      alert('保存失败：无效的风格索引');
    }
  });
}

// 更新主界面的风格选择下拉菜单
function updateMessageStyleSelector() {
  chrome.storage.local.get(['stylePrompts'], function(result) {
    const stylePrompts = result.stylePrompts || DEFAULT_STYLE_PROMPTS;
    const styleSelector = document.getElementById('message-style');
    
    if (!styleSelector) {
      console.warn('找不到主界面风格选择器');
      return;
    }
    
    // 保存当前选中的值
    const currentValue = styleSelector.value;
    
    // 清空下拉菜单
    styleSelector.innerHTML = '';
    
    // 添加所有风格选项
    stylePrompts.forEach(style => {
      const option = document.createElement('option');
      option.value = style.id;
      option.textContent = style.name;
      styleSelector.appendChild(option);
    });
    
    // 尝试恢复之前选中的值
    const hasCurrentValue = stylePrompts.some(style => style.id === currentValue);
    if (hasCurrentValue) {
      styleSelector.value = currentValue;
    }
  });
}

// 添加加载API设置函数
function loadApiSettings() {
  chrome.storage.local.get(['apiKey', 'apiEndpoint', 'model'], (result) => {
    document.getElementById('api-key').value = result.apiKey || DEFAULT_API_KEY;
    document.getElementById('api-endpoint').value = result.apiEndpoint || DEFAULT_API_ENDPOINT;
    
    const currentModel = result.model || DEFAULT_MODEL;
    document.getElementById('model-name').value = currentModel;
    document.getElementById('current-model').textContent = `当前模型: ${currentModel}`;
  });
}

// 添加恢复默认设置函数
function factoryReset() {
  const confirmMessage = 
    '确定要恢复默认设置吗？\n\n' +
    '这将重置：\n' +
    '- API设置\n' +
    '- 风格设置\n' +
    '- 已保存的简历数据\n' +
    '- 已保存的JD数据\n' +
    '- 其他所有设置\n\n' +
    '此操作不可撤销！';
    
  if (confirm(confirmMessage)) {
    // 显示加载状态
    const resetBtn = document.getElementById('factory-reset-btn');
    const originalText = resetBtn.textContent;
    resetBtn.textContent = '正在重置...';
    resetBtn.disabled = true;
    
    // 清除所有存储的数据
    chrome.storage.local.clear(() => {
      if (chrome.runtime.lastError) {
        console.error('清除数据失败:', chrome.runtime.lastError);
        alert('恢复默认设置失败: ' + chrome.runtime.lastError.message);
        resetBtn.textContent = originalText;
        resetBtn.disabled = false;
        return;
      }
      
      // 重置全局变量
      resumeData = null;
      jdData = null;
      
      // 重新初始化默认设置
      const defaultSettings = {
        apiKey: DEFAULT_API_KEY,
        apiEndpoint: DEFAULT_API_ENDPOINT,
        model: DEFAULT_MODEL,
        stylePrompts: DEFAULT_STYLE_PROMPTS
      };
      
      // 保存默认设置
      chrome.storage.local.set(defaultSettings, () => {
        if (chrome.runtime.lastError) {
          console.error('保存默认设置失败:', chrome.runtime.lastError);
          alert('保存默认设置失败: ' + chrome.runtime.lastError.message);
          resetBtn.textContent = originalText;
          resetBtn.disabled = false;
          return;
        }
        
        // 更新UI
        updateResumeStatus(false);
        updateJdStatus(false);
        document.getElementById('resume-content').textContent = '未上传简历';
        document.getElementById('jd-content').textContent = '未获取岗位JD';
        document.getElementById('generate-btn').disabled = true;
        document.getElementById('send-btn').disabled = true;
        
        // 重新加载设置
        loadApiSettings();
        loadStylePrompts();
        updateMessageStyleSelector();
        
        // 恢复按钮状态
        resetBtn.textContent = originalText;
        resetBtn.disabled = false;
        
        // 显示成功消息
        alert('已成功恢复默认设置！');
        
        // 关闭设置对话框
        hideSettings();
        
        // 刷新整个插件
        window.location.reload();
      });
    });
  }
}
