# EchoType项目启动文档（Project Kickoff Doc / Spec）-  AI prompt + coding project 起点文档





### 名称Title(Market Name): 

EchoType — Repeat, type, and remember meaningful English texts（主slogan）/ Practice English typing with your own annotated texts.（副标题）

---

### 是什么： 产品形式目标Overview / Vision

一个部署成功的网站

---

### 是什么：产品功能上的本质One-line product statement

用户自己控制/定制打字内容的英文打字休闲工具

---

### why： 目标用户Target Persona 

非英文母语的用户 - 需要在英文打字旁输入注释

根据我自己对我自己习惯的判断，我自己应该成为重度的用户

---

### why：用户使用的场景 User Scenarios

用户无聊时，做点重复，不动脑的事情， 重复打字句子，边听音乐（是场景， 项目MVP阶段本身不提供音乐，用户自己肯定是喜欢听自己的。）

为什么无脑？ 只是打字，上面是文本，相当于打字抄而已

这种打字带有一些学习的效果， 即重复打自己喜欢/收藏的句子 或 小文章。 让英文学习者通过重复打自己喜欢的英文句子/文章 达到休闲加学习的利用零散、松弛时间的目的。

用户可以一开始输入自己要打什么的文本（接入语法纠正接口-比如AI语法修正-保证英文语法上是正确的-先不做！），然后可以输入注释（这就要求用户输入的文本每一行固定位置，让注释能准确对应用户想要的地方）。

一些很适合的文本： 1， 飞鸟集；  2，名人名言 ； 3， 英文圣经的箴言 ； 3， 英文美散文美短文 eg： 《younth》- Samuel Ullman；《Gettysburg Address》-Abraham Lincoln ； 4， 英文习语；

---

### why 这个项目想解决的当前现实问题Problem Statement - 痛点 - 碰到什么让你想要做这个项目

人的focus的时间是有限的，在无法focus on的大量时间内，需要做一些重复，简单，不动脑的事情，同时最好能又点意义。

有些人喜欢抄书抄名人名言/记下自己喜欢的话/记下自己喜欢的口语台词（比如我个人）， 但是只是记下是不够的，记在本子上如果不经常看，马上忘记。所以需要在零散时间，通过肌肉记忆，不经意的不断重复，来帮助强化这种记忆。 不至于被生活的洪流给淹没，沦为只是记在笔记本上的东西。

基于目前应用软件和AI的兴起，目前的打字服务，趋于衰落，很多也不再更新新的服务。

这种小需求目前没有人做。

特别是自己给自己注释的这种功能，对于非英文母语非常重要，因为很多时候人们要通过自己母语的注释来帮助记忆。注释要和打字分开。 注释的位置要准确，让用户能看得到。 

---

### 类似项目/灵感来源/是什么和什么的缝合？

**金山打字通**  https://www.51dzt.com/rubik-ssr/51dzt

在线打字练习  https://dz.wubidz.cn/dzlx.php

---

### 项目定位
 **个人习惯驱动 + full-stack 工程展示 + 云部署练习** 的作品

**An annotated typing practice web app for English learners to repeatedly type personally meaningful texts with self-written native-language notes.**

中文就是：

**一个面向英文学习者的“带个人注释的重复打字复习工具”。**

你的核心差异化应该明确成三句话：

1. **Not speed-first**：不是为了冲 WPM，而是为了低压力复习英文文本。
2. **Not random-text-first**：不是随机词/随机句，而是用户自己收藏的 meaningful text。
3. **Annotation-first**：不是单纯打字，而是带用户自己的母语注释和理解痕迹。

---

### 项目技术目标和优先级总结

主目标是：第一优先级是个人“技术作品集项目”，  一个部署成功的可用产品（打字体验顺滑，注释功能顺滑），次目标是 练习CICD部署和使用AWS，冲突时 可用性和用户体验感 优先。

**展示解决一个有趣的工程问题**：锚点稳定性、文本编辑后的 reanchor、UI 渲染、跨行处理 —— 自定义注释功能是最核心功能！

**Walking Skeleton**：最小的端到端：  登陆→ 新建或选择一个“练习文本（课程）“ → 进入打字界面打字 → 数据存进数据库。


---

### MVP用户正常操作流User Flow

