/**
 * Chrome扩展环境测试脚本
 * 用于测试removeThinkTags函数在扩展环境中的表现
 */

// 测试函数
function testRemoveThinkTagsInExtension() {
  // 准备测试数据
  const testInput = `<think>
首先，我需要分析职位描述和求职者简历，找出匹配度最高的核心技能和经验，然后创建一条简洁专业的打招呼语。

职位描述关键点：
1. AI大模型方向项目开发、维护和升级
2. 使用Java编程语言
3. 需要有大模型应用相关项目开发经验
4. 熟悉Spring、Spring Boot、SpringCloud等框架
5. 熟悉大模型工程化部署和优化
6. 有模型调优经验（如RAG等）

求职者简历亮点：
1. Java开发经验，熟悉Spring、Spring Boot、Spring Cloud等框架
2. 有AI模型工程师经验，参与过安心大模型需求分析
3. 使用LangChain参与模型调优
4. 有抖音短视频项目中的AI模块实现经验（OpenAI API情感分析）
5. 熟悉并发编程、JVM、数据库等技术

最匹配的核心技能和经验：
1. Java开发技能与Spring生态系统经验
2. AI模型调优经验（使用LangChain）
3. 大模型应用开发经验

现在，我将创建一条不超过80字的打招呼语，直接使用"您好"开头，突出核心匹配点，表达对岗位的兴趣，语言精炼专业但略带口语化：
</think>

您好，具备Java全栈开发和AI模型调优经验，曾使用LangChain参与大模型优化，并在实际项目中实现OpenAI API情感分析功能。对贵公司AI大模型方向的开发岗位非常感兴趣，期待有机会贡献所长。`;

  const expected = `您好，具备Java全栈开发和AI模型调优经验，曾使用LangChain参与大模型优化，并在实际项目中实现OpenAI API情感分析功能。对贵公司AI大模型方向的开发岗位非常感兴趣，期待有机会贡献所长。`;

  // 模拟存储数据
  chrome.storage.local.set({ 
    testGreeting: testInput 
  }, () => {
    console.log('测试数据已保存到存储');
    
    // 获取数据并测试处理函数
    chrome.storage.local.get(['testGreeting'], (result) => {
      if (!result.testGreeting) {
        console.error('❌ 测试失败: 无法从存储中获取测试数据');
        return;
      }
      
      // 如果我们在background.js环境中
      if (typeof removeThinkTags === 'function') {
        const processed = removeThinkTags(result.testGreeting);
        const success = processed === expected;
        
        if (success) {
          console.log('✅ background.js环境测试通过');
        } else {
          console.error('❌ background.js环境测试失败');
          console.log('期望:', expected);
          console.log('实际:', processed);
        }
      } 
      // 如果我们在OpenAIClient环境中
      else if (typeof OpenAIClient !== 'undefined') {
        const client = new OpenAIClient();
        const processed = client.removeThinkTags(result.testGreeting);
        const success = processed === expected;
        
        if (success) {
          console.log('✅ OpenAIClient环境测试通过');
        } else {
          console.error('❌ OpenAIClient环境测试失败');
          console.log('期望:', expected);
          console.log('实际:', processed);
        }
      }
      // 如果我们在content.js环境中
      else if (typeof window !== 'undefined' && window.removeThinkTags) {
        const processed = window.removeThinkTags(result.testGreeting);
        const success = processed === expected;
        
        if (success) {
          console.log('✅ content.js环境测试通过');
        } else {
          console.error('❌ content.js环境测试失败');
          console.log('期望:', expected);
          console.log('实际:', processed);
        }
      }
      else {
        console.error('❌ 测试失败: 找不到removeThinkTags函数');
      }
      
      // 清理测试数据
      chrome.storage.local.remove(['testGreeting'], () => {
        console.log('测试数据已清理');
      });
    });
  });
}

// 导出测试函数
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testRemoveThinkTagsInExtension };
}

// 如果在扩展环境中，直接运行测试
if (typeof chrome !== 'undefined' && chrome.storage) {
  console.log('开始在扩展环境中测试removeThinkTags函数...');
  setTimeout(testRemoveThinkTagsInExtension, 1000); // 延迟1秒执行，确保环境已准备好
} 