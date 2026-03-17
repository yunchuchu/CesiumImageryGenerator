## ADDED Requirements

### Requirement: 导出服务支持显式选择渲染后端
导出服务 SHALL 支持通过服务级运行配置选择 `canvas`、`webgl` 或 `auto` 三种渲染后端模式，并在单个导出任务生命周期内使用确定的后端执行全部瓦片渲染。

#### Scenario: 显式选择 canvas 后端
- **WHEN** 服务以 `RENDER_BACKEND=canvas` 运行并收到有效的导出请求
- **THEN** 导出任务 SHALL 使用 canvas 渲染器完成全部瓦片渲染

#### Scenario: 显式选择 webgl 后端
- **WHEN** 服务以 `RENDER_BACKEND=webgl` 运行且 WebGL 渲染环境初始化成功并收到有效的导出请求
- **THEN** 导出任务 SHALL 使用 WebGL 渲染器完成全部瓦片渲染

### Requirement: auto 模式在 WebGL 初始化失败时回退到 canvas
当导出服务以 `RENDER_BACKEND=auto` 运行时，服务 SHALL 优先尝试初始化 WebGL 渲染器；若初始化失败，服务 MUST 自动回退到 canvas 渲染器，而不是直接拒绝整个导出任务。

#### Scenario: auto 模式优先使用 WebGL
- **WHEN** 服务以 `RENDER_BACKEND=auto` 运行且 WebGL 渲染环境初始化成功
- **THEN** 导出任务 SHALL 选择 WebGL 渲染器执行该任务

#### Scenario: auto 模式初始化失败后回退
- **WHEN** 服务以 `RENDER_BACKEND=auto` 运行且 WebGL 渲染器初始化失败
- **THEN** 导出任务 MUST 自动切换到 canvas 渲染器继续执行

### Requirement: 导出失败记录包含瓦片与后端信息
当导出任务在初始化阶段或单瓦片渲染阶段发生失败时，导出服务 SHALL 在输出结果中记录失败详情，至少包含失败瓦片坐标（如适用）、所用后端、错误原因与时间信息，以便调用方排查。

#### Scenario: 单瓦片渲染失败被记录
- **WHEN** 导出任务在渲染某个 `z/x/y` 瓦片时发生异常或超时
- **THEN** 服务 SHALL 在输出目录的元数据或失败记录文件中写入该瓦片坐标、后端类型、错误信息与时间戳

#### Scenario: 初始化阶段失败被记录
- **WHEN** 导出任务在渲染器初始化阶段失败且任务无法继续
- **THEN** 服务 SHALL 在输出结果中记录失败发生在初始化阶段以及对应的后端与错误原因