1. 进入网站
2. 登陆账户 
3. 选择模式—— 简短模式/ 文章模式 
4. 进入模式界面
5. “模式界面”有2种模式： 简短模式/ 文章模式 
6. 2种模式分开打开单独的界面 -  简短“模式界面”/ 文章“模式界面” 
7. “模式界面”是展示不同类别的“练习文本（课程）“ 的容器。 这个界面的其他部分简短“模式界面”和文章“模式界面” 几乎是一样的（页面componet尽量共用）
8. 在“模式界面”里看到自己账户下的已存储“练习文本（课程）“ （“简短模式”/ “文章模式” 分开存储） - 每个已存储“练习文本（课程）“ 可编辑。
9. 在“模式界面”里，每个已存储“练习文本（课程）“ 的前端展示：是一个个长方形的card-“练习文本（课程）card“ - “模式界面” 右上角有带fitter 排列的搜索框 （可以模糊搜索内容和标题和注释），fitter决定“练习文本（课程）card“ 排列的排序方式模式。
10. “练习文本（课程）card“ 上有编辑/删除 两个按钮
11. 用户点击“练习文本（课程）card“ 的编辑按钮，进入 ”练习文本（课程）编辑界面“（一个popup弹窗界面），对自己账户下已有的“练习文本（课程）“进行编辑。
12. 用户点击“练习文本（课程）card“ 的删除按钮，这个“练习文本（课程）card“和其对应的“练习文本（课程）“会从前端显示和数据库里删除。
13. “模式界面”右上角有一个button ——“建立新的文本（课程）button” 
14. 点击“建立新的文本（课程）”button，进入 ”练习文本（课程）编辑界面“（一个popup弹窗界面）
15. 用户在”练习文本（课程）编辑界面“里进行操作- 新建/编辑
16. 用户操作完成后，点击，”练习文本（课程）编辑界面“最下面的“确认”按钮后， 系统检测
17. 检测不通过，让用户修正，还是用“确认”按钮retry， 直到检测通过， 这个“练习文本（课程）” 完整存储到数据库（新建或刷新）。
18. 用户自动跳转到对应的 “模式界面” （ 简短“模式界面”/ 文章“模式界面” ）
19. “模式界面” 下的“练习文本（课程）”排列，默认按照建立时间从新到旧排列，所以刚刚建立的那个“练习文本（课程）” 自动是排在第一个的。
20. 用户点击任意一个已存储“练习文本（课程）” 进入“打字界面”
21. 进入“打字界面” 有一个功能 - session定时（不让用户不知不觉浪费时间，适合有规划的用户）-  “session定时是否card” - 一个 componet- 在这里可以选“定时”或者“不用”
22. 如果用户选了“定时”，用户设定“定时时间（分钟/小时 - 两种计量单位-最多2小时）”-打字界面的“session计算统计”倒计时
23. 如果用户选了“不用”，-打字界面的“session计算统计”是开始累积算时间
24. “session定时是否card” 选择完毕后，用户进度“打字界面”
25. 打字界面： 3行- 文本行/ 注释行/ 打字输入行； 打字输入行和文本行要check，不对地方标红。以此来计算正确率。 关于注释行（注释层的技术实现见“注释定位的流程设计/ 技术解决方案 ”部分第 10 条：overlay，非固定行）
26. 打字允许使用“backspace”键去退格修正
27. 打完当前“练习文本（课程）“自动循环，一直无限连, 让用户没有中断感"
28. 停止的条件： 1， 用户自动关闭 ； 2， 如果用户在 “session定时是否card”选了“定时”， 打字界面的“session计算统计”倒计时结束后通过弹出一个“结束提示弹窗popup”来结束。
29. 下方有个”打字界面数据统计bar“做数据统计： 本次打字session时间（到秒）（“session计算统计”-一个计时器）； 打字速度（word/每分钟）；进度（%）；正确率；文本循环次数
30. 在”打字界面数据统计bar“下面还有一个”打字界面功能操作bar“： 上面有功能按钮 ： 1.从头开始 ；2. 暂停（点击进入暂停状态： 暂停”打字界面数据统计bar“上的数据实时计算， 但一旦检测到开始输入，自动结束暂停状态）
31. 每次打字结束后，这些统计都存储为一次“单次打字记录”，进入数据库去刷新“练习文本（课程）累积总数据”
32. 更新的“练习文本（课程）累积总数据”数据，显示在前端“练习文本（课程）card”上（排序方式/数据展示）。


---

###  ”练习文本（课程）编辑界面“ 弹窗的功能要求 
 ”练习文本（课程）编辑界面“ 弹窗 - 新增“练习文本（课程）” 和 编辑“练习文本（课程）” 都是共用这一个操作页面 —— ”练习文本（课程）编辑界面“ 弹窗
这个popup的进入方式—— 2个scenario
1. 用户新建“练习文本（课程）”： 点击模式界面上“建立新的文本（课程）”button，进入一个popup弹窗界面 ”练习文本（课程）编辑界面“
2. 用户编辑自己账户下已经存在的“练习文本（课程）”：在“模式界面”下的，每个“练习文本（课程）card“上有一个button“编辑button”，点击这个“编辑button”进入

能输入和编辑什么？ ： “课程名称“（标题）；”文本内容“（通过输入框输入）；”注释“； mp3音频（MVP阶段不做，但留slot）； 

