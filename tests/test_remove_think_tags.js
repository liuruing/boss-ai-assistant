/**
 * 测试removeThinkTags函数
 * 用于验证思考过程标签的移除功能
 */

// 模拟removeThinkTags函数
function removeThinkTags(text) {
  if (!text) return "";
  
  // 移除<think>...</think>标签及其内容
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

// 测试用例
const testCases = [
  {
    name: '基本移除测试',
    input: `<think>这是一段思考过程</think>这是最终结果`,
    expected: `这是最终结果`
  },
  {
    name: '多行思考过程测试',
    input: `<think>
    这是一段多行的
    思考过程，包含多行内容
    和一些分析
    </think>这是最终结果`,
    expected: `这是最终结果`
  },
  {
    name: '思考过程在末尾',
    input: `这是最终结果<think>这是一段思考过程</think>`,
    expected: `这是最终结果`
  },
  {
    name: '多个思考过程',
    input: `<think>第一段思考</think>中间内容<think>第二段思考</think>最终结果`,
    expected: `中间内容最终结果`
  },
  {
    name: '嵌套思考过程',
    input: `<think>外部思考<think>内部思考</think>继续外部</think>最终结果`,
    expected: `最终结果`
  },
  {
    name: '输入为空',
    input: '',
    expected: ''
  },
  {
    name: '输入为null',
    input: null,
    expected: ''
  },
  {
    name: '无思考过程',
    input: '这是一段没有思考过程标签的文本',
    expected: '这是一段没有思考过程标签的文本'
  },
  {
    name: '实际示例测试',
    input: `<think>
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

您好，具备Java全栈开发和AI模型调优经验，曾使用LangChain参与大模型优化，并在实际项目中实现OpenAI API情感分析功能。对贵公司AI大模型方向的开发岗位非常感兴趣，期待有机会贡献所长。`,
    expected: `您好，具备Java全栈开发和AI模型调优经验，曾使用LangChain参与大模型优化，并在实际项目中实现OpenAI API情感分析功能。对贵公司AI大模型方向的开发岗位非常感兴趣，期待有机会贡献所长。`
  }
];

// 运行测试
function runTests() {
  let passed = 0;
  let failed = 0;
  
  console.log('开始测试removeThinkTags函数...\n');
  
  testCases.forEach((testCase, index) => {
    const result = removeThinkTags(testCase.input);
    const success = result === testCase.expected;
    
    if (success) {
      passed++;
      console.log(`✅ 测试 ${index + 1} "${testCase.name}" 通过`);
    } else {
      failed++;
      console.log(`❌ 测试 ${index + 1} "${testCase.name}" 失败`);
      console.log(`  期望: "${testCase.expected}"`);
      console.log(`  实际: "${result}"`);
    }
  });
  
  console.log(`\n测试完成: ${passed} 通过, ${failed} 失败`);
  
  return { passed, failed };
}

// 如果在Node.js环境中，直接运行测试
if (typeof module !== 'undefined' && module.exports) {
  runTests();
}

// 导出测试函数，以便在浏览器环境中使用
if (typeof window !== 'undefined') {
  window.testRemoveThinkTags = runTests;
} 