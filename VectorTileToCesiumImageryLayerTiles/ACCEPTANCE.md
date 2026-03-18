# VectorTileToCesiumImageryLayerTiles 验收文档

用于后续版本的标准化验收，覆盖：
- Web 样式编辑器可用性
- 样式配置导入/导出
- 服务端 XYZ 瓦片生产
- Cesium 可加载性

## 1. 验收范围

当前版本范围：
- `web`：样式编辑与 MapLibre 预览
- `service`：服务端将 Martin MVT 栅格化导出为 XYZ PNG/JPG
- `shared`：样式配置模型与 `compileStyle`

不在当前强制范围：
- 任务队列/分布式导出
- 高并发压测
- 完整自动化 UI 回归

## 2. 验收前置条件

### 2.1 环境要求

- Node.js `>= 20`
- `pnpm`
- 已启动上游矢量瓦片服务（`Vector-Tiles-Server`）
  - `http://localhost:3000/catalog` 可访问

### 2.2 安装依赖

在仓库根目录执行：

```bash
pnpm -C . install --no-frozen-lockfile
```

## 3. 启动步骤

### 3.1 启动导出服务

```bash
pnpm -C VectorTileToCesiumImageryLayerTiles/service dev
```

期望：
- 日志出现 `export service ready on http://localhost:4100`
- `GET http://localhost:4100/health` 返回：

```json
{"ok":true}
```

### 3.2 启动 Web 编辑器

```bash
pnpm -C VectorTileToCesiumImageryLayerTiles/web dev --host 127.0.0.1 --port 5173
```

访问：
- `http://127.0.0.1:5173`

## 4. 必测项与通过标准

## 4.1 构建/类型检查

执行：

```bash
pnpm -C VectorTileToCesiumImageryLayerTiles/shared build
pnpm -C VectorTileToCesiumImageryLayerTiles/web exec tsc --noEmit
pnpm -C VectorTileToCesiumImageryLayerTiles/service exec tsc --noEmit
```

通过标准：
- 三条命令均退出码 `0`

## 4.2 样式校验接口

执行（用默认样式文件）：

```bash
python3 - <<'PY'
import json, pathlib, urllib.request
style = json.loads(pathlib.Path('VectorTileToCesiumImageryLayerTiles/shared/default-style-config.json').read_text())
req = urllib.request.Request('http://127.0.0.1:4100/api/styles/validate', data=json.dumps(style).encode(), headers={'Content-Type':'application/json'})
with urllib.request.urlopen(req, timeout=20) as r:
    print(r.read().decode())
PY
```

通过标准：
- 返回 `{"ok":true}`

## 4.3 Web 交互能力

人工操作：
1. 打开 `http://127.0.0.1:5173`
2. 检查页面包含：
   - 服务连接
   - 样式文件
   - 图层分组
3. 切换一个图层显隐（如 `Railway`）
4. 调整一个颜色或线宽
5. 点击“导出 JSON”，再导入同一 JSON

通过标准：
- 地图正常更新，不崩溃
- 导入后样式可恢复

## 4.4 XYZ 导出能力（核心）

执行示例导出：

```bash
bash VectorTileToCesiumImageryLayerTiles/service/scripts/export-demo.sh
```

获得 `job id` 后轮询：

```bash
curl -sS http://127.0.0.1:4100/api/exports/<job-id>
```

通过标准：
- `status` 最终为 `completed`
- `progress.completed == progress.total`
- 输出目录存在且包含：
  - `z/x/y.png|jpg`
  - `metadata.json`

可用以下命令检查目录：

```bash
ls -R VectorTileToCesiumImageryLayerTiles/service/output/demo
```

## 4.5 产物有效性

随机抽检一个瓦片文件：

```bash
file VectorTileToCesiumImageryLayerTiles/service/output/demo/7/106/51.png
```

通过标准：
- 输出应为 `PNG image data, 256 x 256`（或对应 JPG）

## 4.6 Cesium 加载可用性（最小验证）

将 `output/demo/{z}/{x}/{y}.png` 作为 XYZ URL，加载到 Cesium：

```js
const layer = new Cesium.ImageryLayer(
  new Cesium.UrlTemplateImageryProvider({
    url: "http://<your-static-server>/demo/{z}/{x}/{y}.png"
  })
);
viewer.imageryLayers.add(layer);
```

通过标准：
- Cesium 可见底图图像
- 缩放切换时瓦片连续加载，无明显错位

## 5. 可调参数（导出侧）

- `SOURCE_FETCH_TIMEOUT_MS`：单个 MVT 请求超时（默认 `8000`）
- `TILE_RENDER_TIMEOUT_MS`：单瓦片渲染超时（默认 `15000`）
- `RENDER_MAX_FEATURES_PER_LAYER`：每个 source-layer 最大渲染要素数（默认 `20000`）

建议：
- 大范围导出前先用小 `bounds`、低 `zoom` 预跑

## 6. 已知风险与观察项

- 当前为最小可用实现，未加入任务队列和并发调度。
- 若出现前端控制台异常（如样式更新报错），以导出 API 的实际结果为主判定核心能力是否通过。
- 大范围导出时需关注耗时、内存、上游 Martin 响应。

## 7. 验收记录模板

| 项目 | 结果(通过/失败) | 证据 | 备注 |
| --- | --- | --- | --- |
| 构建与类型检查 |  | 命令输出 |  |
| 健康检查接口 |  | `/health` 返回 |  |
| 样式校验接口 |  | `/api/styles/validate` 返回 |  |
| Web 基础交互 |  | 截图/录屏 |  |
| 导出任务完成 |  | `/api/exports/:id` 返回 |  |
| 输出目录结构 |  | `ls -R` 输出 |  |
| 瓦片文件有效性 |  | `file` 输出 |  |
| Cesium 加载验证 |  | 截图/录屏 |  |

## 8. 本次验收结论（填写区）

- 验收日期：
- 验收人：
- 结论：`通过 / 有条件通过 / 不通过`
- 阻塞问题：
- 后续行动：