新建和编辑操作流控制：
1. 无论新建还是编辑，是按照流程一步步来的，每一步都是独立编辑界面，通过下方“确认”键触发检测，检测不通过，让用户修正，还是用“确认”按钮retry， 直到检测通过。 在“确认”键旁边还有一个“back”键，让用户可以返回上一个编辑界面。
2. 编辑窗口1:  “课程名称”（标题）和 “文本内容”两个输入框  - 必须填- 做必要输入检测
3. 编辑窗口2: 根据用户在编辑窗口1输入的“文本内容”，tranfer为“打字界面”会显示的“文本行”。下面有一个2选一按钮（必选）：“是否需要输入注释”， 如果选择”NO“， 直接跳过编辑窗口3，进入编辑窗口4
4. 如果选”是“，进入编辑窗口3
5. 编辑窗口3: 在编辑窗口2展现的“文本行”上，每一行上都平行出一行“注释行”， 用户先通过，选择“文本行”上的“锚字符-起点” 和 “锚字符-终点”界定出“单位注释空间”； 然后在“单位注释空间”上输入“注释”文本； 过程是1：1对应的，先界定一个“单位注释空间”，再在这个“单位注释空间”输入，做输入检查，然后才能去界定下一个“单位注释空间”。
6. 编辑窗口3: “单位注释空间”可以单独删除和编辑，如果删除这个 “单位注释空间”里的“注释”文本也会全部连带删除。 “单位注释空间”编辑：通过用户自己去改变“锚字符-起点” 和 “锚字符-终点”控制长度。
6. 编辑窗口3做整体必要输入检测，如果发现没有出现“注释”文本，不通过。 注意：是检测“注释”文本是否为空，而不是检测是否有“单位注释空间”，因为有“单位注释空间”但没输入任何“注释”文本是违法行为。
7. 编辑窗口4： 为用户展示： “文本行”和“注释行”整体呈现。 让用户检查，自己输入的注释，是否出现在想要的位置；让用户自己判断，自己界定的“单位注释空间”长度是否足够。
8.  用户操作完成后，点击，”练习文本（课程）编辑界面“最下面的“确认”按钮后， 系统再次检测输入完整性
9.  检测不通过，让用户修正，还是用“确认”按钮retry， 直到检测通过， 这个“练习文本（课程）” 完整存储到数据库（新建或刷新）。


---
### “简短模式“ 和  “文章模式”的界定
如果你允许用户放进几万字文章，前端逐字符渲染、逐字符高亮、注释定位都会变重。

MVP ：

```text
Short mode: 20–500 characters
Article mode: 501–5,000 characters
```

超过 5,000 字时提示用户拆分。


---

###  ”打字界面“ 的功能要求和UI描述

#### 基本UI描述
有3行，且3行完全平行， 从上到下按照如下123顺序：
1.“注释行”（这里是和其他打字网站/软件不一样的地方）（注释层的技术实现见“注释定位的流程设计/ 技术解决方案 ”部分第 10 条：overlay，非固定行）
2.“文本行”
3.“打字行”

”注释行“的特殊性质： 如果检测某一行“文本行”所对应的“注释行” 是空的。 这些空行”注释行”自动隐藏。

下方有个”打字界面数据统计bar“做数据统计： 本次打字session时间（到秒）； 打字速度（word/每分钟）；进度（%）；正确率；文本循环次数

在”打字界面数据统计bar“下面还有一个”打字界面功能操作bar“： 上面有功能按钮 ： 1.从头开始 ；2. 暂停（点击进入暂停状态： 暂停”打字界面数据统计bar“上的数据实时计算， 但一旦检测到开始输入，自动结束暂停状态）

#### 特定功能要求
1. 打字允许使用“backspace”键去退格修正
2. 打完当前“练习文本（课程）“自动循环，一直无限连, 让用户没有中断感"
3. 停止的条件： 1， 用户自动关闭 ； 2， 如果用户在 “session定时是否card”选了“定时”， 打字界面的“session计算统计”倒计时结束后通过弹出一个“结束提示弹窗popup”来结束。
4. 每次打字结束后，这些统计都存储为一次“单次打字记录”，进入数据库去刷新“练习文本（课程）累积总数据”






---

### 注释定位的流程设计/ 技术解决方案 

目标： 位置准确！注释出现在，用户想看到的地方。 注释是这个项目最核心的功能。 
用户在”练习文本（课程）编辑界面“  里编辑和输入注释的流程： 

1. 用户先输入  “课程名称”（标题）；“文本内容”（通过输入框输入）；
2. 自动对用户输入的“文本内容” 进行处理，检测（是否是合法字符）， 检测成功后，呈现给用户“文本行”- 分行呈现。

