// 代码已包含 CSS：使用 TailwindCSS , 安装 TailwindCSS 后方可看到布局样式效果
import React, { useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination } from 'swiper/modules';
import {
BellOutlined,
UserOutlined,
SettingOutlined,
HomeOutlined,
EditOutlined,
BarChartOutlined,
CalendarOutlined,
WechatOutlined,
WeiboOutlined,
TikTokOutlined,
InstagramOutlined,
SearchOutlined,
PlusOutlined,
EyeOutlined,
CommentOutlined,
LikeOutlined,
ShareAltOutlined,
FilterOutlined
} from '@ant-design/icons';
import type { SwiperProps } from 'swiper/react';
import type { EChartsOption } from 'echarts';
// 引入 Swiper 样式
import 'swiper/css';
import 'swiper/css/pagination';
const App: React.FC = () => {
// 平台数据
const platforms = [
{ id: 1, name: '微信', icon: <WechatOutlined />, color: 'bg-green-500', connected: true },
{ id: 2, name: '微博', icon: <WeiboOutlined />, color: 'bg-red-500', connected: true },
{ id: 3, name: '抖音', icon: <TikTokOutlined />, color: 'bg-purple-500', connected: true },
{ id: 4, name: '小红书', icon: <InstagramOutlined />, color: 'bg-pink-500', connected: false },
];
// 数据分析指标
const analyticsMetrics = [
{ id: 1, name: '浏览量', value: '128,456', change: '+12.5%' },
{ id: 2, name: '互动率', value: '42.3%', change: '+8.2%' },
{ id: 3, name: '转发量', value: '12,432', change: '+5.7%' },
{ id: 4, name: '转化率', value: '3.8%', change: '-1.2%' },
];
// AI 写作模板
const aiTemplates = [
{ id: 1, name: '产品推广', description: '突出产品特点和优势' },
{ id: 2, name: '活动宣传', description: '吸引用户参与活动' },
{ id: 3, name: '节日祝福', description: '温馨的节日问候' },
{ id: 4, name: '知识分享', description: '专业领域的干货内容' },
];
// 统计数据
const statsData = [
{ title: '总粉丝数', value: '128,456', change: '+12.5%', chartType: 'line' },
{ title: '互动增长率', value: '42.3%', change: '+8.2%', chartType: 'bar' },
{ title: '内容发布量', value: '1,248', change: '+5.7%', chartType: 'area' },
{ title: '转化率', value: '3.8%', change: '-1.2%', chartType: 'pie' },
];
// 内容数据
const contentItems = [
{
id: 1,
platform: '微信',
platformColor: 'bg-green-500',
time: '2 小时前',
content: '新产品发布会即将开始，敬请期待！#新品发布 #科技创新',
metrics: { views: 1245, comments: 64, likes: 231 },
image: 'https://ai-public.mastergo.com/ai/img_res/1975e2e250b3ec842131639b4aab269e.jpg'
},
{
id: 2,
platform: '微博',
platformColor: 'bg-red-500',
time: '5 小时前',
content: '用户调研结果显示，90% 的用户对我们的新功能表示满意。感谢大家的支持！',
metrics: { views: 5621, comments: 128, likes: 842 },
image: 'https://ai-public.mastergo.com/ai/img_res/8e66e784dabd76df6f15a36c359be94a.jpg'
},
{
id: 3,
platform: '抖音',
platformColor: 'bg-purple-500',
time: '1 天前',
content: ' behind the scenes of our latest product photoshoot. #bts #productphotography',
metrics: { views: 12540, comments: 356, likes: 2156 },
image: 'https://ai-public.mastergo.com/ai/img_res/2690002600ca096f5c0dd5234b6f1df9.jpg'
},
{
id: 4,
platform: '微信',
platformColor: 'bg-green-500',
time: '1 天前',
content: '行业专家分享数字化转型的最佳实践案例，不容错过！',
metrics: { views: 892, comments: 24, likes: 156 },
image: 'https://ai-public.mastergo.com/ai/img_res/094c83c800f2b824d0d021491327534b.jpg'
}
];
// 热门话题
const trendingTopics = [
'#数字化转型', '#AI技术', '#用户体验', '#品牌营销', '#社交媒体'
];
// 草稿箱内容
const drafts = [
{ id: 1, title: '新产品发布会预告', time: '昨天 15:30' },
{ id: 2, title: '用户调研报告分享', time: '前天 10:15' },
];
// 当前激活的导航项
const [activeNav, setActiveNav] = useState('首页');
// 当前激活的平台
const [activePlatform, setActivePlatform] = useState<number | null>(null);
// 内容发布表单数据
const [postContent, setPostContent] = useState({
title: '',
content: '',
selectedPlatforms: [] as number[],
aiPrompt: '',
isGenerating: false,
generatedContent: ''
});
// 数据分析状态
const [analysisState, setAnalysisState] = useState({
aiAnalysis: '',
isAnalyzing: false,
chartType: 'line',
dateRange: '7天'
});
// Swiper 配置
const swiperParams: SwiperProps = {
modules: [Pagination],
spaceBetween: 20,
slidesPerView: 4,
pagination: { clickable: true },
breakpoints: {
320: { slidesPerView: 1 },
768: { slidesPerView: 2 },
1024: { slidesPerView: 3 },
1440: { slidesPerView: 4 }
}
};
// 渲染统计卡片
const renderStatCard = (item: any, index: number) => (
<div key={index} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
<div className="flex justify-between items-start">
<div>
<p className="text-gray-500 text-sm mb-1">{item.title}</p>
<h3 className="text-2xl font-bold text-gray-900">{item.value}</h3>
<p className={`mt-2 text-sm ${item.change.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
{item.change} 环比
</p>
</div>
<div className="w-16 h-16 bg-blue-50 rounded-lg flex items-center justify-center">
<BarChartOutlined className="text-blue-500 text-xl" />
</div>
</div>
<div className="mt-4 h-12">
{/* 这里应该是图表，简化处理 */}
<div className="w-full h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded opacity-70"></div>
</div>
</div>
);
// 渲染内容卡片
const renderContentItem = (item: any) => (
<div key={item.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 hover:shadow-md transition-shadow">
<div className="p-5">
<div className="flex justify-between items-start">
<div className="flex items-center">
<div className={`w-3 h-3 rounded-full ${item.platformColor} mr-2`}></div>
<span className="font-medium text-gray-900">{item.platform}</span>
</div>
<span className="text-gray-500 text-sm">{item.time}</span>
</div>
<p className="mt-3 text-gray-700 line-clamp-2">{item.content}</p>
</div>
<div className="relative h-48 overflow-hidden">
<img
src={item.image}
alt={item.platform}
className="w-full h-full object-cover"
/>
</div>
<div className="p-5 border-t border-gray-100">
<div className="flex justify-between text-gray-500">
<span className="flex items-center"><EyeOutlined className="mr-1" /> {item.metrics.views}</span>
<span className="flex items-center"><CommentOutlined className="mr-1" /> {item.metrics.comments}</span>
<span className="flex items-center"><LikeOutlined className="mr-1" /> {item.metrics.likes}</span>
<span className="flex items-center"><ShareAltOutlined className="mr-1" /></span>
</div>
</div>
</div>
);
// 处理平台选择
const handlePlatformSelect = (platformId: number) => {
setPostContent(prev => {
const isSelected = prev.selectedPlatforms.includes(platformId);
return {
...prev,
selectedPlatforms: isSelected
? prev.selectedPlatforms.filter(id => id !== platformId)
: [...prev.selectedPlatforms, platformId]
};
});
};
// AI 内容生成模拟
const generateAIContent = () => {
if (!postContent.aiPrompt.trim()) return;
setPostContent(prev => ({ ...prev, isGenerating: true }));
// 模拟 AI 生成过程
setTimeout(() => {
const sampleContents = [
"🚀 全新产品震撼上市！\n\n🌟 突破性技术创新\n💡 智能化用户体验\n🎯 精准满足您的需求\n\n立即体验，开启未来生活！#科技 #创新 #新品发布",
"🎉 限时优惠活动来袭！\n\n🔥 超值折扣享不停\n🎁 精美礼品免费送\n⏰ 活动时间：本周末\n📍 地点：各大门店同步开启\n\n赶快参与，惊喜不断！#优惠 #活动 #限时抢购",
"🎄 温馨圣诞祝福！\n\n✨ 愿您拥有一个充满爱与欢笑的圣诞节\n🌟 新的一年，愿所有美好如期而至\n💝 感谢一路相伴，我们继续前行\n\n祝您圣诞快乐，新年幸福！#圣诞快乐 #新年祝福",
"📚 行业干货分享\n\n🔍 今日知识点：数字化转型的关键要素\n✅ 明确战略目标\n✅ 构建敏捷组织\n✅ 技术创新驱动\n✅ 数据价值挖掘\n\n关注我们，获取更多专业知识！#知识分享 #数字化转型"
];
const randomContent = sampleContents[Math.floor(Math.random() * sampleContents.length)];
setPostContent(prev => ({
...prev,
isGenerating: false,
generatedContent: randomContent
}));
}, 2000);
};
// AI 数据分析模拟
const analyzeDataWithAI = () => {
setAnalysisState(prev => ({ ...prev, isAnalyzing: true }));
// 模拟 AI 分析过程
setTimeout(() => {
const sampleAnalyses = [
"📊 数据洞察：过去 7 天浏览量增长 12.5%，主要来源于微信平台的内容推广。建议增加短视频内容以提高互动率。",
"📈 趋势分析：互动率显著提升，特别是下午时段表现最佳。建议优化发布时间以最大化曝光效果。",
"📉 异常检测：转化率略有下降，可能与内容相关性有关。建议调整目标受众定位并优化内容策略。",
"🎯 优化建议：转发量增长明显，说明内容具有传播价值。建议加强用户生成内容（UGC）的引导。"
];
const randomAnalysis = sampleAnalyses[Math.floor(Math.random() * sampleAnalyses.length)];
setAnalysisState(prev => ({
...prev,
isAnalyzing: false,
aiAnalysis: randomAnalysis
}));
}, 2000);
};
return (
<div className="min-h-screen bg-gray-50 flex flex-col" style={{ minHeight: '1024px' }}>
{/* 顶部导航栏 */}
<header className="bg-gray-900 text-white h-16 flex items-center px-6 shadow-md z-10">
<div className="flex items-center">
<div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
<span className="font-bold text-white">S</span>
</div>
<h1 className="text-xl font-bold">SocialHub</h1>
</div>
<div className="flex-1 mx-10">
{/* 中间区域预留 */}
</div>
<div className="flex items-center space-x-5">
<button className="p-2 rounded-full hover:bg-gray-800 transition-colors">
<BellOutlined className="text-xl" />
</button>
<button className="p-2 rounded-full hover:bg-gray-800 transition-colors">
<UserOutlined className="text-xl" />
</button>
<button className="p-2 rounded-full hover:bg-gray-800 transition-colors">
<SettingOutlined className="text-xl" />
</button>
</div>
</header>
{/* 标签式导航 */}
<nav className="bg-white border-b border-gray-200">
<div className="flex px-6">
{['首页', '内容发布', '数据分析', '日程管理', '账户设置'].map((item) => (
<button
key={item}
className={`px-5 py-4 text-sm font-medium whitespace-nowrap !rounded-button ${
activeNav === item
? 'text-blue-600 border-b-2 border-blue-600'
: 'text-gray-600 hover:text-gray-900'
}`}
onClick={() => setActiveNav(item)}
>
{item}
</button>
))}
</div>
</nav>
{/* 主体内容 */}
<div className="flex flex-1 overflow-hidden">
{/* 左侧平台选择栏 */}
<aside className="w-64 bg-white border-r border-gray-200 p-5 overflow-y-auto">
<h2 className="text-lg font-semibold text-gray-900 mb-4">平台管理</h2>
<div className="space-y-3">
{platforms.map((platform) => (
<button
key={platform.id}
className={`w-full flex items-center p-3 rounded-lg transition-colors ${
activePlatform === platform.id
? 'bg-blue-50 border border-blue-200'
: 'hover:bg-gray-50 border border-gray-200'
}`}
onClick={() => setActivePlatform(platform.id)}
>
<div className="relative">
<div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white ${platform.color}`}>
{platform.icon}
</div>
<div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
platform.connected ? 'bg-green-500' : 'bg-gray-300'
}`}></div>
</div>
<span className="ml-3 font-medium text-gray-900">{platform.name}</span>
</button>
))}
</div>
<div className="mt-8">
<h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">快捷操作</h3>
<button className="w-full flex items-center p-3 text-left rounded-lg hover:bg-gray-50 transition-colors">
<PlusOutlined className="text-blue-500" />
<span className="ml-3 text-gray-700">添加新平台</span>
</button>
</div>
</aside>
{/* 中间主内容区 */}
<main className="flex-1 overflow-y-auto p-6">
{activeNav === '内容发布' ? (
<div className="max-w-4xl mx-auto">
<div className="bg-white rounded-xl shadow-sm p-6 mb-6">
<h2 className="text-2xl font-bold text-gray-900 mb-6">内容发布</h2>
<div className="mb-6">
<label className="block text-sm font-medium text-gray-700 mb-2">标题</label>
<input
type="text"
value={postContent.title}
onChange={(e) => setPostContent(prev => ({ ...prev, title: e.target.value }))}
className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
placeholder="请输入内容标题"
/>
</div>
<div className="mb-6">
<label className="block text-sm font-medium text-gray-700 mb-2">内容</label>
<textarea
value={postContent.generatedContent || postContent.content}
onChange={(e) => setPostContent(prev => ({ ...prev, content: e.target.value }))}
rows={8}
className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
placeholder="请输入要发布的内容..."
/>
</div>
<div className="border-t border-gray-200 pt-6">
<h3 className="text-lg font-medium text-gray-900 mb-4">AI 写作助手</h3>
<div className="grid grid-cols-2 gap-4 mb-4">
{aiTemplates.map(template => (
<button
key={template.id}
className="p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left"
onClick={() => setPostContent(prev => ({
...prev,
aiPrompt: template.name
}))}
>
<div className="font-medium text-gray-900">{template.name}</div>
<div className="text-sm text-gray-500 mt-1">{template.description}</div>
</button>
))}
</div>
<div className="flex mb-4">
<input
type="text"
value={postContent.aiPrompt}
onChange={(e) => setPostContent(prev => ({ ...prev, aiPrompt: e.target.value }))}
className="flex-1 px-4 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
placeholder="描述您想要的内容主题，如：新产品推广文案"
/>
<button
onClick={generateAIContent}
disabled={postContent.isGenerating}
className="px-6 py-2 bg-blue-500 text-white rounded-r-lg hover:bg-blue-600 disabled:opacity-50 transition-colors !rounded-button whitespace-nowrap"
>
{postContent.isGenerating ? '生成中...' : '生成内容'}
</button>
</div>
{postContent.generatedContent && (
<div className="mt-4 p-4 bg-blue-50 rounded-lg">
<div className="flex justify-between items-start mb-2">
<h4 className="font-medium text-gray-900">AI 生成结果</h4>
<button
onClick={() => setPostContent(prev => ({ ...prev, content: prev.generatedContent }))}
className="text-sm text-blue-500 hover:text-blue-700"
>
使用此内容
</button>
</div>
<pre className="whitespace-pre-wrap text-gray-700">{postContent.generatedContent}</pre>
</div>
)}
</div>
<div className="border-t border-gray-200 pt-6 mt-6">
<h3 className="text-lg font-medium text-gray-900 mb-4">发布到平台</h3>
<div className="flex flex-wrap gap-2">
{platforms.filter(p => p.connected).map(platform => (
<button
key={platform.id}
onClick={() => handlePlatformSelect(platform.id)}
className={`flex items-center px-4 py-2 rounded-lg border ${
postContent.selectedPlatforms.includes(platform.id)
? 'bg-blue-50 border-blue-500 text-blue-700'
: 'border-gray-300 text-gray-700 hover:bg-gray-50'
}`}
>
<div className={`w-5 h-5 rounded mr-2 ${platform.color}`}></div>
{platform.name}
</button>
))}
</div>
</div>
<div className="mt-8 flex justify-end">
<button
className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors !rounded-button whitespace-nowrap"
>
发布内容
</button>
</div>
</div>
</div>
) : activeNav === '数据分析' ? (
<div className="max-w-7xl mx-auto">
<div className="bg-white rounded-xl shadow-sm p-6 mb-6">
<div className="flex justify-between items-center mb-6">
<h2 className="text-2xl font-bold text-gray-900">数据分析</h2>
<div className="flex space-x-3">
<select
className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
value={analysisState.dateRange}
onChange={(e) => setAnalysisState(prev => ({ ...prev, dateRange: e.target.value }))}
>
<option value="7天">最近 7 天</option>
<option value="30天">最近 30 天</option>
<option value="90天">最近 90 天</option>
</select>
<button
className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors !rounded-button whitespace-nowrap"
onClick={analyzeDataWithAI}
disabled={analysisState.isAnalyzing}
>
{analysisState.isAnalyzing ? '分析中...' : 'AI 一键分析'}
</button>
</div>
</div>
{/* AI 分析结果 */}
{analysisState.aiAnalysis && (
<div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
<div className="flex items-start">
<div className="flex-shrink-0 mt-1">
<BarChartOutlined className="text-blue-500 text-xl" />
</div>
<div className="ml-3">
<h3 className="font-medium text-gray-900">AI 智能分析</h3>
<p className="mt-1 text-gray-700">{analysisState.aiAnalysis}</p>
</div>
</div>
</div>
)}
{/* 关键指标 */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
{analyticsMetrics.map(metric => (
<div key={metric.id} className="bg-gray-50 rounded-lg p-5 border border-gray-200">
<div className="flex justify-between">
<h3 className="text-gray-600 font-medium">{metric.name}</h3>
<span className={`text-sm font-medium ${metric.change.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
{metric.change}
</span>
</div>
<div className="mt-2 text-2xl font-bold text-gray-900">{metric.value}</div>
<div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
<div
className={`h-full rounded-full ${metric.change.startsWith('+') ? 'bg-green-500' : 'bg-red-500'}`}
style={{ width: metric.change.startsWith('+') ? metric.change : metric.change.substring(1) }}
></div>
</div>
</div>
))}
</div>
{/* 流量趋势图表 */}
<div className="bg-gray-50 rounded-lg p-5 border border-gray-200 mb-6">
<div className="flex justify-between items-center mb-4">
<h3 className="font-medium text-gray-900">流量趋势</h3>
<div className="flex space-x-2">
{['线形图', '柱状图', '面积图'].map((type, index) => (
<button
key={index}
className={`px-3 py-1 text-sm rounded-lg ${
analysisState.chartType === type ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 border border-gray-300'
}`}
onClick={() => setAnalysisState(prev => ({ ...prev, chartType: type }))}
>
{type}
</button>
))}
</div>
</div>
<div className="h-80 bg-white rounded-lg p-4 border border-gray-300">
{/* 图表占位 - 实际项目中会使用 ECharts */}
<div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
<div className="text-center">
<BarChartOutlined className="text-4xl text-blue-400 mb-2" />
<p className="text-gray-500">流量趋势图表</p>
<p className="text-sm text-gray-400 mt-1">此处将显示基于 {analysisState.dateRange} 的数据</p>
</div>
</div>
</div>
</div>
{/* 平台表现对比 */}
<div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
<h3 className="font-medium text-gray-900 mb-4">各平台表现</h3>
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
{platforms.filter(p => p.connected).map(platform => (
<div key={platform.id} className="bg-white rounded-lg p-4 border border-gray-300">
<div className="flex items-center">
<div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white ${platform.color}`}>
{platform.icon}
</div>
<div className="ml-3">
<h4 className="font-medium text-gray-900">{platform.name}</h4>
<p className="text-sm text-gray-500">浏览量: 24,568</p>
</div>
</div>
<div className="mt-3">
<div className="flex justify-between text-sm mb-1">
<span className="text-gray-600">互动率</span>
<span className="font-medium">42.3%</span>
</div>
<div className="h-2 bg-gray-200 rounded-full overflow-hidden">
<div className="h-full bg-blue-500 rounded-full" style={{ width: '42.3%' }}></div>
</div>
</div>
</div>
))}
</div>
</div>
</div>
</div>
) : activeNav === '日程管理' ? (
<div className="max-w-7xl mx-auto">
<div className="bg-white rounded-xl shadow-sm p-6">
<h2 className="text-2xl font-bold text-gray-900 mb-6">日程管理</h2>
<div className="flex justify-between items-center mb-6">
<div className="flex space-x-3">
<button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
&lt; 上一月
</button>
<button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
今天
</button>
<button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
下一月 &gt;
</button>
</div>
<div className="text-lg font-medium">2025年12月</div>
<div className="flex space-x-2">
<button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
月视图
</button>
<button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
周视图
</button>
<button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
日视图
</button>
</div>
</div>
{/* Calendar Header */}
<div className="grid grid-cols-7 gap-1 mb-2">
{['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map(day => (
<div key={day} className="text-center py-2 font-medium text-gray-700">{day}</div>
))}
</div>
{/* Calendar Grid */}
<div className="grid grid-cols-7 gap-1">
{Array.from({ length: 35 }).map((_, index) => {
const dayNumber = (index % 31) + 1;
const isCurrentMonth = index >= 1 && index <= 31;
const isToday = dayNumber === 9; // Today is Dec 9th
return (
<div
key={index}
className={`min-h-32 border border-gray-200 p-2 ${
isToday ? 'bg-blue-50' : 'bg-white'
}`}
>
<div className={`text-right p-1 ${
isToday
? 'bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center ml-auto'
: isCurrentMonth
? 'text-gray-900'
: 'text-gray-400'
}`}>
{dayNumber}
</div>
{(dayNumber === 9 || dayNumber === 12 || dayNumber === 15 || dayNumber === 20) && (
<div className="mt-1 space-y-1">
<div className="bg-blue-100 text-blue-800 text-xs p-1 rounded truncate">
新产品发布
</div>
</div>
)}
{(dayNumber === 10 || dayNumber === 18 || dayNumber === 25) && (
<div className="mt-1 space-y-1">
<div className="bg-green-100 text-green-800 text-xs p-1 rounded truncate">
用户调研分享
</div>
</div>
)}
</div>
);
})}
</div>
{/* Schedule List */}
<div className="mt-8">
<h3 className="text-lg font-medium text-gray-900 mb-4">即将发布的安排</h3>
<div className="space-y-3">
{[
{ id: 1, title: '新产品发布会预告', platform: '微信', time: '2025-12-09 14:00', status: '即将发布' },
{ id: 2, title: '用户调研报告分享', platform: '微博', time: '2025-12-10 10:00', status: '待发布' },
{ id: 3, title: '节日促销活动宣传', platform: '抖音', time: '2025-12-12 16:00', status: '待发布' },
{ id: 4, title: '行业知识分享', platform: '小红书', time: '2025-12-15 09:00', status: '待发布' },
{ id: 5, title: '年终总结报告', platform: '微信', time: '2025-12-20 15:00', status: '待发布' }
].map(item => (
<div key={item.id} className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
<div className="flex-1">
<h4 className="font-medium text-gray-900">{item.title}</h4>
<div className="flex items-center mt-1 text-sm text-gray-500">
<span>{item.platform}</span>
<span className="mx-2">•</span>
<span>{item.time}</span>
</div>
</div>
<div className="flex items-center">
<span className={`px-2 py-1 rounded text-xs ${
item.status === '即将发布'
? 'bg-yellow-100 text-yellow-800'
: 'bg-gray-100 text-gray-800'
}`}>
{item.status}
</span>
<button className="ml-4 text-blue-500 hover:text-blue-700 text-sm">
编辑
</button>
</div>
</div>
))}
</div>
</div>
</div>
</div>
) : activeNav === '账户设置' ? (
<div className="max-w-4xl mx-auto">
<div className="bg-white rounded-xl shadow-sm p-6 mb-6">
<h2 className="text-2xl font-bold text-gray-900 mb-6">账户设置</h2>
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
{/* Profile Section */}
<div className="md:col-span-1">
<div className="bg-gray-50 rounded-lg p-5">
<h3 className="text-lg font-medium text-gray-900 mb-4">个人信息</h3>
<div className="flex flex-col items-center">
<div className="relative">
<div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
<img
src="https://ai-public.mastergo.com/ai/img_res/ebd5dd28afd15227e18e6b7277380be5.jpg"
alt="Profile"
className="w-full h-full object-cover"
/>
</div>
<button className="absolute bottom-0 right-0 bg-white rounded-full p-1 shadow-md">
<EditOutlined className="text-gray-700" />
</button>
</div>
<div className="mt-4 w-full">
<div className="mb-4">
<label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
<input
type="text"
defaultValue="张伟"
className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
/>
</div>
<div className="mb-4">
<label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
<input
type="email"
defaultValue="zhangwei@example.com"
disabled
className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
/>
</div>
<button className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
保存更改
</button>
</div>
</div>
</div>
</div>
{/* Platform Binding Section */}
<div className="md:col-span-2">
<div className="bg-gray-50 rounded-lg p-5">
<h3 className="text-lg font-medium text-gray-900 mb-4">第三方平台绑定</h3>
<div className="space-y-4">
{platforms.map(platform => (
<div key={platform.id} className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200">
<div className="flex items-center">
<div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white ${platform.color}`}>
{platform.icon}
</div>
<div className="ml-4">
<div className="font-medium text-gray-900">{platform.name}</div>
<div className="text-sm text-gray-500">
{platform.connected ? '已绑定' : '未绑定'}
</div>
</div>
</div>
<button
className={`px-4 py-2 rounded-lg ${
platform.connected
? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
: 'bg-blue-500 text-white hover:bg-blue-600'
}`}
>
{platform.connected ? '解绑' : '绑定'}
</button>
</div>
))}
</div>
</div>
</div>
</div>
</div>
<div className="bg-white rounded-xl shadow-sm p-6">
<h3 className="text-lg font-medium text-gray-900 mb-4">安全设置</h3>
<div className="space-y-4">
<div className="flex justify-between items-center p-4 border border-gray-200 rounded-lg">
<div>
<h4 className="font-medium text-gray-900">修改密码</h4>
<p className="text-sm text-gray-500">定期更换密码以保护账户安全</p>
</div>
<button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
修改
</button>
</div>
<div className="flex justify-between items-center p-4 border border-gray-200 rounded-lg">
<div>
<h4 className="font-medium text-gray-900">登录设备管理</h4>
<p className="text-sm text-gray-500">查看和管理登录过的设备</p>
</div>
<button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
查看
</button>
</div>
<div className="flex justify-between items-center p-4 border border-gray-200 rounded-lg">
<div>
<h4 className="font-medium text-gray-900">双重验证</h4>
<p className="text-sm text-gray-500">为账户增加额外的安全保护</p>
</div>
<label className="relative inline-flex items-center cursor-pointer">
<input type="checkbox" className="sr-only peer" />
<div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
</label>
</div>
</div>
</div>
</div>
) : (
<>
{/* 数据概览 */}
<div className="mb-8">
<div className="flex justify-between items-center mb-6">
<h2 className="text-xl font-bold text-gray-900">数据概览</h2>
<button className="flex items-center text-gray-500 hover:text-gray-700">
<FilterOutlined className="mr-1" />
<span>筛选</span>
</button>
</div>
<Swiper {...swiperParams} className="pb-10">
{statsData.map((stat, index) => (
<SwiperSlide key={index}>
{renderStatCard(stat, index)}
</SwiperSlide>
))}
</Swiper>
</div>
{/* 内容管理 */}
<div>
<div className="flex justify-between items-center mb-6">
<h2 className="text-xl font-bold text-gray-900">内容管理</h2>
<div className="flex space-x-3">
<div className="relative">
<input
type="text"
placeholder="搜索内容..."
className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
/>
<SearchOutlined className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
</div>
<button className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors !rounded-button whitespace-nowrap">
<PlusOutlined className="mr-1" />
新建内容
</button>
</div>
</div>
{/* 内容瀑布流 */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
{contentItems.map(renderContentItem)}
</div>
</div>
</>
)}
</main>
{/* 右侧快捷操作面板 */}
<aside className="w-80 bg-white border-l border-gray-200 p-5 overflow-y-auto">
<div className="mb-8">
<h2 className="text-lg font-semibold text-gray-900 mb-4">热门话题</h2>
<div className="space-y-3">
{trendingTopics.map((topic, index) => (
<button
key={index}
className="block w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors"
>
<span className="text-blue-500 font-medium">{topic}</span>
<p className="text-gray-500 text-sm mt-1">1,245 条相关内容</p>
</button>
))}
</div>
</div>
<div className="mb-8">
<div className="flex justify-between items-center mb-4">
<h2 className="text-lg font-semibold text-gray-900">草稿箱</h2>
<button className="text-blue-500 text-sm">查看全部</button>
</div>
<div className="space-y-3">
{drafts.map((draft) => (
<div key={draft.id} className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
<h3 className="font-medium text-gray-900 truncate">{draft.title}</h3>
<p className="text-gray-500 text-sm mt-1">{draft.time}</p>
</div>
))}
</div>
</div>
<div>
<h2 className="text-lg font-semibold text-gray-900 mb-4">快速操作</h2>
<div className="grid grid-cols-2 gap-3">
<button className="p-4 border border-gray-200 rounded-lg flex flex-col items-center hover:bg-gray-50 transition-colors">
<EditOutlined className="text-2xl text-blue-500 mb-2" />
<span className="text-gray-700">新建发布</span>
</button>
<button className="p-4 border border-gray-200 rounded-lg flex flex-col items-center hover:bg-gray-50 transition-colors">
<CalendarOutlined className="text-2xl text-blue-500 mb-2" />
<span className="text-gray-700">安排发布</span>
</button>
<button className="p-4 border border-gray-200 rounded-lg flex flex-col items-center hover:bg-gray-50 transition-colors">
<BarChartOutlined className="text-2xl text-blue-500 mb-2" />
<span className="text-gray-700">数据分析</span>
</button>
<button className="p-4 border border-gray-200 rounded-lg flex flex-col items-center hover:bg-gray-50 transition-colors">
<SettingOutlined className="text-2xl text-blue-500 mb-2" />
<span className="text-gray-700">账户设置</span>
</button>
</div>
</div>
</aside>
</div>
{/* 底部悬浮按钮 */}
<button className="fixed bottom-8 right-8 w-14 h-14 bg-blue-500 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-600 transition-colors z-10">
<PlusOutlined className="text-2xl" />
</button>
</div>
);
};
export default App