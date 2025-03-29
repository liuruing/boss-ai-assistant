// 全局变量
let resumeData = null;
let jdData = null;

// 在文件顶部添加常量
const DEFAULT_MODEL = 'o3-mini';
const DEFAULT_API_KEY = 'sk-7rg66CMVkix5YRqvUlst5FHHHa9YHkzbyFKxroSwLxJ3URw3';
const DEFAULT_API_ENDPOINT = 'https://api.bailili.top';

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

// DOM加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
  // 立即初始化UI
  initUI();
  
  // 延迟执行可能需要与content script通信的操作
  setTimeout(() => {
    loadStoredData();
    checkCurrentPage();
  }, 500);
  
  // PDF和TXT解析功能
  const pdfUploadBtn = document.getElementById('parsePdfBtn');
  const pdfUploadInput = document.getElementById('pdfUpload');
  const resultDiv = document.getElementById('pdfParseResult');
  
  if (pdfUploadBtn) {
    pdfUploadBtn.addEventListener('click', async () => {
      if (!pdfUploadInput.files.length) {
        resultDiv.textContent = '请先选择文件';
        return;
      }
      
      const file = pdfUploadInput.files[0];
      const fileType = file.type;
      
      if (fileType !== 'application/pdf' && fileType !== 'text/plain') {
        resultDiv.textContent = '仅支持PDF或TXT格式文件';
        return;
      }
      
      resultDiv.textContent = '正在解析中，请稍候...';
      
      // 如果是TXT文件，可以直接在popup中处理
      if (fileType === 'text/plain') {
        try {
          const reader = new FileReader();
          reader.onload = function(e) {
            const text = e.target.result;
            resultDiv.textContent = '解析成功！\n' + text.substring(0, 200) + '...';
            // 存储解析结果供后续使用
            chrome.storage.local.set({
              'parsedResume': text
            });
          };
          reader.onerror = function() {
            resultDiv.textContent = '读取文件失败';
          };
          reader.readAsText(file);
          return;
        } catch (error) {
          resultDiv.textContent = '解析过程出错: ' + error.message;
          return;
        }
      }
      
      // PDF文件需要发送到content script处理
      try {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'parsePDF',
            file: file
          }, function(response) {
            if (response && response.success) {
              resultDiv.textContent = '解析成功！\n' + response.text.substring(0, 200) + '...';
              // 存储解析结果供后续使用
              chrome.storage.local.set({
                'parsedResume': response.text
              });
            } else {
              resultDiv.textContent = '解析失败: ' + (response?.error || '未知错误');
            }
          });
        });
      } catch (error) {
        resultDiv.textContent = '解析过程出错: ' + error.message;
      }
    });
  }
  
  // 监听来自content script的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Popup received message:', message);
    
    if (message.action === 'jdUpdated') {
      // 更新JD
      updateJobDescription(message.jdData);
      // 立即发送响应
      sendResponse({success: true});
      return true; // 表示会异步发送响应
    } else if (message.action === 'autoGenerateGreeting') {
      // 自动生成打招呼语
      if (resumeData && jdData) {
        generateGreeting();
        sendResponse({success: true});
      } else {
        sendResponse({success: false, reason: '缺少简历或JD数据'});
      }
      return true; // 表示会异步发送响应
    }
    
    // 对于未处理的消息，也发送一个响应
    sendResponse({success: false, reason: '未知的消息类型'});
    return true;
  });
});