3. ”练习文本（课程）编辑界面“下有一个选择框 ：“是否输入注释”， 如果选择”是“，用户开始输入注释，如果选择”NO“， 直接跳过。
4. 当用户在选择框 ：“是否输入注释”， 选择”是“。 在“文本行”上方出现“注释行”
5. 注释以“文本内容” 的单个“字符”为锚。这个字符就是”锚字符“。 空格不能作为”锚字符“
6. ”锚字符“ 用来规定注释位置的起点和终点。 注释起点是”锚字符-起点“， 注释终点是”锚字符-终点“， ”锚字符-起点“和”锚字符-终点“在“注释行”划定的位置，就是用户输入的注释的显示位置：“单位注释空间”。 - “锚字符”本质是位置 index
7. 用户用鼠标在“文本行”选择”锚字符-起点“和”锚字符-终点“。  做输入必要检查，同时”锚字符-起点“的位置要前于”锚字符-终点“ ： 用户用鼠标"选锚字符"- 每个字符渲染成一个 `<span data-idx="N">`，挂 click handler。
8. 2个“单位注释空间”不能overlap，  否者会造成注释字重叠。 所以每个“单位注释空间”是排他的。 在“单位注释空间”的所有字符，不能再作为其他“单位注释空间”的”锚字符“
   逻辑是：

```ts
function hasOverlap(newStart, newEnd, existingAnnotations) {
  return existingAnnotations.some(a =>
    newStart <= a.endIndex && newEnd >= a.startIndex
  );
}
```

如果 overlap，就拒绝创建。

跨行注释占用其 `[startIndex, endIndex]` 的完整连续区间。中间被跨越的行虽然不显示注释文字，但其字符已被占用，不可再被其他注释锚定。这是为保证注释高亮永不重叠的有意约束。



9.  “单位注释空间”在“注释行”上显示的字体大小： 默认是和“文本行”是一样大小的；最多在 “单位注释空间”里裂变成2行。“单位注释空间”太小、内容太长——最多裂变成 2 行，字体变小，多余展示不出来，属于用户责任。Inline annotation preview is limited to 2 lines. Full note is shown on hover/click.- 最多 2 行 + 最小字号 11px（绝对值，不是相对值），仍然装不下就 `text-overflow: ellipsis`，悬停时 tooltip 显示完整内容。 
    也就是说：

- 注释行只显示短预览；
- 太长就省略；
- 用户 hover 或 click 后弹出完整注释。

10. 如果那一行没有任何注释，对应的“注释行”整行自动隐藏。”注释行“的特殊性质： 如果检测某一行“文本行”所对应的“注释行” 是空的。 这些空行”注释行”自动隐藏。 - 检测的动作只能发生在前端，是视觉为空的“注释行”删除。 技术实现上：

    **无注释的行 / 注释层布局**

    如果某视觉行上方没有任何注释，则该行不预留注释空间（行高动态收缩）。

    - **Visual model**: Users perceive the typing area as three aligned layers — annotation layer (top), source text layer (middle), input layer (bottom).
    - **Technical model**: The annotation layer is an absolutely positioned overlay above the source text layer. It is **not** a fixed per-line row. Annotation rectangles are positioned at render time via `Range.getClientRects()`, which returns one rectangle per visual line fragment and handles line-wrapping automatically.
    - **Storage**: Annotations are stored only as global character-index ranges (`startIndex` / `endIndex`); no line or column position is ever persisted. Visual line breaks are recomputed on every render.
    - **Empty-line behavior**: When a visual line has no annotation rectangle above it, no vertical space is reserved for annotations on that line — the annotation slot for that line collapses to zero height.
    - **Note text placement (cross-line)**: For an annotation spanning multiple visual lines, the note text is rendered above the first rectangle (`rects[0]`); the remaining fragments render highlight only.

    

11. 锚字符的本质是"位置"不是"字符"，文本里提到的"锚字符"技术上存的不是字符本身，是它在 source string 里的 index。也就是 {startIdx: 5, endIdx: 12, annotation: "悲哀"}。这没问题—— index 思维

12. 用户选择“锚字符-起点”和“锚字符-终点”，系统根据这两个位置划定“单位注释空间”，注释显示在对应文本上方：
    本质上不要真的把“锚字符”当成复杂对象，而是存成：

```ts
type Annotation = {
  id: string;
  courseId: string;
  startIndex: number;
  endIndex: number;
  noteText: string;
  anchoredText: string;   // 标注时 content.slice(startIndex, endIndex+1) 的快照，用于编辑后复核
};
```

也就是说：

- `startIndex` = 注释对应文本片段的起始字符位置；
- `endIndex` = 注释对应文本片段的结束字符位置；
- `noteText` = 用户写的中文/母语注释。

用户界面上看起来是“选择锚字符”，但数据库里只需要保存字符 index。

所以技术模型应该是：

> selected text range → startIndex / endIndex → annotation record.

不要把数据库设计成“锚字符实体”。锚字符只是用户交互概念，不应该变成复杂数据结构。


