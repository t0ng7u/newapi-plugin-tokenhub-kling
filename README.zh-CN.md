---
locale: zh-CN
---
# TokenHub 可灵

通过腾讯云 TokenHub 生成可灵视频：文生视频、图生视频、全能视频（参考图、参考视频、视频编辑、主体与音色）和动作控制。

## 渠道设置

1. 新建渠道，类型选「任务插件」，绑定 TokenHub 可灵。
2. 密钥填 TokenHub 控制台里的 API Key，插件以 `Authorization: Bearer` 加密钥的形式发送。
3. API 地址留空即使用默认的 `https://tokenhub.tencentmaas.com`；使用国际站时填 `https://tokenhub-intl.tencentcloudmaas.com`。
4. 在 TokenHub 控制台为要提供的可灵模型开通后付费。

如果要经由另一个同样安装了本插件的 New API 网关转发，改用 New API 类型的渠道，在它的插件里加上 TokenHub 可灵，密钥填那个网关的令牌。请求会发到那个网关上本插件自己的 `/t0ng7u_tokenhub-kling` 路由。

## 模型与接口

| 模型 | 文生视频 | 图生视频 | 全能视频 | 动作控制 |
| --- | --- | --- | --- | --- |
| `kling-video-v4-flash` | 支持 | 支持 | 支持 | |
| `kling-video-v4` | 支持 | 支持 | 支持 | |
| `kling-video-v3` | 支持 | 支持 | | |
| `kling-video-v3-turbo` | 支持 | 支持 | | |
| `kling-video-v3-omni` | | | 支持 | |
| `kling-video-o1` | | | 支持 | |
| `kling-video-v2.6` | 支持 | 支持 | | |
| `kling-video-v2.5-turbo` | 支持 | 支持 | | |
| `kling-video-motion-control-v3.0` | | | | 支持 |
| `kling-video-motion-control-v2.6` | | | | 支持 |

客户端可以用三种方式调用网关：

- TokenHub 原生接口，请求体与 TokenHub 相同：`POST /v1/wand/kling/text-to-video`、`/image-to-video`、`/omni-video` 和 `/motion-control`，再用 `data.id` 里的任务 ID 调 `GET /v1/wand/kling/tasks/{task_id}` 查询。这些路由也可以加上 `/t0ng7u_tokenhub-kling` 前缀访问。
- OpenAI 视频接口：`POST /v1/videos`、`GET /v1/videos/{id}` 和 `GET /v1/videos/{id}/content`，支持动作控制以外的所有模型。`prompt` 是提示词，`input_reference`（URL 或上传的图片）和 `images` 是首帧和尾帧，`seconds` 是时长，`size` 选最接近的清晰度和画面比例。`metadata` 里写 TokenHub 的 `settings`，会覆盖 `seconds` 和 `size`。
- OpenAI Responses 接口：`POST /v1/responses`，支持流式、非流式和 `background`，模型范围同 OpenAI 视频接口。文本内容作为提示词，图片内容作为首尾帧，回复里是一个 HTML `video` 标签，通过网关下载链接播放生成的视频。

## 计费

价格表只有一个字段 `tokens`，即视频生成单价，按每百万 TokenHub token 计价。TokenHub 的可灵模型全部按 token 计费，请为要提供的每个模型设置每百万 token 的价格。

提交任务时，网关按 TokenHub 公布的每秒 token 数预扣，按模型、清晰度和类型（无声、有声、指定音色、有参考视频）区分，再乘以预扣秒数：

- 请求里的 `duration`；未填时按 TokenHub 默认值：v4 和 v4-flash 为 10 秒，其余模型为 5 秒。
- v4 和 v4-flash 带参考视频、待编辑视频或主体时：取输出时长的 2 倍与「30 秒输入加输出时长」中较大的一个；视频编辑未填时长时按 30 秒输入计算。请求里看不出主体是否为视频角色，所以主体按视频输入计算。
- v3-omni 和 o1 的视频编辑（`base_video`）：16 秒。
- 动作控制：`character_orientation` 为 `image` 时 10 秒，为 `video` 时 30 秒。

任务成功后按 `tokenhub_usage.total_tokens`（TokenHub 为该任务上报的 token 数）结算。TokenHub 未上报 token 数时保留预扣额度。失败的任务会退款。

## 示例

```bash
curl https://gateway.example.com/v1/wand/kling/text-to-video \
  -H "Authorization: Bearer sk-..." \
  -H "Content-Type: application/json" \
  -d '{"model": "kling-video-v3", "prompt": "A girl sat on the train, looking out the window", "settings": {"resolution": "1080p", "duration": 5}}'
```

```bash
curl https://gateway.example.com/v1/wand/kling/tasks/task_xxxxxxxxxxxx \
  -H "Authorization: Bearer sk-..."
```

## 限制

- 不支持 `options.external_task_id`，请用网关返回的任务 ID 查询。
- 主体和音色需要直接通过 TokenHub 的主体、音色管理接口创建，本插件只按 ID 引用。
- 上传到 `/v1/videos` 的图片会内联发送，大小不能超过 50 MB。
- 视频链接是 TokenHub 存储的临时地址，任务成功后请尽快下载，或通过 `/v1/videos/{id}/content` 获取。
- 未填 `duration` 时，TokenHub 可能按提示词决定时长，最终仍按上报的 token 数结算。