// 初始化UI
function initUI() {
  // 上传简历按钮
  document.getElementById('upload-btn').addEventListener('click', () => {
    document.getElementById('resume-upload').click();
  });
  
  // 简历文件上传处理
  document.getElementById('resume-upload').addEventListener('change', handleResumeUpload);
  
  // 刷新JD按钮
  document.getElementById('refresh-jd-btn').addEventListener('click', refreshJobDescription);
  
  // 生成打招呼语按钮
  document.getElementById('generate-btn').addEventListener('click', generateGreeting);
  
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
  
  // 在initUI函数中添加
  document.getElementById('test-api-btn').addEventListener('click', testApiConnection);
  
  // 在initUI函数中添加
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
}

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
            
            // 启用按钮
            document.getElementById('generate-btn').disabled = !jdData;
            document.getElementById('send-btn').disabled = !jdData;
            
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
  
  // 构建提示词，包含简历的姓名信息
  let prompt = `我是${candidateName || '求职者'}，我想应聘以下岗位：\n\n`;
  prompt += `岗位描述：${jdData}\n\n`;
  prompt += `我的简历：${resumeData.resumeText ? resumeData.resumeText.substring(0, 1500) : '未提供简历内容'}\n\n`;
  prompt += `请根据我的简历和岗位要求，帮我生成一段简短的打招呼语，表达我对该岗位的兴趣和自己的优势匹配点。`;
  prompt += `风格要求: ${getStyleDescription(messageStyle)}`;
  
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
        document.getElementById('send-btn').disabled = false;
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
      return '热情积极，表达强烈的兴趣和热情';
    case 'concise':
      return '简洁明了，直接表达核心优势和匹配点';
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
    statusText.textContent = isLoaded ? '已上传简历' : '未上传简历';
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
  
  if (isLoaded) {
    statusDot.className = 'status-dot success';
    statusText.textContent = '已获取岗位JD';
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
  // 显示加载状态
  document.getElementById('current-model').textContent = '当前模型: 加载中...';
  
  // 获取当前默认模型名称
  chrome.storage.local.get(['model', 'apiKey', 'apiEndpoint'], (result) => {
    const defaultModel = result.model || "o3-mini";
    
    // 设置模型名称的placeholder和value
    const modelInput = document.getElementById('model-name');
    modelInput.placeholder = defaultModel;
    
    // 如果输入框为空，则设置当前值为默认模型
    if (!modelInput.value) {
      modelInput.value = defaultModel;
    }
    
    // 更新当前模型显示
    document.getElementById('current-model').textContent = `当前模型: ${defaultModel}`;
    
    // 确保API密钥和端点也正确显示
    if (result.apiKey && !document.getElementById('api-key').value) {
      document.getElementById('api-key').value = result.apiKey;
    }
    
    if (result.apiEndpoint && !document.getElementById('api-endpoint').value) {
      document.getElementById('api-endpoint').value = result.apiEndpoint;
    }
  });
  
  document.getElementById('settings-modal').classList.add('show');
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
      
      // 启用按钮
      document.getElementById('generate-btn').disabled = !jdData;
      document.getElementById('send-btn').disabled = !jdData;
      
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
function updateJobDescription(newJdData) {
  jdData = newJdData;
  
  // 计算字数
  const wordCount = newJdData ? newJdData.length : 0;
  
  // 安全地更新DOM
  const jdContent = document.getElementById('jd-content');
  if (jdContent) {
    jdContent.textContent = newJdData;
    // 添加字数显示
    const jdWordCount = document.createElement('div');
    jdWordCount.className = 'word-count';
    jdWordCount.textContent = `字数: ${wordCount}`;
    jdWordCount.style.color = '#757575';
    jdWordCount.style.fontSize = '12px';
    jdWordCount.style.marginTop = '5px';
    jdWordCount.style.textAlign = 'right';
    jdContent.parentNode.insertBefore(jdWordCount, jdContent.nextSibling);
  }
  
  // 安全地更新状态指示器
  const jdStatus = document.getElementById('jd-status');
  const jdStatusDot = document.getElementById('jd-status-dot');
  
  if (jdStatus) jdStatus.textContent = '已获取岗位JD';
  if (jdStatusDot) jdStatusDot.className = 'status-dot success';
  
  updateJdStatus(true);
  
  // 如果有简历数据，启用生成按钮
  const generateBtn = document.getElementById('generate-btn');
  const sendBtn = document.getElementById('send-btn');
  
  if (generateBtn) generateBtn.disabled = !resumeData;
  if (sendBtn) sendBtn.disabled = !resumeData;
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