13. 关于注释的精确显示： 注释行、文本行、打字输入行三行完全平行。
    如果你用普通 proportional font，比如 Arial、Inter、Roboto，不同字符宽度不一样：

```text
i 很窄
W 很宽
```

这会让“字符级对齐”非常难。
推荐：

```text
Typing area uses monospace font only.
```

例如：

- JetBrains Mono
- Fira Code
- Menlo
- Consolas
- Courier New

这样每个字符宽度一样，你才能比较可靠地把注释显示在对应位置。

14. 关于注释的数据库存储：
    不要把注释存成：

```text
第 3 行，第 8 个字符到第 14 个字符
```

因为屏幕宽度一变，换行就变了。用户电脑、浏览器窗口、字体大小不同，“第几行”都会变化。

应该存成：

```text
全文第 120 个字符到第 136 个字符
```

也就是全局字符 index。

然后前端根据当前页面宽度，把文本切成视觉行，再把 annotation 映射到对应行上。

所以数据模型应该是：

```ts
content: string;

annotations: [
  {
    startIndex: 120,
    endIndex: 136,
    noteText: "中文注释"
  }
]
```

而不是：

```ts
lineNumber: 3;
startColumn: 8;
endColumn: 14;
```

**结论：存全局 index，不存视觉行位置。*



15. 关于注释在前端跨行的问题： 用户能选"锚字符-起点"在第 1 行、"锚字符-终点"在第 2 行/第3行 ...（也就是"锚字符-起点"和"锚字符-终点"是可以跨行的）。 "锚字符-起点"和"锚字符-终点"只是划定“文本内容”上的空间，这个空间平行往上到“注释行”就是"单位注释空间"。和跨行无关。 UI上断行自动处理即可，和文本行的断行是一样的。

> 1. **存储**：注释 = `{startIndex, endIndex, noteText}`，对 content 的全局字符闭区间。不含任何行列/视觉信息，跨行在数据层不存在。
> 2. **渲染**：用 `Range.getClientRects()` 让浏览器实测注释区间占据的屏幕矩形；跨行时自动返回多个矩形片段，前端只负责把这些矩形画出来，不手动计算折行位置。
> 3. **前提**：编辑界面与打字界面字体/字号/宽度规则完全一致，且渲染统一走 `getClientRects()` 路线（禁止手动算行列）。
> 4. 跨行注释占用其 `[startIndex, endIndex]` 的完整连续区间。中间被跨越的行虽然不显示注释文字，但其字符已被占用，不可再被其他注释锚定。这是为保证注释高亮永不重叠的有意约束。

16. 文本编辑后的注释处理（复核机制）：
    1. 注释存储增加 anchoredText 快照字段（标注时被注释的原文片段）。
    2. 用户编辑"文本内容"期间，注释不实时重算（避免抖动）。
    3. 用户确认修改后，系统逐条比对：取注释当前 `[startIndex, endIndex]` 在**新 content** 上切出的片段 `newContent.slice(startIndex, endIndex+1)`，与存储的 `anchoredText` 快照做**全等比对**：
       - `newContent.slice(startIndex, endIndex+1) === anchoredText` → 标绿，保留
       - 不相等 → 标黄，进入复核
    4. 复核界面：黄色注释显示其 anchoredText 和 noteText，
       要求用户重新拖动锚点到正确位置，或删除该条。
    5. 复核完成后（用户重新锚定或确认位置），该注释的 `anchoredText` 必须用新的 `content.slice(startIndex, endIndex+1)` 重新生成，保证快照与当前位置一致。
    6. 全部复核通过后，最终确认写库。
       责任划分：系统负责"检测可能失配"，用户负责"确认最终位置"。





---

### 基于什么功能需求去设计数据库？ Data Model / Data Contract(数据模型) 要实现的东西


#### 1.  “练习文本（课程）“ 的数据属性：
1. 是“简短模式”/ “文章模式” 分开存储的，要分成这两种type（目录）
2. “练习文本（课程）累积总数据“ 是attach在“练习文本（课程）“ 上的数据： 
3. “单次打字记录” 是attach在“练习文本（课程）“ 上的数据 
4. 主体内容：  课程名称（标题）；文本内容（通过输入框输入）；注释（这是一个大类）； mp3音频（留slot）； 
5. 目录模式（新建，编辑，删除）- 一定要留slot： 比如一个目录是一个上下文完整的文本。比如在简短“模式界面”下有一个目录：就叫《飞鸟集》，里面有完整版300多条《飞鸟集》的short poems的“简短模式”。 一个目录就是一本书； 在文章“模式界面”下有一个目录叫《美文30篇》或者《演讲词自我搜集》

