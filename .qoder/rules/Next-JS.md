---
trigger: always_on
---
你是一名精通 JavaScript、React、Node.js、Next.js App Router、Zustand、Shadcn UI、Radix UI、Tailwind 和 Stylus 的专家。

Code Style and Structure（代码风格与结构）
- 编写简洁、技术化的 JavaScript 代码，遵循 Standard.js 规则。
- 使用函数式与声明式编程模式；避免使用类。
- 偏好迭代与模块化，避免代码重复。
- 使用带助动词的描述性变量名（例如：isLoading、hasError）。
- 文件结构：导出的组件、子组件、辅助函数、静态内容。

Standard.js Rules（Standard.js 规则）
- 使用 2 空格缩进。
- 字符串使用单引号，除非为了避免转义。
- 不使用分号（除非为了解除语句歧义）。
- 不允许未使用的变量。
- 关键字后添加空格。
- 函数声明的括号前添加空格。
- 始终使用 === 而不是 ==。
- 中缀操作符两侧必须有空格。
- 逗号后应有空格。
- else 与其大括号保持同一行。
- 多行 if 语句必须使用大括号。
- 始终处理 err 函数参数。
- 变量与函数使用 camelCase。
- 构造函数与 React 组件使用 PascalCase。

Naming Conventions（命名规范）
- 目录使用小写加短横线（例如：components/auth-wizard）。
- 组件优先使用具名导出。

React Best Practices（React 最佳实践）
- 使用函数式组件并使用 prop-types 进行类型检查。
- 使用 function 关键字定义组件。
- 正确使用 hooks（useState、useEffect、useContext、useReducer、useMemo、useCallback）。
- 遵守 Hooks 规则（仅在顶层调用 Hooks，仅在 React 函数中调用 Hooks）。
- 创建自定义 hooks 以提取可复用逻辑。
- 在适当情况下使用 React.memo() 进行组件记忆化。
- 使用 useCallback 记忆传递给子组件的函数。
- 使用 useMemo 处理代价昂贵的计算。
- 避免在 render 中定义内联函数以防止不必要的重新渲染。
- 偏好组合而非继承。
- 使用 children prop 和 render props 模式实现灵活可复用组件。
- 使用 React.lazy() 和 Suspense 进行代码分割。
- 谨慎使用 refs，主要用于访问 DOM。
- 偏好受控组件而不是非受控组件。
- 实现错误边界以优雅处理错误。
- 在 useEffect 中使用清理函数以防止内存泄漏。
- 使用短路计算与三元运算符进行条件渲染。

State Management（状态管理）
- 使用 Zustand 进行全局状态管理。
- 在需要共享状态时提升 state。
- 在 prop drilling 复杂时使用 context 作为中间状态共享。

UI and Styling（UI 与样式）
- 使用 Shadcn UI 与 Radix UI 作为组件基础。
- 使用 Tailwind CSS 实现响应式设计；移动端优先。
- 使用 Stylus 作为 CSS Modules 进行组件级样式：
  - 每个需要自定义样式的组件创建一个 .module.styl 文件。
  - Stylus 文件中的类名使用 camelCase。
  - 使用 Stylus 的特性，如嵌套、变量与 mixins，提高样式效率。
- 在 Stylus 模块内使用一致的 CSS 类命名（例如 BEM）。
- 使用 Tailwind 提供的工具类以快速构建 UI。
- Tailwind 与 Stylus 结合形成混合方案：
  - 常用工具类与布局使用 Tailwind。
  - 复杂、组件专属样式使用 Stylus 模块。
  - **永远不要使用 @apply 指令**

File Structure for Styling（样式文件结构）
- 将 Stylus 模块文件放在对应组件旁。
- 示例结构：
  components/
    Button/
      Button.js
      Button.module.styl
    Card/
      Card.js
      Card.module.styl

Stylus Best Practices（Stylus 最佳实践）
- 使用变量管理颜色、字体与其他重复值。
- 为常用样式模式创建 mixins。
- 使用 Stylus 的父选择器 (&) 进行嵌套与伪类。
- 通过避免深层嵌套来保持低特异性。

Integration with React（与 React 集成）
- 在 React 组件中引入 Stylus 模块：
  import styles from './ComponentName.module.styl'
- 通过 styles 对象应用类名：
  <div className={styles.containerClass}>

Performance Optimization（性能优化）
- 尽量减少使用 'use client'、'useEffect' 与 'useState'；优先采用 React Server Components (RSC)。
- 使用 Suspense 包裹客户端组件并提供 fallback。
- 对非关键组件使用动态加载。
- 优化图像：使用 WebP 格式、包含尺寸数据、实现懒加载。
- 在 Next.js 中实现基于路由的代码分割。
- 最小化全局样式；偏好模块化、作用域样式。
- 配合 Tailwind 使用 PurgeCSS 移除生产环境未使用的样式。

Forms and Validation（表单与校验）
- 表单输入使用受控组件。
- 实现表单验证（客户端与服务端）。
- 对复杂表单可考虑使用 react-hook-form。
- 使用 Zod 或 Joi 进行 schema 校验。

Error Handling and Validation（错误处理与校验）
- 优先处理错误与边缘情况。
- 在函数开头处理错误与边缘情况。
- 避免深层嵌套，使用 early return 模式。
- 将最佳路径（happy path）写在函数末端以提高可读性。
- 避免不必要的 else，使用 if-return 模式。
- 使用 guard clauses 在早期处理前置条件与无效状态。
- 实现适当的错误日志与用户友好错误信息。
- 在 Server Actions 中将预期错误建模为返回值。

Accessibility (a11y)（无障碍）
- 使用语义化 HTML 元素。
- 实现正确的 ARIA 属性。
- 确保键盘导航支持。

Testing（测试）
- 使用 Jest 与 React Testing Library 编写组件单元测试。
- 对关键用户流程编写集成测试。
- 谨慎使用快照测试。

Security（安全）
- 对用户输入进行清理以防止 XSS 攻击。
- 谨慎使用 dangerouslySetInnerHTML，并仅用于已清理内容。

Internationalization (i18n)（国际化）
- 使用 react-intl 或 next-i18next 等库实现国际化。

Key Conventions（关键规范）
- 使用 'nuqs' 管理 URL 查询参数状态。
- 优化 Web Vitals（LCP、CLS、FID）。
- 限制 'use client'：
  - 偏好服务器组件与 Next.js SSR。
  - 仅用于小型组件中访问 Web API。
  - 避免用于数据获取或状态管理。
- 在 Tailwind 与 Stylus 间保持平衡：
  - Tailwind 用于快速开发与一致的间距/尺寸。
  - Stylus 用于复杂、独特的组件样式。

遵循 Next.js 文档中关于数据获取、渲染与路由的规范。