#### 2. 单个数据单元“练习文本（课程）“下的两个属性“练习文本（课程）累积总数据“ 和“单次打字记录”联动关系
1. “练习文本（课程）累积总数据“ 是attach在“练习文本（课程）“ 上的数据
2. “单次打字记录” 是attach在“练习文本（课程）“ 上的数据
3. “练习文本（课程）累积总数据“ 和“单次打字记录”存在联动关系：  “单次打字记录” 的其中相关数据是每次结束后累积在“练习文本（课程）累积总数据“上的，重新做累积计算，更新出最新的“练习文本（课程）累积总数据“


#### 3. “单次打字记录” 数据单元要记录什么东西
1.单个session的打字数据统计：  本次打字session时间（到秒）； 打字速度（word/每分钟）；正确率；文本循环次数
2.这个session的练习时间 - 启动和关闭（到秒）


#### 4.  “练习文本（课程）累积总数据“数据单元要存储什么？ 
1. 最新的练习时间 - 来自“单次打字记录”的每次刷新
2. 打字总速度 / 总session时间/ 总正确率/文本总循环次数
3. 最新编辑时间-（注释/正文 等任何编辑）


#### 5.  需要载数据库里提前写入的例子
1. “简短模式” 一个例子 —— 《STRAY BIRDS- 49 》“I thank thee that I am none of the wheels of power but I am one with the living creatures that are crushed by it. ”
2. "文章模式"一个例子——《What I have Lived For》—— Bertrand Russell “Three passions, simple but overwhelmingly strong, have governed my life: the longing for love ,the search for knowledge, and unbearable pity for the suffering of mankind. These passions, like ......” 这篇小短文

#### 6. `Annotation` 类型定义里要有 `anchoredText` 字段**。

注释存储增加 anchoredText 快照字段（标注时被注释的原文片段）。

```
type Annotation = {
  id: string;
  courseId: string;
  startIndex: number;
  endIndex: number;
  noteText: string;
  anchoredText: string;   // 新增：标注时 content.slice(startIndex, endIndex+1) 的快照，用于编辑后复核
};
```



#### 7.关于“练习文本（课程）”的删除。

用户点击“练习文本（课程）card“ 的删除按钮，这个“练习文本（课程）card“和其对应的“练习文本（课程）“会从前端显示和数据库里删除。—— 做物理删除（完全删除）。

物理删除 + 级联删除 + 前端二次确认。



---

### 模块/功能 之间的联动关系

#### “练习文本（课程）累积总数据“ 和“模式界面”里的“练习文本（课程）“排序展示功能

1. “练习文本（课程）累积总数据“直接影响到“模式界面” 下的“练习文本（课程）”排列，排列的数据全部来自于“练习文本（课程）累积总数据“
2. “模式界面” 下的“练习文本（课程）”排列 默认按照建立时间从新到旧排列。
排列的排序方式模式： 1. 建立时间从新到旧 ； 2.建立时间从旧到新； 3.最新编辑时间从新到旧； 4. 按照打字完成循环次数从多到少；5. 按照累积session时间从多到少； 6. 按照“练习文本（课程）”的标题A-Z排序； 7. 最新练习时间。



---

### authentication
这个web整体2种浏览模式 - ”不登陆的浏览模式“ / “登陆账号模式”
账户登陆账户方式 - google账户直接登陆 / 普通邮箱 2种方式直接登陆
区别： 登陆后的模式可以看到自己账户下的存储的“练习文本（课程）”

"不登录浏览模式"和“登陆模式”的区别在于，新建的“练习文本（课程）”是临时的，不会存储，因为存储是base账号的，没有账号登陆，当然无法存储。不登录用户能看到我们一开始写入的示例文本



---

### Constraints / Boundaries(约束 / 边界)-在做这个项目时,必须遵守 / 必须先问我 / 永远不要做"的硬规则
1. 所有技术设计第一优先保证载“打字界面”打字顺畅： 输入的字符无延迟，键盘输入马上显示在“打字输入行”，并且马上与“文本行”比对，同时无延迟的计算“打字正确率”和“打字速度”
#### NFR 具体数字

| 项目 | 给你的数字 | 理由 |
|---|---|---|
| 输入到屏幕显示延迟 | < 16ms（一帧） | React 受控 input 在现代浏览器就是这个水平，达不到说明代码写错了 |
| 对错判定 | 100% 前端 in-memory | 后端完全不参与 |
| 同步后端时机 | session 结束时 1 次 + 每 30 秒心跳备份 | 防止断网/崩溃丢全部数据 |
| 首屏加载 | < 2s（包含 React bundle）| Vite + code splitting 轻松达到 |
| concurrent users | 1-5 | 写明，避免架构过度设计 |
| 持久化可接受延迟 | session 结束后 < 2s 写入完成 | 用户能感知 |
| 断网怎么办 | localStorage 写一份 backup，恢复时 sync | 简单可靠 |

####  实时打字比必须前端本地完成
你的硬约束是：

> 打字界面打字顺畅，输入字符无延迟，马上显示，马上比对，马上计算正确率和打字速度。

这完全可实现。

但规则是：

```text
Typing comparison must happen entirely in frontend state.
```

不能每敲一个字就请求后端。

正确架构是：

```text
User typing
→ React local state
→ compare with target text locally
→ update error highlight / WPM / accuracy locally
→ when session ends, send summary to backend
→ backend saves TypingSession
```

后端只负责保存结果，不参与实时输入判断。



2. 代码相关和UI相关部分，请都使用英文。




---


### 技术栈Tech Stack 和 工具使用计划


Frontend:    React + Vite + TypeScript
             Tailwind CSS + shadcn/ui
             Zustand + TanStack Query

Backend:     Node.js + Fastify + TypeScript
             Prisma + PostgreSQL
             Zod (schema 校验)

Auth:        AWS Cognito

Container:   Docker + docker-compose（本地）

CI/CD:       GitHub Actions
             Terraform（IaC）

Cloud:       EC2 free tier + RDS free tier（= t4g.micro EC2 + db.t4g.micro RDS PostgreSQL） 【前 12 个月免费， 开账单告警，控制成本】

监控:        Sentry + CloudWatch Logs

**关于 Docker**：本地 docker-compose；上云后在 EC2 上 `docker compose up` 或 docker run。

---
### 云方案

**关于 CICD 什么时候介入**——**Walking Skeleton**（最小的端到端：  登陆→ 新建或选择一个“练习文本（课程）“ → 进入打字界面打字 → 数据存进数据库。）跑通的那一刻，立刻上 CICD。

后端云需求：

1. 用户账户；
2. 用户私有课程；
3. 自定义文本存储；
4. 注释数据存储；
5. session 记录；
6. 累积统计；
7. 多设备访问；
8. 在线作品集展示。



| 领域                           | 项目落地                                         |
| ------------------------------ | ------------------------------------------------ |
|                                |                                                  |
|                                |                                                  |
| RDS                            | PostgreSQL 直接上 RDS                            |
| S3 + CloudFront                | 前端静态资源；以后 mp3 也放这                    |
| Route 53                       | 自己买个域名挂上                                 |
|                                |                                                  |
| Cognito                        | 你 doc 里要"Google + 邮箱"登录，Cognito 正好覆盖 |
| IAM                            | 每个服务的 role                                  |
| Secrets Manager                | DB 密码、OAuth secret                            |
| CloudWatch                     | 日志、metric、alarm                              |
| CICD：CodePipeline / CodeBuild | GitHub Actions → SSH + docker compose pull/up    |





---



### 开发阶段

**本地阶段**：docker-compose 跑通，把核心打字 + 注释功能写出来 -Docker Compose: backend + PostgreSQL

**上云阶段**：单 EC2 + RDS 跑起来，GitHub Actions 自动部署。练 IAM/VPC/RDS/EC2

**架构升级阶段**：CloudFront，加 Cognito。



---
### 界面和componet的list （有哪些page和popup和可见的component）


1. “网页首页”
2. “模式界面” - 2种
3. “练习文本（课程）card” ： 上面有“课程名称”（标题）；“正文文本”漏头节选；总循环次数（来自“练习文本（课程）累积总数据“）；总session时长（来自“练习文本（课程）累积总数据“） ；最新练习时间（来自“练习文本（课程）累积总数据“） 
4. “session定时是否card” - 一个popuo弹窗
5. popup弹窗操作界面 ”练习文本（课程）编辑界面“
6. “打字界面”
7. “结束提示弹窗popup”



---

### 功能方面总结


#### MVP的功能List总结  MVP Scope
1.  “练习文本（课程）”管理
2.  用户自定义“练习文本（课程）” - “文本内容”和“注释”
3.  注释锚点
4.  打字界面
5.  “文本行”和“打字行”的实时比对
6.  “练习文本（课程）”的数据 统计
7.  数据库存储
8.  登录账户
9.  云部署



#### 留下slot但功能先不做
1. 文本发音 ：  类似背单词软件的例句发音 - 内置文本比如飞鸟集，可以找到对应诗句的发音/自定义 ，自己定制的文本，可以自己传入mp3和自己录音进去 - 留下slot但不做。   —— 其实很有意思，特别是自己录音，很多喜欢的句子，可以自己发音进去，下次听到自己的声音，不会忘记。考虑第一次迭代时候升级。


---

### 边缘情况Edge Cases 
1. session时间太短 - 纳入总统计应该有一个阈值（至少60秒）- 参考成熟产品做法
2. 循环补正： 用户不会总停止在一个循环完整结束的时候，最后的那个循环如果没有完成， 不算一次循环。
3. **完整循环的判定**：“文本内容” 最后一个字符输入，无论对错注释行和文本行都会进行匹配和计算正确率。 
4. **窗口失焦**：用户切走 5 分钟再回来，只要用户没有在11“打字界面功能操作bar”上进行“暂停”操作，就是自动统计的。
5. **退格穿越**：用户能退格回到上一行修正， 最多退回到本次文本循环的文本起点。 但是”打字界面数据统计bar“是线性统计的，退格穿越的话，时间也是增加累积的，也就是意味着打字速度统计上会变慢。
6. **退格穿越的边界极限**： 只能在这个文本循环里，不能退回到上个文本循环。
7. **输入法干扰（IME）**：目标用户是非英语母语，他们电脑上**很可能装着中文/日文/韩文输入法**——这会导致输入英文时跳出候选框、变成全角字符、产生 composition events。这对"无延迟打字"是致命的
不要试图屏蔽，**检测并提醒**就好：

```js
inputEl.addEventListener('compositionstart', () => {
  showBanner('Please switch to English input method (Caps/Shift, etc.)');
  pauseSession();
});
```

你目标用户是中文母语者，他们知道这个问题，提示就够了。强行 `ime-mode: disabled` 在新浏览器已经废弃，不可靠。


8. 粘贴行为：用户在打字行 Ctrl+V 粘贴整段答案，统计上如何处理

最简单的策略：**允许粘贴，但粘贴的字符不计入 WPM（Words Per Minute，每分钟打字单词数） 也不计入正确率**。

```js
inputEl.addEventListener('paste', e => {
  flagAsPasted(currentPosition, pastedLength);
  // 这些位置在统计时跳过
});
```
不要禁止粘贴——禁止反而违反"放松、低压力"的产品定位。


9. “单位注释空间”太小、内容太长——最多裂变成 2 行，字体变小，多余展示不出来，属于用户责任。Inline annotation preview is limited to 2 lines. Full note is shown on hover/click.- 最多 2 行 + 最小字号 11px（绝对值，不是相对值），仍然装不下就 `text-overflow: ellipsis`，悬停时 tooltip 显示完整内容。 
也就是说：

- 注释行只显示短预览；
- 太长就省略；
- 用户 hover 或 click 后弹出完整注释。

---

### **Do Not Build in MVP**：



Do NOT build automatic reanchoring in MVP.
Do NOT create AnchorChar as a database entity.
Do NOT store annotation line/column positions.
Do NOT use WebSocket for typing comparison.
Do NOT call backend on each keystroke.
Do NOT deploy ECS Fargate in the first cloud MVP.
Do NOT add Kubernetes, NAT Gateway, queues, or microservices.
Do NOT enforce strict English-only content validation.



---



### Glossary(术语表) 


“练习文本（课程）“ ：一个完整的数据存储单元

“文本内容” ：“练习文本（课程）“数据单元下，核心内容， 决定“文本行”

“打字界面”：用户打字操作时的主要界面
“文本行”：“打字界面”里的一行
“注释行”：“打字界面”里的一行，显示注释的位置。空行要隐藏。"用户视觉上感知的注释层（顶层）。技术上是 overlay 而非固定行，详见“注释定位的流程设计/ 技术解决方案 ”部分第 10 条。
“打字输入行”：“打字界面”里的一行

“锚字符”：所有可以载文本行看见的字符都能作为““锚字符””， 当然“空格”不能作为““锚字符””
”锚字符-起点“：“文本内容” 中被用户选来定位“单位注释空间”的开始位置的一个字符。“注释”的第一个字符与“锚字符”上下平行，之后注释从这里开始展开。
”锚字符-终点“： “文本内容” 中被用户选来定位“单位注释空间”的结束位置的一个字符。

“注释”：
“单位注释空间”： 被”锚字符-起点“和”锚字符-终点“ 截出来的“注释行”的空间，用户在这里输入注释。作为一个注释单位在数据库存储。在对应的“练习文本（课程）“下。

“模式界面”： 一类page，分为简短“模式界面”和文章“模式界面”，基于文本长度判定。
“简短模式”： 其实就是，普通的打字软件里的 ”单句模式“，只是我不想规范成单句那么死。几个单句也可以。
“文章模式”： 明显较长的“文本内容” 
“练习文本（课程）card“ - 在“模式界面”上展示的模块-有编辑/删除的按钮

”练习文本（课程）编辑界面“  ： 一个popup弹窗可操作界面- 用户新增/编辑/删除“练习文本（课程）“都在这里。

”打字界面数据统计bar“ - 在打字界面下方，在显示器下方固定位置（不受“文本行”，“注释行”，“打字输入行”滚动影响）展示的一个bar。
“session计算统计”- 打字界面的一个计时器， 在”打字界面数据统计bar“上。

“练习文本（课程）累积总数据“
“单次打字记录”

“结束提示弹窗popup”

”打字界面功能操作bar“：

”不登陆的浏览模式“ - authentication判定
“登陆账号模式” - - authentication判定



